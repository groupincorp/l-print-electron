import { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Trash2,
  Terminal,
  Copy,
  Download,
  Wifi,
  WifiOff,
  MonitorSmartphone,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TestPrintProductLot } from "./test-print-product-lot";

interface SocketInfo {
  running: boolean;
  host: string;
  port: number;
  addresses: string[];
  authEnabled: boolean;
  clientCount: number;
  clientIps: string[];
}

interface ConnectedClient {
  id: string;
  ip: string;
  connectedAt: number;
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "error" | "warning" | "success";
}

interface PrintSocketProps {
  onConnectionChange?: (connected: boolean) => void;
}

const LOG_LEVEL_CFG = {
  error: {
    icon: XCircle,
    row: "bg-red-50/50 dark:bg-red-950/10 border-l-2 border-l-red-500",
    text: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "ERROR",
  },
  warning: {
    icon: AlertCircle,
    row: "bg-amber-50/50 dark:bg-amber-950/10 border-l-2 border-l-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "WARN",
  },
  success: {
    icon: CheckCircle2,
    row: "bg-emerald-50/50 dark:bg-emerald-950/10 border-l-2 border-l-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "OK",
  },
  info: {
    icon: Terminal,
    row: "hover:bg-secondary/40 border-l-2 border-l-transparent",
    text: "text-foreground",
    badge: "bg-secondary text-muted-foreground",
    label: "INFO",
  },
};

export function PrintSocket({ onConnectionChange }: PrintSocketProps) {
  const [status, setStatus] = useState("Server not started");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socketInfo, setSocketInfo] = useState<SocketInfo | null>(null);
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [firewallStatus, setFirewallStatus] = useState<
    "allowed" | "missing" | "unknown" | "checking"
  >("checking");
  const [addingRule, setAddingRule] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const maxLogs = 1000;
  const { showSuccess, showError, showInfo } = useToast();

  const storedToken =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("socket-token")) ||
    "";

  const buildUrl = useCallback(
    (ip: string) => {
      const base = `ws://${ip}:${socketInfo?.port ?? 8181}`;
      return socketInfo?.authEnabled && storedToken
        ? `${base}/?token=${encodeURIComponent(storedToken)}`
        : base;
    },
    [socketInfo?.port, socketInfo?.authEnabled, storedToken],
  );

  const refreshSocketInfo = useCallback(async () => {
    try {
      const info = await backend.getSocketInfo();
      setSocketInfo(info);
    } catch (err) {
      console.error("Failed to load socket info:", err);
    }
  }, []);

  const refreshFirewall = useCallback(async () => {
    try {
      const s = await backend.getFirewallStatus?.();
      setFirewallStatus(s ?? "unknown");
    } catch {
      setFirewallStatus("unknown");
    }
  }, []);

  useEffect(() => {
    refreshSocketInfo();
    refreshFirewall();
    backend.onSocketClients?.((data) => {
      setClients(data.clients);
    });
  }, [refreshSocketInfo, refreshFirewall]);

  const handleAddFirewallRule = useCallback(async () => {
    setAddingRule(true);
    try {
      const result = await backend.addFirewallRule();
      if (result.ok) {
        showSuccess("Firewall updated", result.message);
        setFirewallStatus("allowed");
      } else {
        showError("Firewall not updated", result.message);
      }
      await refreshFirewall();
    } catch {
      showError("Firewall not updated", "Could not run the firewall command.");
    } finally {
      setAddingRule(false);
    }
  }, [refreshFirewall, showSuccess, showError]);

  const primaryUrl = socketInfo?.addresses?.[0]
    ? buildUrl(socketInfo.addresses[0])
    : null;

  useEffect(() => {
    if (!primaryUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(primaryUrl, { width: 160, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [primaryUrl]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    backend.onStatus((msg) => {
      setStatus(msg);
      const connected =
        msg.toLowerCase().includes("connected") ||
        msg.toLowerCase().includes("running") ||
        msg.toLowerCase().includes("started");
      setIsConnected(connected);
      onConnectionChange?.(connected);
      addLog(msg, "info");
      refreshSocketInfo();
    });

    backend.onLog((msg) => {
      addLog(msg, getLogLevel(msg));
    });
  }, [onConnectionChange, refreshSocketInfo]);

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
      return updated.length > maxLogs ? updated.slice(-maxLogs) : updated;
    });
  };

  const getLogLevel = (
    message: string,
  ): "info" | "error" | "warning" | "success" => {
    const m = message.toLowerCase();
    if (m.includes("error") || m.includes("failed")) return "error";
    if (m.includes("warning") || m.includes("warn")) return "warning";
    if (
      m.includes("success") ||
      m.includes("connected") ||
      m.includes("completed")
    )
      return "success";
    return "info";
  };

  const clearLogs = () => {
    setLogs([]);
    showInfo("Logs Cleared", `Cleared log history`);
  };

  const copyLogsToClipboard = async () => {
    try {
      const text = logs.map((l) => `[${l.timestamp}] ${l.message}`).join("\n");
      await navigator.clipboard.writeText(text);
      showSuccess("Copied", `${logs.length} entries copied to clipboard`);
    } catch {
      showError("Copy Failed", "Could not access clipboard");
    }
  };

  const exportLogs = () => {
    try {
      const text = logs
        .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
        .join("\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `socket-logs-${new Date().toISOString().split("T")[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("Exported", `${logs.length} entries saved`);
    } catch {
      showError("Export Failed", "Could not export log file");
    }
  };

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warning").length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* ── Status panel ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Connection status card */}
          <div
            className={`col-span-1 sm:col-span-2 bg-card border rounded-xl p-4 ${
              isConnected
                ? "border-emerald-200 dark:border-emerald-800"
                : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 ${
                    isConnected
                      ? "bg-emerald-50 dark:bg-emerald-950/30"
                      : "bg-secondary"
                  }`}
                >
                  {isConnected ? (
                    <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-semibold text-foreground">
                      Socket Connection
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${
                        isConnected
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"
                          : "bg-secondary border-border text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isConnected
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-muted-foreground"
                        }`}
                      />
                      {isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground truncate">
                    {status}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Log stats card */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Log Summary
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">Total</span>
                <span className="text-[12px] font-semibold text-foreground">
                  {logs.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-amber-600 dark:text-amber-400">
                  Warnings
                </span>
                <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">
                  {warnCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-destructive">Errors</span>
                <span className="text-[12px] font-semibold text-destructive">
                  {errorCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Device connection ── */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MonitorSmartphone className="w-4 h-4 text-muted-foreground" />
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              Device Connection
            </p>
            {socketInfo?.authEnabled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                Token required
              </span>
            )}
          </div>

          {!socketInfo?.running ? (
            <p className="text-[12px] text-muted-foreground">
              Server not running. Sign in to start the print server.
            </p>
          ) : socketInfo.addresses.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              No network address found. Connect this PC to Wi-Fi or Ethernet.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <p className="text-[12px] text-muted-foreground">
                  On the device, set the printer server address to:
                </p>
                {socketInfo.addresses.map((ip) => {
                  const url = buildUrl(ip);
                  return (
                    <div
                      key={ip}
                      className="flex items-center gap-2 bg-secondary/50 border border-border rounded-md px-2.5 py-1.5"
                    >
                      <code className="flex-1 text-[12px] font-mono break-all text-foreground">
                        {url}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[11px] gap-1 flex-shrink-0"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(url);
                            showSuccess("Copied", url);
                          } catch {
                            showError("Copy failed", "Clipboard unavailable");
                          }
                        }}
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  The device must be on the same Wi-Fi as this PC.
                </p>

                {/* Firewall status / action */}
                {firewallStatus !== "unknown" && (
                  <div
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] ${
                      firewallStatus === "allowed"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"
                        : firewallStatus === "missing"
                          ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300"
                          : "bg-secondary border-border text-muted-foreground"
                    }`}
                  >
                    {firewallStatus === "checking" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                        Checking the firewall…
                      </>
                    ) : firewallStatus === "allowed" ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                        The firewall allows incoming connections.
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="flex-1">
                          The firewall is blocking incoming connections. Devices
                          on the network can't connect yet.
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[11px] gap-1 flex-shrink-0"
                          disabled={addingRule}
                          onClick={handleAddFirewallRule}
                        >
                          {addingRule ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-3 h-3" />
                          )}
                          Allow connections
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <div className="pt-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Connected devices: {clients.length || socketInfo.clientCount}
                  </span>
                  {(clients.length > 0 || socketInfo.clientIps.length > 0) && (
                    <ul className="mt-1 space-y-0.5">
                      {(clients.length > 0
                        ? clients.map((c) => c.ip)
                        : socketInfo.clientIps
                      ).map((ip, i) => (
                        <li
                          key={`${ip}-${i}`}
                          className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400"
                        >
                          ● {ip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {qrDataUrl && (
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <img
                    src={qrDataUrl}
                    alt="Server address QR code"
                    className="w-[140px] h-[140px] rounded-md border border-border bg-white p-1"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Scan on device
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Test print section ── */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Test Print
          </p>
          <TestPrintProductLot />
        </div>

        {/* ── Log viewer ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          {/* Log header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">
                Activity Log
              </span>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                {logs.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyLogsToClipboard}
                disabled={logs.length === 0}
                className="h-7 px-2 text-[12px] gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={exportLogs}
                disabled={logs.length === 0}
                className="h-7 px-2 text-[12px] gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearLogs}
                disabled={logs.length === 0}
                className="h-7 px-2 text-[12px] gap-1 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </Button>
            </div>
          </div>

          {/* Log entries */}
          <div className="h-[340px] overflow-y-auto font-mono">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <Clock className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-[13px] text-muted-foreground">
                  Waiting for socket events…
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  Logs will appear here in real time
                </p>
              </div>
            ) : (
              logs.map((log, idx) => {
                const cfg = LOG_LEVEL_CFG[log.level];
                const Icon = cfg.icon;
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 px-4 py-2 text-[12px] ${cfg.row}`}
                  >
                    <span className="text-[10px] text-muted-foreground/70 font-mono pt-0.5 flex-shrink-0 w-16">
                      {log.timestamp}
                    </span>
                    <span
                      className={`text-[10px] font-semibold pt-0.5 flex-shrink-0 w-8 ${cfg.text}`}
                    >
                      {cfg.label}
                    </span>
                    <Icon
                      className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${cfg.text}`}
                    />
                    <span
                      className={`flex-1 break-all leading-relaxed ${cfg.text}`}
                    >
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
