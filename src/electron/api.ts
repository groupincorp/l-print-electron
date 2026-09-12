import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { createPrintJob } from "./render";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";
import {
  startWebSocketServer,
  stopWebSocketServer,
  configureWebSocketServer,
  getSocketInfo,
} from "./socket";
import { mainWindow } from "./main";
import { getPrinterStatuses } from "./printers";
import { getFirewallStatus, addFirewallRule } from "./lib/firewall";
import { setPrintQueueCredentials } from "./lib/print-queue-api";

ipcMain.handle(
  "node-version",
  (event: IpcMainInvokeEvent, msg: string): string => {
    console.log(event);
    console.log(msg);

    return process.versions.node;
  },
);

ipcMain.handle(
  "process-message",
  (event: IpcMainInvokeEvent, msg: string): string => {
    console.log(event);
    console.log(msg);

    return `Received your message: ${msg}`;
  },
);

ipcMain.handle(
  "create-print-job",
  async (_, data: PosPrintData[], option: PosPrintOptions) => {
    return createPrintJob(data, option);
  },
);

ipcMain.handle("get-printers", async () => {
  return getPrinterStatuses();
});

ipcMain.handle("get-socket-info", async () => {
  return getSocketInfo();
});

ipcMain.handle(
  "socket-config-changed",
  async (_, config: { authEnabled?: boolean; token?: string }) => {
    configureWebSocketServer(config);
  },
);

ipcMain.handle("get-firewall-status", async () => {
  return getFirewallStatus();
});

ipcMain.handle("add-firewall-rule", async () => {
  return addFirewallRule();
});

ipcMain.handle(
  "token-changed",
  async (
    _,
    token: string | null,
    serverEndpoint?: string | null,
  ): Promise<void> => {
    console.log("Token changed:", token ? "Token available" : "Token cleared");

    // Cached for deletePrintQueueRow() (src/electron/lib/print-queue-api.ts),
    // called from socket.ts right after a WS-pushed kitchen ticket prints -
    // that path has no renderer round trip available to fetch these itself.
    setPrintQueueCredentials(serverEndpoint ?? null, token);

    if (token) {
      // Token is available, start WebSocket server
      startWebSocketServer(mainWindow);
    } else {
      // Token is null, stop WebSocket server
      stopWebSocketServer(mainWindow);
    }
  },
);
