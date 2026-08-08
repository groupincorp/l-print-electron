import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Printer,
  Star,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "../ui/toast";

interface PrinterStatus {
  name: string;
  isDefault: boolean;
  isConnected: boolean;
  portName: string;
  isLocal: boolean;
  isNetwork: boolean;
  reasons: string[];
}

export function PrinterList() {
  const [printers, setPrinters] = useState<PrinterStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { showError } = useToast();

  const loadPrinters = useCallback(
    async (isInitial: boolean) => {
      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      try {
        const list = await backend.getPrinters();
        setPrinters(list);
        setLastChecked(new Date());
      } catch (error) {
        console.error("Failed to load printers:", error);
        showError("Printer Check Failed", "Unable to enumerate printers");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showError],
  );

  useEffect(() => {
    loadPrinters(true);
  }, [loadPrinters]);

  const connectedCount = printers.filter((p) => p.isConnected).length;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground mb-0.5">
            Printers
          </h2>
          <p className="text-[13px] text-muted-foreground">
            System printers detected on this machine and their connection
            status.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => loadPrinters(false)}
          disabled={isLoading || isRefreshing}
          className="h-9 text-[13px] gap-1.5"
        >
          {isRefreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 bg-card border border-border rounded-xl">
          <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">
            Checking printers…
          </span>
        </div>
      ) : printers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 bg-card border border-border rounded-xl text-center px-6">
          <Printer className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-[13px] font-medium text-foreground">
            No printers found
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            No printers are installed or visible to this machine.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 text-[12px] text-muted-foreground">
            {connectedCount} of {printers.length} printer
            {printers.length === 1 ? "" : "s"} connected
            {lastChecked && (
              <> · checked {lastChecked.toLocaleTimeString()}</>
            )}
          </div>

          <div className="space-y-2">
            {printers.map((printer) => (
              <div
                key={printer.name}
                className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border shadow-sm"
              >
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${
                    printer.isConnected
                      ? "bg-emerald-50 dark:bg-emerald-950/30"
                      : "bg-red-50 dark:bg-red-950/30"
                  }`}
                >
                  {printer.isConnected ? (
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="w-4.5 h-4.5 text-destructive" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {printer.name}
                    </p>
                    {printer.isDefault && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">
                        <Star className="w-2.5 h-2.5" />
                        Default
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        printer.isConnected
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                      }`}
                    >
                      {printer.isConnected ? "Connected" : "Not connected"}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {printer.portName && <>Port: {printer.portName} · </>}
                    {printer.isNetwork ? "Network" : "Local"}
                  </p>

                  {!printer.isConnected && printer.reasons.length > 0 && (
                    <div className="flex items-start gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-md bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-destructive">
                        {printer.reasons.join(" · ")}
                      </p>
                    </div>
                  )}

                  {printer.isConnected && printer.reasons.length > 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      {printer.reasons.join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
