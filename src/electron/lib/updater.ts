import { autoUpdater, ipcMain, type BrowserWindow } from "electron";

export type UpdateState =
  | "checking"
  | "available"
  | "not-available"
  | "downloaded"
  | "error"
  | "unsupported";

const SUPPORTED_PLATFORMS = ["darwin", "win32"];

function sendStatus(
  getMainWindow: () => BrowserWindow | null,
  state: UpdateState,
  message?: string,
) {
  getMainWindow()?.webContents.send("update-status", { state, message });
}

// update-electron-app (wired up in main.ts) already calls autoUpdater.setFeedURL()
// on startup, so it's safe to trigger additional manual checks against the same
// singleton here - Electron's autoUpdater supports multiple listeners.
export function registerUpdaterIpc(getMainWindow: () => BrowserWindow | null) {
  autoUpdater.on("checking-for-update", () => {
    sendStatus(getMainWindow, "checking");
  });

  autoUpdater.on("update-available", () => {
    sendStatus(getMainWindow, "available", "Update found, downloading…");
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus(getMainWindow, "not-available", "You're on the latest version.");
  });

  autoUpdater.on("update-downloaded", (_event, _releaseNotes, releaseName) => {
    sendStatus(
      getMainWindow,
      "downloaded",
      releaseName || "Update downloaded — restart to install.",
    );
  });

  autoUpdater.on("error", (err) => {
    sendStatus(getMainWindow, "error", err.message);
  });

  ipcMain.handle("check-for-updates", () => {
    if (!SUPPORTED_PLATFORMS.includes(process.platform)) {
      return { ok: false, message: "Auto-update isn't supported on this platform." };
    }

    try {
      autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  });

  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall();
  });
}
