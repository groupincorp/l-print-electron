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
  getPrinters: async (): Promise<
    Array<{
      name: string;
      isDefault: boolean;
      isConnected: boolean;
      portName: string;
      isLocal: boolean;
      isNetwork: boolean;
      reasons: string[];
    }>
  > => await ipcRenderer.invoke("get-printers"),
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
  onStatus: (callback: (msg: string) => void) =>
    ipcRenderer.on("status", (_, msg) => callback(msg)),
  onLog: (callback: (msg: string) => void) =>
    ipcRenderer.on("log", (_, msg) => callback(msg)),
  // WebSocket print server (device → PC)
  getSocketInfo: async (): Promise<{
    running: boolean;
    host: string;
    port: number;
    addresses: string[];
    authEnabled: boolean;
    clientCount: number;
    clientIps: string[];
  }> => await ipcRenderer.invoke("get-socket-info"),
  setSocketConfig: async (config: {
    authEnabled?: boolean;
    token?: string;
  }): Promise<void> => await ipcRenderer.invoke("socket-config-changed", config),
  onSocketClients: (
    callback: (data: {
      count: number;
      clients: Array<{ id: string; ip: string; connectedAt: number }>;
    }) => void,
  ) => ipcRenderer.on("ws-clients", (_, data) => callback(data)),
  getFirewallStatus: async (): Promise<"allowed" | "missing" | "unknown"> =>
    await ipcRenderer.invoke("get-firewall-status"),
  addFirewallRule: async (): Promise<{ ok: boolean; message: string }> =>
    await ipcRenderer.invoke("add-firewall-rule"),
};

contextBridge.exposeInMainWorld("backend", backend);
