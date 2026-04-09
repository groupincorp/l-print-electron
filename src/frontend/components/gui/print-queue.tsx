/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import { printLock } from "@/lib/print-lock";
import { requestDatabase } from "@/server/request-api";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
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

// Helper function to render print content in a user-friendly way
const renderPrintContent = (content: PosPrintData[]) => {
  if (!Array.isArray(content)) return null;

  return content.map((item, index) => {
    if (item.type === "text") {
      return (
        <div key={index} className="mb-2">
          <div className="text-sm font-mono bg-muted px-3 py-2 rounded border-l-4 border-l-primary">
            {item.value}
          </div>
          {item.style && (
            <div className="text-xs text-muted-foreground mt-1 ml-3">
              Style: {JSON.stringify(item.style, null, 2)}
            </div>
          )}
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
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Table Data</span>
            </div>
            {item.tableHeader && (
              <div className="text-xs text-muted-foreground mb-1">
                Headers: {item.tableHeader.join(", ")}
              </div>
            )}
            {item.tableBody && (
              <div className="text-xs text-muted-foreground">
                Rows: {item.tableBody.length}
              </div>
            )}
          </div>
        </div>
      );
    } else {
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
    }
  });
};

// Helper function to get print job status
const getPrintJobStatus = (createdAt: string) => {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMinutes = Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60),
  );

  if (diffMinutes < 2) {
    return {
      status: "processing",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      icon: RefreshCw,
    };
  } else if (diffMinutes < 5) {
    return {
      status: "pending",
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
      icon: Clock,
    };
  } else {
    return {
      status: "delayed",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      icon: AlertTriangle,
    };
  }
};

// Helper function to extract useful summary from content
const getContentSummary = (content: PosPrintData[]) => {
  if (!Array.isArray(content)) return "Invalid content";

  const textItems = content.filter((item) => item.type === "text").length;
  const imageItems = content.filter((item) => item.type === "image").length;
  const tableItems = content.filter((item) => item.type === "table").length;
  const otherItems = content.length - textItems - imageItems - tableItems;

  const parts = [];
  if (textItems > 0) parts.push(`${textItems} text`);
  if (imageItems > 0) parts.push(`${imageItems} image`);
  if (tableItems > 0) parts.push(`${tableItems} table`);
  if (otherItems > 0) parts.push(`${otherItems} other`);

  return parts.join(", ") + ` item${content.length !== 1 ? "s" : ""}`;
};

export function PrintQueue(props: Props) {
  const [printers, setPrinters] = useState<table_print_queue[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(true);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const isHandlerRegistered = useRef(false);
  const isProcessing = useRef(false);
  const queueIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to process print queue - Fixed to prevent duplicates
  const processQueue = useCallback(async () => {
    if (isProcessing.current || !isQueueRunning) {
      return;
    }

    isProcessing.current = true;

    try {
      const res = (await requestDatabase(`/api/print-queue`, "GET")) as {
        result: table_print_queue[];
      };

      setPrinters(res.result);

      // Process print jobs ONE AT A TIME to prevent duplicates
      if (res && res.result && res.result.length > 0) {
        if (!isQueueRunning) {
          isProcessing.current = false;
          return;
        }

        console.log(
          `Processing ${res.result.length} print jobs sequentially...`,
        );

        // Process jobs one by one instead of all at once
        for (const item of res.result) {
          const jobId = item.id;

          if (!jobId) {
            console.warn("Job has no ID, skipping...");
            continue;
          }

          // Try to acquire lock for this job
          if (!printLock.tryLock(jobId)) {
            console.log(
              `Job #${jobId} is already being processed, skipping...`,
            );
            continue;
          }

          try {
            // Double-check if job still exists before processing
            try {
              const currentQueue = (await requestDatabase(
                `/api/print-queue`,
                "GET",
              )) as {
                result: table_print_queue[];
              };

              const jobStillExists = currentQueue.result.some(
                (job) => job.id === jobId,
              );
              if (!jobStillExists) {
                console.log(`Job #${jobId} already processed, skipping...`);
                continue;
              }
            } catch (checkError) {
              console.error(
                `Error checking job #${jobId} existence:`,
                checkError,
              );
              continue;
            }

            setProcessingJobId(String(jobId));

            const printInfo: PosPrintData[] = item.content;
            const printOption: PosPrintOptions = {
              preview: false,
              margin: "0 0 0 0",
              copies: 1,
              printerName: item.printer_info.printer_name,
              timeOutPerLine: 400,
              silent: true,
              pageSize: "80mm",
              boolean: true,
            };

            console.log(
              `Processing print job #${jobId} for printer: ${item.printer_info.printer_name}`,
            );

            const ids =
              typeof jobId === "string"
                ? String(jobId)
                    .split(",")
                    .map((x) => Number(x))
                : [jobId];

            // Print the job
            const response = await backend.printJob(printInfo, printOption);
            console.log(`Print job #${jobId} response:`, response);

            // Only remove from queue if print was successful
            if (response) {
              await requestDatabase("/api/print-queue/delete", "DELETE", {
                ids: [...ids],
              });

              console.log(
                `Successfully completed and removed print job #${jobId}`,
              );

              // Update local state immediately
              setPrinters((prev) => prev.filter((p) => p.id !== jobId));
            } else {
              console.warn(`Print job #${jobId} failed, keeping in queue`);
            }

            // Add a small delay between jobs to prevent overwhelming the printer
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (err) {
            console.error(`Error printing job #${jobId}:`, err);
            // Don't remove failed jobs from queue, they will be retried
          } finally {
            // Always release the lock
            printLock.release(jobId);
          }
        }

        setProcessingJobId(null);
        console.log(`Completed processing all print jobs sequentially`);
      }
    } catch (error) {
      console.log("Error fetching print queue:", error);
    } finally {
      isProcessing.current = false;
      setProcessingJobId(null);
    }
  }, [isQueueRunning]);

  // Start queue loop - Fixed to prevent overlapping executions
  const startQueueLoop = useCallback(() => {
    if (queueIntervalRef.current) {
      clearInterval(queueIntervalRef.current);
    }

    // Set up interval with longer delay to prevent rapid firing
    if (!isProcessing.current) {
      processQueue();
    } else {
      console.log("Skipping queue processing - already in progress");
    }

    // Run immediately once
    processQueue();
  }, [processQueue]);

  // Stop queue loop
  const stopQueueLoop = useCallback(() => {
    if (queueIntervalRef.current) {
      clearInterval(queueIntervalRef.current);
      queueIntervalRef.current = null;
    }
  }, []);

  // Toggle queue running state
  const toggleQueue = () => {
    setIsQueueRunning(!isQueueRunning);
  };

  useEffect(() => {
    if (props.token && !isHandlerRegistered.current) {
      const handler = async () => {
        // Only process if not already processing and queue is running
        if (!isProcessing.current && isQueueRunning) {
          console.log("Cron event triggered - processing queue");
          await processQueue();
        } else {
          console.log(
            "Cron event triggered - skipping (already processing or queue paused)",
          );
        }
      };

      backend.onCronEvent(handler);
      isHandlerRegistered.current = true;

      // Start the queue loop only if queue is running
      if (isQueueRunning) {
        startQueueLoop();
      }

      // Cleanup function
      return () => {
        isHandlerRegistered.current = false;
        isProcessing.current = false;
        setProcessingJobId(null);
        stopQueueLoop();
        // Clear any stale locks when component unmounts
        printLock.clearAll();
      };
    }
  }, [
    props.token,
    isQueueRunning,
    processQueue,
    startQueueLoop,
    stopQueueLoop,
  ]);

  // Effect to handle queue running state changes
  useEffect(() => {
    if (isQueueRunning) {
      startQueueLoop();
    } else {
      stopQueueLoop();
    }

    return () => {
      stopQueueLoop();
    };
  }, [isQueueRunning, startQueueLoop, stopQueueLoop]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-emerald-50 via-background to-blue-50 dark:from-emerald-950/20 dark:via-background dark:to-blue-950/20 overflow-hidden">
      <div className="h-full flex flex-col p-6">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Printer className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">
                Print Queue
              </h2>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                Monitor and manage your print jobs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Queue Status Indicator */}
            <div
              className={`text-sm px-4 py-2 rounded-full border ${
                isQueueRunning
                  ? "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                  : "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {isQueueRunning ? (
                  <div className="h-2 w-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse" />
                ) : (
                  <div className="h-2 w-2 bg-orange-500 dark:bg-orange-400 rounded-full" />
                )}
                <span className="font-medium">
                  {isQueueRunning ? "Running" : "Paused"}
                </span>
              </div>
            </div>

            <div className="text-sm text-emerald-700 bg-emerald-100 px-4 py-2 rounded-full border border-emerald-200">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                <span className="font-medium">
                  {printers ? printers.length : 0} items
                </span>
              </div>
            </div>

            {/* Queue Control Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleQueue}
              className={`border-2 ${
                isQueueRunning
                  ? "border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  : "border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
              }`}
            >
              {isQueueRunning ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Queue
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Queue
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Queue Content */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {printers && printers.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-medium text-emerald-700 mb-2">
                All caught up!
              </h3>
              <p className="text-emerald-600">
                No print jobs in queue at the moment
              </p>
            </div>
          ) : (
            printers &&
            printers.map((printer, index) => {
              const jobStatus = getPrintJobStatus(printer.created_at);
              const StatusIcon = jobStatus.icon;
              const contentSummary = getContentSummary(printer.content);
              const isCurrentlyProcessing =
                String(processingJobId) === String(printer.id);

              return (
                <div
                  key={printer.id || index}
                  className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
                    isCurrentlyProcessing
                      ? "border-blue-300 ring-2 ring-blue-100"
                      : "border-gray-200"
                  }`}
                >
                  {/* Job Header */}
                  <div
                    className={`p-4 border-b ${
                      isCurrentlyProcessing
                        ? "border-blue-100 bg-blue-50"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isCurrentlyProcessing
                                ? "bg-blue-100"
                                : jobStatus.bgColor
                            }`}
                          >
                            {isCurrentlyProcessing ? (
                              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                            ) : (
                              <StatusIcon
                                className={`h-5 w-5 ${jobStatus.color}`}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Printer className="h-4 w-4 text-gray-400" />
                              <span className="text-lg font-semibold text-gray-900 truncate">
                                {printer.printer_info?.name ||
                                  printer.printer_info?.printer_name ||
                                  "Unknown Printer"}
                              </span>
                            </div>
                            <div
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                isCurrentlyProcessing
                                  ? "bg-blue-100 text-blue-700"
                                  : `${jobStatus.bgColor} ${jobStatus.color}`
                              }`}
                            >
                              <span className="capitalize">
                                {isCurrentlyProcessing
                                  ? "Printing..."
                                  : jobStatus.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ...existing code for job details... */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <DeletePrintQueue
                              print={printer}
                              onDeleted={() => {
                                setPrinters((prev) =>
                                  prev.filter((p) => p.id !== printer.id),
                                );
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">Date:</span>
                            <span className="text-gray-900">
                              {new Date(
                                printer.created_at,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Time:</span>
                            <span className="text-gray-900">
                              {new Date(
                                printer.created_at,
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <div className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                          <div className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            <span className="font-medium">
                              #{printer.id || index + 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content Summary */}
                  <div className="p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Content Summary
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {contentSummary}
                    </p>

                    {/* Detailed Content */}
                    <div className="space-y-2">
                      <details className="group">
                        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                          <span>View detailed content</span>
                          <svg
                            className="h-4 w-4 transform group-open:rotate-180 transition-transform"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </summary>
                        <div className="mt-3 pl-4 border-l-2 border-gray-200">
                          {renderPrintContent(printer.content)}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

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
