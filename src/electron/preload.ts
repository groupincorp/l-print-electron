/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from "electron";

export const backend = {
  nodeVersion: async (msg: string): Promise<string> =>
    await ipcRenderer.invoke("node-version", msg),
  onMain: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_, data) => callback(data));
  },
  login: async (username: string, password: string): Promise<string> => {
    return await ipcRenderer.invoke("login", username, password);
  },
  onCronEvent: (callback: (data: unknown) => void) => {
    ipcRenderer.on("cron-event", (_, data) => callback(data));
  },
  printJob: async (printData: any[], options: any) => {
    return await ipcRenderer.invoke("create-print-job", printData, options);
  },
  // Store methods
  store: {
    get: async (key: string) => await ipcRenderer.invoke("store-get", key),
    set: async (key: string, value: any) =>
      await ipcRenderer.invoke("store-set", key, value),
    delete: async (key: string) =>
      await ipcRenderer.invoke("store-delete", key),
    clear: async () => await ipcRenderer.invoke("store-clear"),
  },
  // Token management
  tokenChanged: async (token: string | null): Promise<void> => {
    return await ipcRenderer.invoke("token-changed", token);
  },
};

contextBridge.exposeInMainWorld("backend", backend);
