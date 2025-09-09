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
};

contextBridge.exposeInMainWorld("backend", backend);
