import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { createPrintJob } from "./render";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";
import { startWebSocketServer, stopWebSocketServer } from "./socket";
import { mainWindow } from "./main";

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

ipcMain.handle(
  "token-changed",
  async (_, token: string | null): Promise<void> => {
    console.log("Token changed:", token ? "Token available" : "Token cleared");

    if (token) {
      // Token is available, start WebSocket server
      startWebSocketServer(mainWindow);
    } else {
      // Token is null, stop WebSocket server
      stopWebSocketServer(mainWindow);
    }
  },
);
