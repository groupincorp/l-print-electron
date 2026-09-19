import { requestDatabase } from "@/server/request-api";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";
import type { table_print_queue } from "@/components/gui/print-queue";

export type QueueStatus = "idle" | "processing" | "paused" | "error";

export interface PrinterQueueState {
  printerName: string;
  jobs: table_print_queue[];
  status: QueueStatus;
  isEnabled: boolean;
  /** Stopped after MAX_ATTEMPTS on one job; needs an operator Resume. */
  isHalted: boolean;
  currentJobId: number | null;
  lastError: string | null;
}

type ChangeListener = (queues: PrinterQueueState[]) => void;

/**
 * A job that fails this many times in a row halts its printer's queue
 * instead of retrying forever. An offline printer would otherwise collect
 * one spooled attempt every 5s and print all of them the moment it comes
 * back - the retry loop itself becomes the duplicate.
 */
const MAX_ATTEMPTS = 3;

/**
 * How long a row stays blocked from re-entering a queue after its paper
 * already came out. Covers the window where the server still lists the row
 * because the delete failed, or because an in-flight GET was issued before
 * the delete landed.
 */
const PRINTED_SUPPRESSION_MS = 5 * 60_000;

/** Background retry delays for the post-print delete before giving up. */
const DELETE_RETRY_DELAYS_MS = [3_000, 10_000];

/** A row id arrives as a number, or - for a "group_by: TABLE" ticket that
 *  merges several rows into one printed ticket - as a comma-joined list. */
function jobIds(job: table_print_queue): number[] {
  if (job.id == null) return [];
  if (typeof job.id === "number") return [job.id];
  return String(job.id)
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

/**
 * Manages independent print queues per printer.
 * Each printer queue processes jobs sequentially and independently —
 * if one printer fails, others continue unaffected.
 */
export class QueueManager {
  private queues = new Map<string, PrinterQueueState>();
  private processing = new Map<string, boolean>();
  private listener: ChangeListener | null = null;

  /** Printers whose queue stopped after MAX_ATTEMPTS; cleared by resume(). */
  private halted = new Set<string>();
  /** Consecutive failures per job, keyed by String(job.id). */
  private attempts = new Map<string, number>();
  /** Row id -> timestamp until which it must not be re-queued. */
  private recentlyPrinted = new Map<number, number>();
  /** Set by destroy(); every loop checks it so nothing prints after teardown. */
  private stopped = false;

  onQueuesChange(cb: ChangeListener) {
    this.listener = cb;
    // Hand over the current state immediately: this manager outlives the UI
    // that renders it, so a freshly mounted queue tab must see the queues
    // that are already in flight instead of an empty list.
    cb(this.snapshot());
  }

  /** Detach the UI callback without touching any in-flight work. */
  detach(cb?: ChangeListener) {
    if (!cb || this.listener === cb) this.listener = null;
  }

  private emit() {
    this.listener?.(Array.from(this.queues.values()));
  }

  private ensure(printerName: string): PrinterQueueState {
    if (!this.queues.has(printerName)) {
      this.queues.set(printerName, {
        printerName,
        jobs: [],
        status: "idle",
        isEnabled: true,
        isHalted: false,
        currentJobId: null,
        lastError: null,
      });
    }
    return this.queues.get(printerName)!;
  }

  /**
   * Sync the full server job list into per-printer queues.
   * - New jobs are enqueued for the correct printer.
   * - Jobs removed from the server are dropped (unless in-flight).
   * - Rows this manager already printed are ignored, however the server
   *   still reports them.
   * - Idle queues with pending jobs start processing automatically.
   */
  sync(serverJobs: table_print_queue[]) {
    if (this.stopped) return;
    this.prunePrinted();

    // Group by printer name
    const grouped = new Map<string, table_print_queue[]>();
    for (const job of serverJobs) {
      // Paper already came out for this row - the server just hasn't
      // dropped it yet. Re-queuing it here is a duplicate receipt.
      if (this.isSuppressed(job)) continue;

      const key =
        job.printer_info?.printer_name || job.printer_info?.name || "unknown";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(job);
    }

    // Ensure a queue entry exists for every printer in the response
    for (const key of grouped.keys()) this.ensure(key);

    // Merge server state into local queues
    for (const [printer, queue] of this.queues) {
      const incoming = grouped.get(printer) ?? [];

      // Rebuild job list:
      //   1. Keep the in-flight job (even if server already removed it mid-print)
      //   2. Add every server job that is not already present
      const updated: table_print_queue[] = [];

      if (queue.currentJobId != null) {
        const inFlight = queue.jobs.find((j) => j.id === queue.currentJobId);
        if (inFlight) updated.push(inFlight);
      }

      for (const job of incoming) {
        if (!updated.some((j) => j.id === job.id)) updated.push(job);
      }

      queue.jobs = updated;

      // Kick off processing after sync has fully emitted — defer so that
      // run() never races with sync's own pruneEmpty/emit calls. A halted
      // queue is left alone until the operator presses Resume.
      if (
        !this.processing.get(printer) &&
        !this.halted.has(printer) &&
        queue.isEnabled &&
        updated.length > 0
      ) {
        queueMicrotask(() => this.run(printer));
      }
    }

    // Remove idle queues that have no jobs so they don't linger as empty cards
    this.pruneEmpty();
    this.emit();
  }

  /** Remove a specific job from a printer's local queue (e.g. after manual delete). */
  removeJob(printerName: string, jobId: number) {
    const queue = this.queues.get(printerName);
    if (!queue || queue.currentJobId === jobId) return; // don't remove in-flight
    queue.jobs = queue.jobs.filter((j) => j.id !== jobId);
    this.attempts.delete(String(jobId));
    // The queue's contents changed, so whatever halted it may be gone.
    this.halted.delete(printerName);
    queue.isHalted = false;
    this.pruneEmpty();
    this.emit();
  }

  /** Drop idle queues that have no remaining jobs. Paused/processing/error queues are kept. */
  private pruneEmpty() {
    for (const [name, q] of this.queues) {
      if (
        q.jobs.length === 0 &&
        q.status === "idle" &&
        !this.processing.get(name)
      ) {
        this.queues.delete(name);
        this.processing.delete(name);
        this.halted.delete(name);
      }
    }
  }

  // ── Printed-row suppression ───────────────────────────────────────────────

  private isSuppressed(job: table_print_queue): boolean {
    const now = Date.now();
    return jobIds(job).some((id) => (this.recentlyPrinted.get(id) ?? 0) > now);
  }

  private prunePrinted() {
    const now = Date.now();
    for (const [id, expiry] of this.recentlyPrinted) {
      if (expiry <= now) this.recentlyPrinted.delete(id);
    }
  }

  /**
   * Best-effort removal of print_queue row(s) whose paper already came out.
   * Deliberately NOT part of the print's own try/catch: a delete that fails
   * is a bookkeeping problem, never a reason to print the same receipt
   * again. Retried in the background while recentlyPrinted holds the row
   * out of the queue.
   */
  private async deleteRows(ids: number[], printerName: string) {
    if (ids.length === 0) return;

    for (let attempt = 0; !this.stopped; attempt++) {
      try {
        await requestDatabase("/api/print-queue/delete", "DELETE", { ids });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (attempt >= DELETE_RETRY_DELAYS_MS.length) {
          console.error(
            `[${printerName}] row(s) ${ids.join(",")} printed but could not be cleared on the server: ${msg}`,
          );
          const q = this.queues.get(printerName);
          if (q) {
            q.lastError = `Printed #${ids.join(",")} but the server still lists it`;
            this.emit();
          }
          return;
        }
        await sleep(DELETE_RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  /**
   * Stop this printer's queue and leave the job in place for an operator.
   * Used when retrying would do more harm than good - a job that already
   * failed MAX_ATTEMPTS times, or one whose outcome we never learned.
   */
  private haltQueue(
    queue: PrinterQueueState,
    printerName: string,
    reason: string,
  ) {
    this.halted.add(printerName);
    queue.isHalted = true;
    queue.status = "error";
    queue.currentJobId = null;
    queue.lastError = reason;
    console.error(`[${printerName}] ✗ queue halted — ${reason}`);
    this.emit();
  }

  // ── Core processing loop ──────────────────────────────────────────────────

  private async run(printerName: string) {
    if (this.stopped || this.processing.get(printerName)) return;

    const queue = this.queues.get(printerName);
    if (!queue) return;

    this.processing.set(printerName, true);
    let halted = false;

    try {
      while (!this.stopped && queue.isEnabled && queue.jobs.length > 0) {
        const job = queue.jobs[0];

        if (!job?.id) {
          queue.jobs.shift();
          continue;
        }

        const key = String(job.id);
        const failures = this.attempts.get(key) ?? 0;

        // Stop rather than reprint forever - see MAX_ATTEMPTS.
        if (failures >= MAX_ATTEMPTS) {
          halted = true;
          this.haltQueue(
            queue,
            printerName,
            `Job #${job.id} failed ${MAX_ATTEMPTS} times — queue stopped. Fix the printer, then press Resume.`,
          );
          break;
        }

        queue.status = "processing";
        queue.currentJobId = job.id;
        this.emit();

        let printed = false;
        let timedOut = false;
        let failure: string | null = null;

        try {
          const option: PosPrintOptions = {
            preview: false,
            margin: "0 0 0 0",
            copies: 1,
            printerName,
            timeOutPerLine: 400,
            silent: true,
            pageSize: "80mm",
            boolean: true,
          };

          const result = await backend.printJob(
            job.content as PosPrintData[],
            option,
          );
          // "timeout" is truthy - check it before treating the result as a
          // boolean, or a spooled job counts as printed.
          if (result === "timeout") {
            timedOut = true;
          } else {
            printed = !!result;
            if (!printed) failure = "Printer returned failure";
          }
        } catch (err) {
          failure = err instanceof Error ? err.message : "Unknown error";
        }

        if (timedOut) {
          // We never learned whether the paper came out, and the job is
          // most likely sitting in the Windows spooler where we can't
          // recall it. Retrying would just re-spool it - stop and let the
          // operator decide instead.
          halted = true;
          this.haltQueue(
            queue,
            printerName,
            `Job #${job.id} timed out — the printer may be jammed or offline, and the job may already be in the Windows print spooler. Clear the printer, then press Resume — or delete the job if it did come out.`,
          );
          break;
        }

        if (printed) {
          // Paper is out. Block the row and drop it locally BEFORE the
          // delete is attempted, so a failed delete can never send this
          // receipt through the printer a second time.
          const ids = jobIds(job);
          const until = Date.now() + PRINTED_SUPPRESSION_MS;
          for (const id of ids) this.recentlyPrinted.set(id, until);

          queue.jobs = queue.jobs.filter((j) => j.id !== job.id);
          this.attempts.delete(key);
          queue.lastError = null;
          console.log(`[${printerName}] ✓ Job #${job.id} completed`);

          void this.deleteRows(ids, printerName);
        } else {
          const next = failures + 1;
          this.attempts.set(key, next);
          queue.status = "error";
          queue.lastError = failure;
          console.warn(
            `[${printerName}] ✗ Job #${job.id} – ${failure} (attempt ${next}/${MAX_ATTEMPTS})`,
          );
          this.emit();
          if (!this.stopped) await sleep(5_000);
        }

        queue.currentJobId = null;

        // Brief pause between jobs; skip on error to re-evaluate immediately
        if (
          printed &&
          !this.stopped &&
          queue.isEnabled &&
          queue.jobs.length > 0
        ) {
          await sleep(500);
        }

        // Recover from error status for the next iteration
        if (queue.status === "error") {
          queue.status = "processing";
        }
      }
    } finally {
      const q = this.queues.get(printerName);
      if (q) {
        q.currentJobId = null;
        // A halted queue keeps its error status so the card shows why it
        // stopped and the operator gets a Resume button.
        if (!halted) q.status = q.isEnabled ? "idle" : "paused";
      }
      this.processing.set(printerName, false);
      this.pruneEmpty();
      this.emit();
    }
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  pause(printerName: string) {
    const q = this.ensure(printerName);
    q.isEnabled = false;
    if (!this.processing.get(printerName)) q.status = "paused";
    this.emit();
  }

  resume(printerName: string) {
    const q = this.ensure(printerName);
    q.isEnabled = true;
    // Resume is the operator saying "the printer is fixed" - give every
    // job in this queue a clean slate.
    this.halted.delete(printerName);
    q.isHalted = false;
    for (const job of q.jobs) this.attempts.delete(String(job.id));
    q.lastError = null;
    if (!this.processing.get(printerName)) {
      q.status = "idle";
      if (q.jobs.length > 0) void this.run(printerName);
    }
    this.emit();
  }

  pauseAll() {
    for (const k of this.queues.keys()) this.pause(k);
  }

  resumeAll() {
    for (const k of this.queues.keys()) this.resume(k);
  }

  snapshot(): PrinterQueueState[] {
    return Array.from(this.queues.values());
  }

  /**
   * Full teardown — app shutdown only, NOT component unmount. Every loop
   * checks `stopped`, so nothing prints after this returns.
   */
  destroy() {
    this.stopped = true;
    this.listener = null;
    this.queues.clear();
    this.processing.clear();
    this.halted.clear();
    this.attempts.clear();
    this.recentlyPrinted.clear();
  }
}

/**
 * App-wide singleton.
 *
 * PrintQueue is mounted only while its sidebar tab is active, so it
 * unmounts and remounts on every tab switch. When each mount built its own
 * QueueManager, the previous one kept running its loop over the same
 * print_queue rows - two managers, one set of rows, two receipts - and a
 * manager stuck retrying an offline printer never exited at all. Owning the
 * manager here keeps exactly one loop alive for the life of the app.
 */
export const queueManager = new QueueManager();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
