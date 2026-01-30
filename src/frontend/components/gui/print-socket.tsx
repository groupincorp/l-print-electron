import { useEffect, useState, useRef } from "react";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  Terminal,
  Copy,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "error" | "warning" | "success";
}

export function PrintSocket() {
  const [status, setStatus] = useState("Server not started");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const maxLogs = 1000; // Limit logs to prevent memory issues
  const { showSuccess, showError, showInfo } = useToast();

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    backend.onStatus((msg) => {
      setStatus(msg);
      // Determine connection status based on message
      setIsConnected(
        msg.toLowerCase().includes("connected") ||
          msg.toLowerCase().includes("running") ||
          msg.toLowerCase().includes("started"),
      );

      // Add status change to logs
      addLog(msg, "info");
    });

    backend.onLog((msg) => {
      // Parse log level from message if possible
      const level = getLogLevel(msg);
      addLog(msg, level);
    });
  }, []);

  const addLog = (
    message: string,
    level: "info" | "error" | "warning" | "success" = "info",
  ) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      level,
    };

    setLogs((prev) => {
      const updated = [...prev, newLog];
      // Keep only the last maxLogs entries
      return updated.length > maxLogs ? updated.slice(-maxLogs) : updated;
    });
  };

  const getLogLevel = (
    message: string,
  ): "info" | "error" | "warning" | "success" => {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("error") || lowerMsg.includes("failed"))
      return "error";
    if (lowerMsg.includes("warning") || lowerMsg.includes("warn"))
      return "warning";
    if (
      lowerMsg.includes("success") ||
      lowerMsg.includes("connected") ||
      lowerMsg.includes("completed")
    )
      return "success";
    return "info";
  };

  const getStatusIcon = () => {
    if (isConnected) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (
      status.toLowerCase().includes("error") ||
      status.toLowerCase().includes("failed")
    ) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (
      status.toLowerCase().includes("connecting") ||
      status.toLowerCase().includes("starting")
    ) {
      return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    return <Clock className="h-5 w-5 text-gray-500" />;
  };

  const getStatusVariant = () => {
    if (isConnected)
      return "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300";
    if (
      status.toLowerCase().includes("error") ||
      status.toLowerCase().includes("failed")
    ) {
      return "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300";
    }
    if (
      status.toLowerCase().includes("connecting") ||
      status.toLowerCase().includes("starting")
    ) {
      return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300";
    }
    return "bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-950/30 dark:border-gray-800 dark:text-gray-300";
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Terminal className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLogStyles = (level: string) => {
    switch (level) {
      case "error":
        return "border-l-red-500 bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-300";
      case "warning":
        return "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-300";
      case "success":
        return "border-l-green-500 bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-300";
      default:
        return "border-l-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300";
    }
  };

  const clearLogs = () => {
    setLogs([]);
    showInfo("Logs Cleared", `Cleared ${logs.length} log entries`);
  };

  const copyLogsToClipboard = async () => {
    try {
      const logText = logs
        .map((log) => `[${log.timestamp}] ${log.message}`)
        .join("\n");
      await navigator.clipboard.writeText(logText);
      showSuccess("Copied to Clipboard", `${logs.length} log entries copied`);
    } catch {
      showError("Copy Failed", "Could not copy logs to clipboard");
    }
  };

  const exportLogs = () => {
    try {
      const logText = logs
        .map(
          (log) =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`,
        )
        .join("\n");
      const blob = new Blob([logText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `socket-logs-${new Date().toISOString().split("T")[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(
        "Export Complete",
        `${logs.length} log entries exported to file`,
      );
    } catch {
      showError("Export Failed", "Could not export logs to file");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Status Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Terminal className="h-6 w-6" />
          Socket Connection Status
        </h2>

        <div className={`p-4 rounded-lg border-2 ${getStatusVariant()}`}>
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <span className="font-medium text-lg">{status}</span>
          </div>
        </div>
      </div>

      {/* Logs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Activity Logs
            <span className="text-sm font-normal text-muted-foreground">
              ({logs.length} {logs.length === 1 ? "entry" : "entries"})
            </span>
          </h3>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyLogsToClipboard}
              disabled={logs.length === 0}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        <div className="border rounded-lg bg-card">
          <div className="max-h-96 overflow-y-auto p-4 space-y-2 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                No logs available yet...
              </div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded border-l-4 ${getLogStyles(log.level)}`}
                >
                  <div className="flex items-start gap-2">
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold opacity-75">
                          {log.timestamp}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-black/10 dark:bg-white/10">
                          {log.level.toUpperCase()}
                        </span>
                      </div>
                      <div className="break-words">{log.message}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
