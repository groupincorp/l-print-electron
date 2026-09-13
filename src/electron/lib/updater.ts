import { autoUpdater, ipcMain, type BrowserWindow } from "electron";

export type UpdateState =
  | "checking"
  | "available"
  | "not-available"
  | "downloaded"
  | "error"
  | "unsupported";

const SUPPORTED_PLATFORMS = ["darwin", "win32"];

// Tracks whether a check is already in flight - shared across the background
// hourly checker (started in main.ts via update-electron-app) and manual
// checks from the renderer, since Squirrel's updater process throws
// "already running" if checkForUpdates() is called while one is pending.
let checkInProgress = false;

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
    checkInProgress = true;
    sendStatus(getMainWindow, "checking");
  });

  autoUpdater.on("update-available", () => {
    // stays true until update-downloaded/error - a download is now in flight
    sendStatus(getMainWindow, "available", "Update found, downloading…");
  });

  autoUpdater.on("update-not-available", () => {
    checkInProgress = false;
    sendStatus(getMainWindow, "not-available", "You're on the latest version.");
  });

  autoUpdater.on("update-downloaded", (_event, _releaseNotes, releaseName) => {
    checkInProgress = false;
    sendStatus(
      getMainWindow,
      "downloaded",
      releaseName || "Update downloaded — restart to install.",
    );
  });

  autoUpdater.on("error", (err) => {
    checkInProgress = false;
    sendStatus(getMainWindow, "error", err.message);
  });

  ipcMain.handle("check-for-updates", () => {
    if (!SUPPORTED_PLATFORMS.includes(process.platform)) {
      return { ok: false, message: "Auto-update isn't supported on this platform." };
    }

    if (checkInProgress) {
      return {
        ok: false,
        message: "A check is already in progress — please wait a moment.",
      };
    }

    try {
      autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (err) {
      checkInProgress = false;
      return { ok: false, message: (err as Error).message };
    }
  });

  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall();
  });
}
