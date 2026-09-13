import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  Save,
  FlaskConical,
  Printer,
  ChevronRight,
} from "lucide-react";
import { useToast } from "../ui/toast";
import { UpdateChecker } from "./update-checker";

interface Props {
  onSave?: () => void;
  embedded?: boolean;
}

type TestStatus = "idle" | "testing" | "success" | "failed";

export function ServerForm({ onSave, embedded = false }: Props) {
  const [endpoint, setEndpoint] = useState("");
  const [socketAuthEnabled, setSocketAuthEnabled] = useState(false);
  const [socketToken, setSocketToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    const loadEndpoint = async () => {
      try {
        const storedEndpoint = localStorage.getItem("server-endpoint");
        setEndpoint(storedEndpoint || "");
        setSocketAuthEnabled(
          localStorage.getItem("socket-auth-enabled") === "true",
        );
        setSocketToken(localStorage.getItem("socket-token") || "");
      } catch (error) {
        console.error("Failed to load server endpoint:", error);
        showError("Configuration Error", "Failed to load saved configuration");
      } finally {
        setIsLoading(false);
      }
    };
    loadEndpoint();
  }, [showError]);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleTestConnection = async () => {
    if (!endpoint.trim() || !validateUrl(endpoint.trim())) {
      setTestStatus("failed");
      setTestMessage("Enter a valid URL before testing.");
      return;
    }
    setTestStatus("testing");
    setTestMessage("");
    try {
      const response = await fetch(`${endpoint.trim()}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        setTestStatus("success");
        setTestMessage("Server reachable — connection successful.");
      } else {
        setTestStatus("failed");
        setTestMessage(`Server responded with HTTP ${response.status}.`);
      }
    } catch {
      setTestStatus("failed");
      setTestMessage("Unable to reach server. Check URL or network.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpoint.trim()) {
      showError("Validation Error", "Please enter a server endpoint");
      return;
    }
    if (!validateUrl(endpoint.trim())) {
      showError(
        "Invalid URL",
        "Please enter a valid URL (e.g., https://example.com)",
      );
      return;
    }
    if (socketAuthEnabled && !socketToken.trim()) {
      showError(
        "Token Required",
        "Enter a token or turn off 'Require token for devices'",
      );
      return;
    }
    setIsSaving(true);
    try {
      localStorage.setItem("server-endpoint", endpoint.trim());
      localStorage.setItem(
        "socket-auth-enabled",
        socketAuthEnabled ? "true" : "false",
      );
      localStorage.setItem("socket-token", socketToken.trim());
      if (backend.setSocketConfig) {
        await backend.setSocketConfig({
          authEnabled: socketAuthEnabled,
          token: socketToken.trim(),
        });
      }
      showSuccess(
        "Configuration Saved",
        "Server endpoint updated successfully",
      );
      setTimeout(() => {
        onSave?.();
      }, 1200);
    } catch (error) {
      console.error("Failed to save server endpoint:", error);
      showError("Save Failed", "Failed to save server configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SetupShell embedded={embedded}>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">
            Loading configuration…
          </span>
        </div>
      </SetupShell>
    );
  }

  const testColors: Record<TestStatus, string> = {
    idle: "",
    testing: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    failed: "text-destructive",
  };

  const TestIcon =
    testStatus === "testing"
      ? Loader2
      : testStatus === "success"
        ? CheckCircle2
        : testStatus === "failed"
          ? XCircle
          : null;

  return (
    <SetupShell embedded={embedded}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* API Server URL */}
        <div className="space-y-1.5">
          <Label
            htmlFor="endpoint"
            className="text-[13px] font-medium text-foreground"
          >
            API Server URL
          </Label>
          <div className="relative">
            <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              id="endpoint"
              type="url"
              placeholder="https://api.yourserver.com"
              value={endpoint}
              onChange={(e) => {
                setEndpoint(e.target.value);
                setTestStatus("idle");
                setTestMessage("");
              }}
              className="pl-9 h-9 text-[13px] font-mono"
              autoComplete="url"
            />
          </div>
          <p className="text-[12px] text-muted-foreground">
            The base URL of your restaurant POS API server.
          </p>
        </div>

        {/* Connection test result banner */}
        {testStatus !== "idle" && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-[12px] border ${
              testStatus === "success"
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                : testStatus === "failed"
                  ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                  : "bg-secondary border-border"
            }`}
          >
            {TestIcon && (
              <TestIcon
                className={`w-4 h-4 flex-shrink-0 ${testColors[testStatus]} ${
                  testStatus === "testing" ? "animate-spin" : ""
                }`}
              />
            )}
            <span className={testColors[testStatus]}>
              {testStatus === "testing" ? "Testing connection…" : testMessage}
            </span>
          </div>
        )}

        {/* Auto-reconnect toggle row */}
        <label
          htmlFor="auto-reconnect"
          className="flex items-center justify-between py-2.5 px-3 rounded-md bg-secondary border border-border cursor-pointer hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Wifi className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-[13px] font-medium text-foreground leading-tight">
                Auto-reconnect
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Automatically retry if connection drops
              </p>
            </div>
          </div>
          <input
            id="auto-reconnect"
            type="checkbox"
            defaultChecked
            className="w-4 h-4 accent-primary cursor-pointer"
          />
        </label>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testStatus === "testing" || !endpoint.trim()}
            className="flex-1 h-9 text-[13px] gap-1.5"
          >
            {testStatus === "testing" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FlaskConical className="w-3.5 h-3.5" />
            )}
            Test Connection
          </Button>
          <Button
            type="submit"
            disabled={isSaving || !endpoint.trim()}
            className="flex-1 h-9 text-[13px] gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {embedded ? "Save Changes" : "Save & Continue"}
            {!embedded && !isSaving && (
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            )}
          </Button>
        </div>

        {/* Device access security — settings/embedded mode only */}
        {embedded && (
          <div className="pt-3 border-t border-border space-y-3">
            <div>
              <p className="text-[13px] font-medium text-foreground">
                Device access security
              </p>
              <p className="text-[11px] text-muted-foreground">
                Require devices to send a token when connecting to the print
                server.
              </p>
            </div>
            <label
              htmlFor="socket-auth"
              className="flex items-center justify-between py-2.5 px-3 rounded-md bg-secondary border border-border cursor-pointer hover:bg-muted transition-colors"
            >
              <span className="text-[13px] text-foreground">Require token</span>
              <input
                id="socket-auth"
                type="checkbox"
                checked={socketAuthEnabled}
                onChange={(e) => {
                  setSocketAuthEnabled(e.target.checked);
                  if (e.target.checked && !socketToken.trim()) {
                    setSocketToken(
                      `SHOP-${Math.floor(1000 + Math.random() * 9000)}`,
                    );
                  }
                }}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </label>
            {socketAuthEnabled && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="socket-token"
                  className="text-[13px] font-medium text-foreground"
                >
                  Token
                </Label>
                <Input
                  id="socket-token"
                  type="text"
                  value={socketToken}
                  onChange={(e) => setSocketToken(e.target.value)}
                  placeholder="SHOP-1234"
                  className="h-9 text-[13px] font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Device URL becomes{" "}
                  <code className="font-mono">
                    ws://&lt;pc-ip&gt;:8181/?token={socketToken || "…"}
                  </code>
                </p>
              </div>
            )}
          </div>
        )}

        {/* App updates — only in settings/embedded mode */}
        {embedded && <UpdateChecker />}

        {/* Danger zone — only in settings/embedded mode */}
        {embedded && (
          <div className="pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Reset server configuration? You will need to set up again.",
                  )
                ) {
                  localStorage.removeItem("server-endpoint");
                  localStorage.removeItem("token");
                  window.location.reload();
                }
              }}
              className="flex items-center gap-1.5 text-[12px] text-destructive hover:underline"
            >
              <WifiOff className="w-3.5 h-3.5" />
              Reset server &amp; logout
            </button>
          </div>
        )}
      </form>
    </SetupShell>
  );
}

/* ── Contextual layout wrapper ─────────────────────────────────────────── */

function SetupShell({
  embedded,
  children,
}: {
  embedded: boolean;
  children: React.ReactNode;
}) {
  if (embedded) {
    return (
      <div className="p-6 max-w-xl">
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold text-foreground mb-0.5">
            Server Configuration
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Configure the API server endpoint for this printer station.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/25">
            <Printer className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight mb-1">
            Printer Manager
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Restaurant POS · Initial Setup
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold text-foreground mb-0.5">
              Connect to API Server
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Enter the address of your restaurant POS backend.
            </p>
          </div>
          {children}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-5">
          Printer Manager v1.1.0
        </p>
      </div>
    </div>
  );
}
