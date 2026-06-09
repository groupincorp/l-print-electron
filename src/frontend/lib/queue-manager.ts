import { requestDatabase } from "@/server/request-api";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";
import type { table_print_queue } from "@/components/gui/print-queue";

export type QueueStatus = "idle" | "processing" | "paused" | "error";

export interface PrinterQueueState {
  printerName: string;
  jobs: table_print_queue[];
  status: QueueStatus;
  isEnabled: boolean;
  currentJobId: number | null;
  lastError: string | null;
}

type ChangeListener = (queues: PrinterQueueState[]) => void;

/**
 * Manages independent print queues per printer.
 * Each printer queue processes jobs sequentially and independently —
 * if one printer fails, others continue unaffected.
 */
export class QueueManager {
  private queues = new Map<string, PrinterQueueState>();
  private processing = new Map<string, boolean>();
  private listener: ChangeListener | null = null;

  onQueuesChange(cb: ChangeListener) {
    this.listener = cb;
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
   * - Idle queues with pending jobs start processing automatically.
   */
  sync(serverJobs: table_print_queue[]) {
    // Group by printer name
    const grouped = new Map<string, table_print_queue[]>();
    for (const job of serverJobs) {
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
      // run() never races with sync's own pruneEmpty/emit calls.
      if (
        !this.processing.get(printer) &&
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
      }
    }
  }

  // ── Core processing loop ──────────────────────────────────────────────────

  private async run(printerName: string) {
    if (this.processing.get(printerName)) return;
    this.processing.set(printerName, true);

    const queue = this.queues.get(printerName)!;

    try {
      while (queue.isEnabled && queue.jobs.length > 0) {
        const job = queue.jobs[0];

        if (!job?.id) {
          queue.jobs.shift();
          continue;
        }

        queue.status = "processing";
        queue.currentJobId = job.id;
        this.emit();

        let succeeded = false;

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

          const ok = await backend.printJob(
            job.content as PosPrintData[],
            option,
          );

          if (ok) {
            const ids =
              typeof job.id === "number"
                ? [job.id]
                : String(job.id)
                    .split(",")
                    .map((s) => Number(s));

            await requestDatabase("/api/print-queue/delete", "DELETE", { ids });
            queue.jobs = queue.jobs.filter((j) => j.id !== job.id);
            queue.lastError = null;
            succeeded = true;
            console.log(`[${printerName}] ✓ Job #${job.id} completed`);
          } else {
            console.warn(
              `[${printerName}] ✗ Job #${job.id} – printer returned failure, retrying in 5 s`,
            );
            queue.status = "error";
            queue.lastError = "Printer returned failure";
            this.emit();
            await sleep(5_000);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[${printerName}] ✗ Job #${job.id} error: ${msg}`);
          queue.status = "error";
          queue.lastError = msg;
          this.emit();
          await sleep(5_000);
        }

        queue.currentJobId = null;

        // Brief pause between jobs; skip on error to re-evaluate immediately
        if (succeeded && queue.isEnabled && queue.jobs.length > 0) {
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
        q.status = q.isEnabled ? "idle" : "paused";
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
    if (!this.processing.get(printerName)) {
      q.status = "idle";
      if (q.jobs.length > 0) this.run(printerName);
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

  destroy() {
    this.listener = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
