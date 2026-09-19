/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import {
  queueManager,
  type PrinterQueueState,
  type QueueStatus,
} from "@/lib/queue-manager";
import { requestDatabase } from "@/server/request-api";
import type { PosPrintData } from "electron-pos-printer";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  Layers,
  Package,
  Pause,
  Play,
  Printer,
  RefreshCw,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeletePrintQueue } from "./delete-print-queue";
import { PrintTestButton } from "./test-print";

interface Props {
  token: string | null;
  onQueueCountChange?: (count: number) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export interface table_print_queue {
  id?: number;
  created_at: string;
  created_by: string;
  content: PosPrintData[];
  printer_info: {
    name?: string;
    printer_name?: string;
    status?: string;
    [key: string]: any;
  };
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  QueueStatus,
  { label: string; color: string; dot: string; badge: string }
> = {
  idle: {
    label: "Idle",
    color: "text-muted-foreground",
    dot: "bg-muted-foreground",
    badge: "bg-secondary text-secondary-foreground border-border",
  },
  processing: {
    label: "Processing",
    color: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500 animate-pulse",
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  },
  paused: {
    label: "Paused",
    color: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  },
  error: {
    label: "Error",
    color: "text-destructive",
    dot: "bg-destructive animate-pulse",
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getContentSummary(content: PosPrintData[]): string {
  if (!Array.isArray(content)) return "Invalid content";
  const text = content.filter((i) => i.type === "text").length;
  const img = content.filter((i) => i.type === "image").length;
  const tbl = content.filter((i) => i.type === "table").length;
  const other = content.length - text - img - tbl;
  const parts: string[] = [];
  if (text) parts.push(`${text} text`);
  if (img) parts.push(`${img} img`);
  if (tbl) parts.push(`${tbl} tbl`);
  if (other) parts.push(`${other} other`);
  return (
    parts.join(", ") ||
    `${content.length} item${content.length !== 1 ? "s" : ""}`
  );
}

function renderPrintContent(content: PosPrintData[]) {
  if (!Array.isArray(content)) return null;
  return content.map((item, index) => {
    if (item.type === "text") {
      return (
        <div key={index} className="mb-1.5">
          <div className="text-[12px] font-mono bg-secondary px-2.5 py-1.5 rounded border-l-2 border-l-primary text-foreground">
            {item.value}
          </div>
        </div>
      );
    } else if (item.type === "image") {
      return (
        <div key={index} className="mb-1.5">
          <div className="flex items-center gap-1.5 text-[12px] text-primary bg-accent px-2.5 py-1.5 rounded border-l-2 border-l-primary">
            <Package className="w-3.5 h-3.5" />
            <span>Image: {item.path || "Base64"}</span>
          </div>
        </div>
      );
    } else if (item.type === "table") {
      return (
        <div key={index} className="mb-1.5">
          <div className="text-[12px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded border-l-2 border-l-emerald-500">
            <div className="flex items-center gap-1.5 mb-0.5">
              <FileText className="w-3.5 h-3.5" />
              <span className="font-medium">Table</span>
            </div>
            {item.tableHeader && (
              <div className="text-[11px] text-muted-foreground">
                Cols: {item.tableHeader.join(", ")}
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={index} className="mb-1.5">
        <div className="text-[12px] text-muted-foreground bg-secondary px-2.5 py-1.5 rounded border-l-2 border-l-border">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Settings className="w-3.5 h-3.5" />
            <span className="font-medium capitalize">{item.type}</span>
          </div>
          <pre className="text-[10px] whitespace-pre-wrap opacity-70">
            {JSON.stringify(item, null, 2)}
          </pre>
        </div>
      </div>
    );
  });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subLabel,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: "default" | "blue" | "emerald" | "amber" | "red";
  subLabel?: string;
}) {
  const styles = {
    default: {
      bg: "bg-secondary",
      icon: "text-muted-foreground",
      val: "text-foreground",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/20",
      icon: "text-blue-500",
      val: "text-blue-700 dark:text-blue-400",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      icon: "text-emerald-500",
      val: "text-emerald-700 dark:text-emerald-400",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      icon: "text-amber-500",
      val: "text-amber-700 dark:text-amber-400",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-950/20",
      icon: "text-red-500",
      val: "text-red-700 dark:text-red-400",
    },
  };
  const s = styles[color];

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <div
          className={`flex items-center justify-center w-7 h-7 rounded-lg ${s.bg}`}
        >
          <Icon className={`w-4 h-4 ${s.icon}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold leading-none mb-1 ${s.val}`}>{value}</p>
      {subLabel && (
        <p className="text-[11px] text-muted-foreground">{subLabel}</p>
      )}
    </div>
  );
}

// ── PrinterQueueCard ──────────────────────────────────────────────────────────

function PrinterQueueCard({
  queue,
  onPause,
  onResume,
  onJobDeleted,
}: {
  queue: PrinterQueueState;
  onPause: (name: string) => void;
  onResume: (name: string) => void;
  onJobDeleted: (printerName: string, jobId: number) => void;
}) {
  const cfg = STATUS_CFG[queue.status];
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* ── Card header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary flex-shrink-0">
            <Printer className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground truncate">
                {queue.printerName}
              </span>
              {/* Status badge */}
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${cfg.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            {queue.status === "error" && queue.lastError && (
              <div className="flex items-center gap-1 text-[11px] text-destructive mt-0.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-xs">{queue.lastError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[12px] text-muted-foreground hidden sm:block">
            {queue.jobs.length} job{queue.jobs.length !== 1 ? "s" : ""}
          </span>

          {queue.isEnabled && !queue.isHalted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause(queue.printerName)}
              className="h-7 px-2 text-[12px] gap-1"
            >
              <Pause className="w-3 h-3" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResume(queue.printerName)}
              className="h-7 px-2 text-[12px] gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
            >
              <Play className="w-3 h-3" />
              Resume
            </Button>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            />
          </button>
        </div>
      </div>

      {/* ── Job list ── */}
      {open &&
        (queue.jobs.length === 0 ? (
          <div className="px-4 py-4 text-center text-[13px] text-muted-foreground">
            No pending jobs in this queue
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-4 py-2 bg-secondary/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-16">
                Job ID
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Content
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Created
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-8" />
            </div>

            {queue.jobs.map((job, idx) => {
              const isActive = job.id != null && job.id === queue.currentJobId;
              return (
                <details key={job.id ?? idx} className="group">
                  <summary
                    className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-4 py-2.5 list-none cursor-pointer items-center transition-colors ${
                      isActive
                        ? "bg-blue-50/60 dark:bg-blue-950/10"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    {/* Job ID */}
                    <div className="flex items-center gap-1.5 w-16">
                      {isActive ? (
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" />
                      ) : (
                        <span className="w-3 h-3 flex-shrink-0" />
                      )}
                      <span className="text-[12px] font-mono font-medium text-foreground">
                        #{job.id ?? "—"}
                      </span>
                    </div>

                    {/* Content summary */}
                    <span className="text-[12px] text-muted-foreground truncate">
                      {getContentSummary(job.content)}
                    </span>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground hidden sm:flex">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(job.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Delete */}
                    <div className="w-8 flex items-center justify-center">
                      <DeletePrintQueue
                        print={job}
                        onDeleted={() =>
                          job.id != null &&
                          onJobDeleted(queue.printerName, job.id)
                        }
                      />
                    </div>
                  </summary>

                  {/* Expanded content */}
                  <div className="px-10 py-3 bg-secondary/30 border-t border-border">
                    {renderPrintContent(job.content)}
                  </div>
                </details>
              );
            })}
          </div>
        ))}
    </div>
  );
}

// ── PrintQueue (main dashboard) ───────────────────────────────────────────────

export function PrintQueue({ token, onQueueCountChange }: Props) {
  const [queues, setQueues] = useState<PrinterQueueState[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isHandlerRegistered = useRef(false);

  const fetchAndSync = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await requestDatabase<{ result: table_print_queue[] }>(
        "/api/print-queue",
        "GET",
      );
      queueManager.sync(res.result);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch print queue:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!token || isHandlerRegistered.current) return;
    // Re-attach to the app-wide manager. It kept running (and printing)
    // while this tab was unmounted, so this immediately paints whatever is
    // already in flight rather than starting from an empty list.
    queueManager.onQueuesChange(setQueues);
    const offCron = backend.onCronEvent(() => {
      console.log("Cron → syncing queues");
      fetchAndSync();
    });
    // A WS-pushed kitchen ticket is printing directly on this printer right
    // now (bypassing this queue entirely) - pause our own polling for it so
    // the two paths never send it competing jobs, and resume once it's done.
    const offKitchenWs = backend.onKitchenWsPrintStatus?.(
      ({ printerName, active }) => {
        if (active) {
          console.log(`Kitchen WS print active on ${printerName} → pausing poller`);
          queueManager.pause(printerName);
        } else {
          console.log(`Kitchen WS print done on ${printerName} → resuming poller`);
          queueManager.resume(printerName);
        }
      },
    );
    isHandlerRegistered.current = true;
    fetchAndSync();
    // This component only exists while its sidebar tab is active (see
    // app-shell.tsx), so it fully unmounts/remounts on every tab switch.
    // Without removing these listeners, each remount would stack another
    // cron-event/kitchen-ws-print-status handler on top of the previous
    // mount's - and every leaked handler independently polls and prints
    // the same queue, which is what caused tickets to print more than once.
    //
    // The manager itself is NOT torn down here: it is app-wide and owns the
    // in-flight print loop. Destroying it on unmount used to strand that
    // loop (it kept printing) while the next mount built a second manager
    // over the same rows - the other half of the duplicate-ticket bug.
    return () => {
      isHandlerRegistered.current = false;
      offCron?.();
      offKitchenWs?.();
      queueManager.detach(setQueues);
    };
  }, [token, fetchAndSync]);

  const handlePause = useCallback((name: string) => queueManager.pause(name), []);
  const handleResume = useCallback(
    (name: string) => queueManager.resume(name),
    [],
  );
  const handleJobDeleted = useCallback(
    (printerName: string, jobId: number) =>
      queueManager.removeJob(printerName, jobId),
    [],
  );

  const toggleGlobal = () => {
    if (globalEnabled) {
      queueManager.pauseAll();
      setGlobalEnabled(false);
    } else {
      queueManager.resumeAll();
      setGlobalEnabled(true);
    }
  };

  const totalJobs = queues.reduce((s, q) => s + q.jobs.length, 0);
  const processingCount = queues.filter(
    (q) => q.status === "processing",
  ).length;
  const errorCount = queues.filter((q) => q.status === "error").length;
  const idleCount = queues.filter((q) => q.status === "idle").length;

  // Notify parent of queue count changes
  useEffect(() => {
    onQueueCountChange?.(totalJobs);
  }, [totalJobs, onQueueCountChange]);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ── Stat cards row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Printers"
            value={queues.length}
            icon={Printer}
            color="default"
            subLabel={`${idleCount} idle`}
          />
          <StatCard
            label="Processing"
            value={processingCount}
            icon={Loader2}
            color="blue"
            subLabel="Active jobs"
          />
          <StatCard
            label="Pending Jobs"
            value={totalJobs}
            icon={Layers}
            color="amber"
            subLabel="In queue"
          />
          <StatCard
            label="Errors"
            value={errorCount}
            icon={XCircle}
            color={errorCount > 0 ? "red" : "default"}
            subLabel={errorCount > 0 ? "Needs attention" : "All clear"}
          />
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* Global status pill */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${
                globalEnabled
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"
                  : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  globalEnabled
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-amber-500"
                }`}
              />
              {globalEnabled ? "Queue Running" : "Queue Paused"}
            </div>

            {lastRefresh && (
              <span className="text-[11px] text-muted-foreground hidden sm:block">
                Refreshed {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <PrintTestButton />

            <Button
              variant="outline"
              size="sm"
              onClick={toggleGlobal}
              className="h-8 text-[12px] gap-1.5"
            >
              {globalEnabled ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause All
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Resume All
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchAndSync}
              disabled={isRefreshing}
              className="h-8 text-[12px] gap-1.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Printer queue cards ── */}
        {queues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground mb-1">
              All queues are empty
            </h3>
            <p className="text-[13px] text-muted-foreground max-w-xs">
              No print jobs are pending. New jobs will appear here
              automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-[13px] font-semibold text-foreground">
                  Active Queues
                </h2>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                  {queues.length}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>
                  {totalJobs} total job{totalJobs !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {queues.map((queue) => (
              <PrinterQueueCard
                key={queue.printerName}
                queue={queue}
                onPause={handlePause}
                onResume={handleResume}
                onJobDeleted={handleJobDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
