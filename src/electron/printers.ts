import { BrowserWindow } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";
import { mainWindow } from "./main";

const execFileAsync = promisify(execFile);

export interface PrinterStatusInfo {
  name: string;
  isDefault: boolean;
  isConnected: boolean;
  portName: string;
  isLocal: boolean;
  isNetwork: boolean;
  reasons: string[];
}

// Win32_Printer.ExtendedPrinterStatus (Printer-MIB hrPrinterStatus, extended set)
// https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-printer
const EXTENDED_PRINTER_STATUS: Record<number, string> = {
  1: "Other",
  2: "Unknown",
  3: "Idle",
  4: "Printing",
  5: "Warming up",
  6: "Stopped printing",
  7: "Offline",
  8: "Paused",
  9: "Error",
  10: "Busy",
  11: "Not available",
  12: "Waiting",
  13: "Processing",
  14: "Initializing",
  15: "Power save",
  16: "Pending deletion",
  17: "I/O active",
  18: "Manual feed",
};

// Win32_Printer.ExtendedDetectedErrorState
const EXTENDED_DETECTED_ERROR_STATE: Record<number, string> = {
  3: "Low paper",
  4: "Out of paper",
  5: "Low toner",
  6: "Out of toner",
  7: "Door open",
  8: "Paper jammed",
  9: "Service requested",
  10: "Output bin full",
  11: "Paper problem",
  12: "Cannot print page",
  13: "User intervention required",
  14: "Out of memory",
  15: "Server unknown",
};

// Status codes that mean the printer cannot currently be reached.
const OFFLINE_STATUS_CODES = new Set([7, 11]); // Offline, Not available

interface Win32PrinterRow {
  Name: string;
  Default: boolean;
  WorkOffline: boolean;
  ExtendedPrinterStatus: number;
  ExtendedDetectedErrorState: number;
  Local: boolean;
  Network: boolean;
  PortName: string;
}

async function queryWindowsPrinters(): Promise<PrinterStatusInfo[] | null> {
  if (process.platform !== "win32") return null;

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance -ClassName Win32_Printer | " +
          "Select-Object Name, Default, WorkOffline, ExtendedPrinterStatus, ExtendedDetectedErrorState, Local, Network, PortName | " +
          "ConvertTo-Json -Compress",
      ],
      { windowsHide: true, timeout: 10_000 },
    );

    const trimmed = stdout.trim();
    if (!trimmed) return [];

    const parsed: Win32PrinterRow | Win32PrinterRow[] = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    return rows.map((row) => {
      const reasons: string[] = [];

      if (row.WorkOffline) {
        reasons.push("Printer is set to work offline");
      }

      const statusText = EXTENDED_PRINTER_STATUS[row.ExtendedPrinterStatus];
      if (
        statusText &&
        row.ExtendedPrinterStatus !== 2 && // Unknown
        row.ExtendedPrinterStatus !== 3 && // Idle
        !reasons.includes(statusText)
      ) {
        reasons.push(statusText);
      }

      const errorText =
        EXTENDED_DETECTED_ERROR_STATE[row.ExtendedDetectedErrorState];
      if (errorText) {
        reasons.push(errorText);
      }

      const isConnected =
        !row.WorkOffline && !OFFLINE_STATUS_CODES.has(row.ExtendedPrinterStatus);

      return {
        name: row.Name,
        isDefault: row.Default,
        isConnected,
        portName: row.PortName,
        isLocal: row.Local,
        isNetwork: row.Network,
        reasons: !isConnected && reasons.length === 0 ? ["Offline"] : reasons,
      };
    });
  } catch (err) {
    console.error("Failed to query Win32_Printer via PowerShell:", err);
    return null;
  }
}

// Cross-platform fallback: Electron only reports name/description here, so
// connectivity cannot be determined — every printer is reported as unknown.
async function queryElectronPrinters(): Promise<PrinterStatusInfo[]> {
  const useMain = mainWindow && !mainWindow.isDestroyed();
  const win = useMain ? mainWindow! : new BrowserWindow({ show: false });

  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      isDefault: false,
      isConnected: true,
      portName: "",
      isLocal: true,
      isNetwork: false,
      reasons: ["Connectivity status is not available on this platform"],
    }));
  } finally {
    if (!useMain) win.close();
  }
}

export async function getPrinterStatuses(): Promise<PrinterStatusInfo[]> {
  const windowsResult = await queryWindowsPrinters();
  if (windowsResult !== null) return windowsResult;
  return queryElectronPrinters();
}
