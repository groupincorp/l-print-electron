/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import {
  QueueManager,
  type PrinterQueueState,
  type QueueStatus,
} from "@/lib/queue-manager";
import { requestDatabase } from "@/server/request-api";
import type { PosPrintData } from "electron-pos-printer";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  FileText,
  Hash,
  Package,
  Pause,
  Play,
  Printer,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeletePrintQueue } from "./delete-print-queue";
import { Logout } from "./logout";
import { PrintTestButton } from "./test-print";

interface Props {
  token: string | null;
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  QueueStatus,
  { label: string; textCls: string; bgCls: string; dotCls: string }
> = {
  idle: {
    label: "Idle",
    textCls: "text-gray-500 dark:text-gray-400",
    bgCls: "bg-gray-100 dark:bg-gray-800/50",
    dotCls: "bg-gray-400",
  },
  processing: {
    label: "Processing",
    textCls: "text-blue-600 dark:text-blue-400",
    bgCls: "bg-blue-50 dark:bg-blue-950/30",
    dotCls: "bg-blue-500 animate-pulse",
  },
  paused: {
    label: "Paused",
    textCls: "text-orange-600 dark:text-orange-400",
    bgCls: "bg-orange-50 dark:bg-orange-950/30",
    dotCls: "bg-orange-500",
  },
  error: {
    label: "Error – retrying",
    textCls: "text-red-600 dark:text-red-400",
    bgCls: "bg-red-50 dark:bg-red-950/30",
    dotCls: "bg-red-500 animate-pulse",
  },
};

function getContentSummary(content: PosPrintData[]): string {
  if (!Array.isArray(content)) return "Invalid content";
  const text = content.filter((i) => i.type === "text").length;
  const img = content.filter((i) => i.type === "image").length;
  const tbl = content.filter((i) => i.type === "table").length;
  const other = content.length - text - img - tbl;
  const parts: string[] = [];
  if (text) parts.push(`${text} text`);
  if (img) parts.push(`${img} image`);
  if (tbl) parts.push(`${tbl} table`);
  if (other) parts.push(`${other} other`);
  return parts.join(", ") + ` item${content.length !== 1 ? "s" : ""}`;
}

function renderPrintContent(content: PosPrintData[]) {
  if (!Array.isArray(content)) return null;
  return content.map((item, index) => {
    if (item.type === "text") {
      return (
        <div key={index} className="mb-2">
          <div className="text-sm font-mono bg-muted px-3 py-2 rounded border-l-4 border-l-primary">
            {item.value}
          </div>
        </div>
      );
    } else if (item.type === "image") {
      return (
        <div key={index} className="mb-2">
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2 rounded border-l-4 border-l-primary">
            <Package className="h-4 w-4" />
            <span>Image: {item.path || "Base64 image"}</span>
          </div>
        </div>
      );
    } else if (item.type === "table") {
      return (
        <div key={index} className="mb-2">
          <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded border-l-4 border-l-emerald-400">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Table Data</span>
            </div>
            {item.tableHeader && (
              <div className="text-xs text-muted-foreground">
                Headers: {item.tableHeader.join(", ")}
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={index} className="mb-2">
        <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded border-l-4 border-l-border">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="h-4 w-4" />
            <span className="font-medium">Type: {item.type}</span>
          </div>
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(item, null, 2)}
          </pre>
        </div>
      </div>
    );
  });
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
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* ── Queue header ── */}
      <div
        className={`px-4 py-3 flex items-center justify-between ${cfg.bgCls}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Printer className={`h-5 w-5 flex-shrink-0 ${cfg.textCls}`} />
          <span className={`font-semibold text-base truncate ${cfg.textCls}`}>
            {queue.printerName}
          </span>

          {/* Status badge */}
          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-current flex-shrink-0 ${cfg.textCls}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotCls}`} />
            {cfg.label}
          </div>

          {/* Error detail */}
          {queue.status === "error" && queue.lastError && (
            <div
              className={`hidden sm:flex items-center gap-1 text-xs ${cfg.textCls}`}
            >
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-xs">{queue.lastError}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {queue.jobs.length} job{queue.jobs.length !== 1 ? "s" : ""}
          </span>

          <button
            onClick={() => setOpen((v) => !v)}
            className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${cfg.textCls}`}
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          {queue.isEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause(queue.printerName)}
              className="h-7 px-2 text-xs border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
            >
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResume(queue.printerName)}
              className="h-7 px-2 text-xs border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
            >
              <Play className="h-3 w-3 mr-1" />
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* ── Job list ── */}
      {open &&
        (queue.jobs.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic">
            No pending jobs
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {queue.jobs.map((job, idx) => {
              const isActive = job.id != null && job.id === queue.currentJobId;
              return (
                <li
                  key={job.id ?? idx}
                  className={`text-sm transition-colors ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  }`}
                >
                  {/* Summary row */}
                  <div className="flex items-center justify-between px-4 py-2 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {isActive ? (
                        <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin flex-shrink-0" />
                      ) : (
                        <span className="h-3.5 w-3.5 flex-shrink-0 text-xs text-center text-gray-400">
                          {idx + 1}
                        </span>
                      )}
                      <span className="font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                        Job #{job.id ?? "?"}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs truncate">
                        {getContentSummary(job.content)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                        {new Date(job.created_at).toLocaleTimeString()}
                      </span>
                      <DeletePrintQueue
                        print={job}
                        onDeleted={() =>
                          job.id != null &&
                          onJobDeleted(queue.printerName, job.id)
                        }
                      />
                    </div>
                  </div>

                  {/* Collapsible content detail */}
                  <details className="group px-4 pb-2">
                    <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 list-none flex items-center gap-1">
                      <svg
                        className="h-3 w-3 transform group-open:rotate-90 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      View content
                    </summary>
                    <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      {renderPrintContent(job.content)}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}

// ── PrintQueue ────────────────────────────────────────────────────────────────

export function PrintQueue({ token }: Props) {
  const [queues, setQueues] = useState<PrinterQueueState[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const managerRef = useRef<QueueManager | null>(null);
  const isHandlerRegistered = useRef(false);

  // Create manager once (stable across renders)
  if (!managerRef.current) {
    const mgr = new QueueManager();
    mgr.onQueuesChange(setQueues);
    managerRef.current = mgr;
  }

  const fetchAndSync = useCallback(async () => {
    try {
      const res = await requestDatabase<{ result: table_print_queue[] }>(
        "/api/print-queue",
        "GET",
      );
      managerRef.current?.sync(res.result);
    } catch (err) {
      console.error("Failed to fetch print queue:", err);
    }
  }, []);

  // Register cron listener once; run initial fetch
  useEffect(() => {
    if (!token || isHandlerRegistered.current) return;

    // Re-attach listener every time the effect runs (handles React StrictMode
    // double-invocation where destroy() would have nullified it).
    managerRef.current!.onQueuesChange(setQueues);

    backend.onCronEvent(() => {
      console.log("Cron → syncing queues");
      fetchAndSync();
    });
    isHandlerRegistered.current = true;
    fetchAndSync();

    return () => {
      isHandlerRegistered.current = false;
    };
  }, [token, fetchAndSync]);

  const handlePause = useCallback(
    (name: string) => managerRef.current?.pause(name),
    [],
  );
  const handleResume = useCallback(
    (name: string) => managerRef.current?.resume(name),
    [],
  );
  const handleJobDeleted = useCallback(
    (printerName: string, jobId: number) =>
      managerRef.current?.removeJob(printerName, jobId),
    [],
  );

  const toggleGlobal = () => {
    if (globalEnabled) {
      managerRef.current?.pauseAll();
      setGlobalEnabled(false);
    } else {
      managerRef.current?.resumeAll();
      setGlobalEnabled(true);
    }
  };

  const totalJobs = queues.reduce((s, q) => s + q.jobs.length, 0);
  const activeCount = queues.filter((q) => q.status === "processing").length;

  return (
    <div className="w-full h-full bg-gradient-to-br from-emerald-50 via-background to-blue-50 dark:from-emerald-950/20 dark:via-background dark:to-blue-950/20 overflow-hidden">
      <div className="h-full flex flex-col p-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Printer className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">
                Queue Manager
              </h2>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                {queues.length} printer{queues.length !== 1 ? "s" : ""} ·{" "}
                {totalJobs} job{totalJobs !== 1 ? "s" : ""} pending
                {activeCount > 0 && ` · ${activeCount} active`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Global status pill */}
            <div
              className={`text-sm px-4 py-2 rounded-full border ${
                globalEnabled
                  ? "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                  : "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    globalEnabled
                      ? "bg-green-500 animate-pulse"
                      : "bg-orange-500"
                  }`}
                />
                <span className="font-medium">
                  {globalEnabled ? "Running" : "Paused"}
                </span>
              </div>
            </div>

            {/* Total count */}
            <div className="text-sm text-emerald-700 bg-emerald-100 px-4 py-2 rounded-full border border-emerald-200">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                <span className="font-medium">{totalJobs} items</span>
              </div>
            </div>

            {/* Global pause / resume */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleGlobal}
              className={`border-2 ${
                globalEnabled
                  ? "border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  : "border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
              }`}
            >
              {globalEnabled ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause All
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume All
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchAndSync}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Per-printer queues ── */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {queues.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-medium text-emerald-700 mb-2">
                All caught up!
              </h3>
              <p className="text-emerald-600">No print jobs in queue</p>
            </div>
          ) : (
            queues.map((queue) => (
              <PrinterQueueCard
                key={queue.printerName}
                queue={queue}
                onPause={handlePause}
                onResume={handleResume}
                onJobDeleted={handleJobDeleted}
              />
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            <Logout />
          </div>
          <PrintTestButton />
        </div>
      </div>
    </div>
  );
}
