import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { createPrintJob } from "./render";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";
import Store from "electron-store";

// Initialize the store
const store = new Store();

ipcMain.handle(
  "node-version",
  (event: IpcMainInvokeEvent, msg: string): string => {
    console.log(event);
    console.log(msg);

    return process.versions.node;
  }
);

ipcMain.handle(
  "process-message",
  (event: IpcMainInvokeEvent, msg: string): string => {
    console.log(event);
    console.log(msg);

    return `Received your message: ${msg}`;
  }
);

ipcMain.handle(
  "create-print-job",
  async (_, data: PosPrintData[], option: PosPrintOptions) => {
    return createPrintJob(data, option);
  }
);

// Store IPC handlers
ipcMain.handle("store-get", (_, key: string) => {
  return store.get(key);
});

ipcMain.handle("store-set", (_, key: string, value: any) => {
  store.set(key, value);
  return true;
});

ipcMain.handle("store-delete", (_, key: string) => {
  store.delete(key);
  return true;
});

ipcMain.handle("store-clear", (_) => {
  store.clear();
  return true;
});
