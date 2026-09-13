import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  DownloadCloud,
  RotateCcw,
} from "lucide-react";

type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloaded"
  | "error"
  | "unsupported";

export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!backend.onUpdateStatus) return;
    const unsubscribe = backend.onUpdateStatus(({ state: s, message: m }) => {
      setState(s);
      setMessage(m ?? "");
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleCheck = async () => {
    setState("checking");
    setMessage("");
    try {
      const result = await backend.checkForUpdates();
      if (!result.ok) {
        setState(
          result.message?.toLowerCase().includes("platform")
            ? "unsupported"
            : "error",
        );
        setMessage(result.message ?? "Unable to check for updates.");
      }
    } catch {
      setState("error");
      setMessage("Unable to check for updates.");
    }
  };

  const handleInstall = async () => {
    await backend.installUpdate();
  };

  const statusColors: Record<UpdateState, string> = {
    idle: "",
    checking: "text-primary",
    available: "text-primary",
    "not-available": "text-emerald-600 dark:text-emerald-400",
    downloaded: "text-emerald-600 dark:text-emerald-400",
    error: "text-destructive",
    unsupported: "text-muted-foreground",
  };

  const StatusIcon =
    state === "checking" || state === "available"
      ? Loader2
      : state === "not-available"
        ? CheckCircle2
        : state === "downloaded"
          ? DownloadCloud
          : state === "error"
            ? XCircle
            : null;

  return (
    <div className="pt-3 border-t border-border space-y-3">
      <div>
        <p className="text-[13px] font-medium text-foreground">App updates</p>
        <p className="text-[11px] text-muted-foreground">
          Currently on v{__APP_VERSION__}. Checks automatically every hour —
          or check right now.
        </p>
      </div>

      {state !== "idle" && (message || StatusIcon) && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-[12px] border ${
            state === "not-available" || state === "downloaded"
              ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
              : state === "error"
                ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                : "bg-secondary border-border"
          }`}
        >
          {StatusIcon && (
            <StatusIcon
              className={`w-4 h-4 flex-shrink-0 ${statusColors[state]} ${
                state === "checking" || state === "available"
                  ? "animate-spin"
                  : ""
              }`}
            />
          )}
          <span className={statusColors[state]}>
            {state === "checking"
              ? "Checking for updates…"
              : state === "available"
                ? message || "Update found, downloading…"
                : message}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCheck}
          disabled={state === "checking" || state === "available"}
          className="flex-1 h-9 text-[13px] gap-1.5"
        >
          {state === "checking" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Check for Updates
        </Button>
        {state === "downloaded" && (
          <Button
            type="button"
            onClick={handleInstall}
            className="flex-1 h-9 text-[13px] gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart &amp; Install
          </Button>
        )}
      </div>
    </div>
  );
}
