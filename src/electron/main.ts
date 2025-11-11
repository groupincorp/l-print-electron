import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import { existsSync } from "fs";
import cron from "node-cron";
import { join } from "path";
import { WebSocketServer } from "ws";

// 1. this import won't work yet, but we will fix that next
import "./api";

// 2. simple check if we are running in dev / preview / production
const isDev = process.env.DEV != undefined;
const isPreview = process.env.PREVIEW != undefined;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuiting = false;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true,
});

function getIconExtension() {
  switch (process.platform) {
    case "win32":
      return "ico";
    case "darwin":
      return "icns";
    default:
      return "png";
  }
}

function getIconPath() {
  const iconExt = getIconExtension();
  const iconFile = `printer-maintenance.${iconExt}`;

  if (isDev) {
    const devPath = join(__dirname, "../assets", iconFile);
    console.log("Dev icon path:", devPath);
    return devPath;
  } else {
    // Try multiple possible locations for built app
    const possiblePaths = [
      join(process.resourcesPath, iconFile),
      join(process.resourcesPath, "assets", iconFile),
      join(process.resourcesPath, "app", "assets", iconFile),
      join(__dirname, "../assets", iconFile),
      join(__dirname, "../../assets", iconFile),
      join(process.cwd(), "assets", iconFile),
    ];

    // Check which path exists and use it
    for (const path of possiblePaths) {
      try {
        if (existsSync(path)) {
          console.log("Found icon at:", path);
          return path;
        }
      } catch (e) {
        console.warn(`Error checking icon path ${path}:`, e);
      }
    }

    console.warn("No icon found, using fallback path");
    // Fallback to the most likely path
    return possiblePaths[1]; // assets folder in resources
  }
}

function createTray() {
  const trayIconPath = getIconPath();
  console.log("Tray icon path:", trayIconPath);

  try {
    const image = nativeImage.createFromPath(trayIconPath);

    // On macOS, make it a template image for better system integration
    if (process.platform === "darwin") {
      image.setTemplateImage(true);
    }

    // Resize the image for tray (16x16 or 22x22 pixels typically)
    const resizedImage = image.resize({ width: 16, height: 16 });

    tray = new Tray(resizedImage);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show App",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            if (process.platform === "darwin") {
              mainWindow.focus();
            }
          }
        },
      },
      {
        label: "Hide App",
        click: () => {
          if (mainWindow) {
            mainWindow.hide();
          }
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuiting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip("Printer Maintenance");
    tray.setContextMenu(contextMenu);

    tray.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          if (process.platform === "darwin") {
            mainWindow.focus();
          }
        }
      }
    });

    tray.on("double-click", () => {
      if (mainWindow) {
        mainWindow.show();
        if (process.platform === "darwin") {
          mainWindow.focus();
        }
      }
    });

    console.log("Tray created successfully");
  } catch (error) {
    console.error("Failed to create tray:", error);
  }
}

function createWindow() {
  const iconPath = getIconPath();
  mainWindow = new BrowserWindow({
    width: 900,
    height: 900,
    show: !process.argv.includes("--hidden"), // Don't show if started hidden
    darkTheme: false,
    title: "Printer Maintenance",
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    // ^^^^ make sure this port
    // matches the port used when
    // you run 'yarn run vite'
    mainWindow.webContents.openDevTools();
  } else if (isPreview) {
    mainWindow.webContents.openDevTools();
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("close", (e) => {
    if (!isQuiting) {
      e.preventDefault();
      mainWindow?.hide();

      // On macOS, show a notification that the app is still running
      if (process.platform === "darwin") {
        console.log("App minimized to tray");
      }
    }
  });
}

// Run cron job every 10 seconds instead
cron.schedule("*/10 * * * * *", () => {
  console.log("⏰ Running every 10 seconds:", new Date().toISOString());
  // Example: send message to renderer
  if (mainWindow) {
    mainWindow.webContents.send("cron-event", { time: new Date() });
  }
});

function runBackgroundProcess() {
  console.log("Background process started");

  setInterval(() => {
    console.log("Background task running every 10 seconds");
  }, 10000);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();
  createTray();
  runBackgroundProcess();
  const wss = new WebSocketServer({ port: 8080 });

  console.log("WebSocket server running on ws://localhost:8080");

  wss.on("connection", (ws) => {
    console.log("Client connected");
    ws.send("Welcome from Electron!");

    ws.on("message", async (msg) => {
      console.log("Received:", msg.toString());
      ws.send(`Echo: ${msg.toString()}`);
      // Send message to renderer process via IPC
      mainWindow?.webContents.send("ws-message", msg.toString());
      // const data = JSON.parse(msg.toString());
    });
  });
});

// Handle app events
app.on("window-all-closed", () => {
  // On macOS, keep app running even when all windows are closed
  // The app will continue running in the background with the tray icon
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuiting = true;
});

// Handle dock icon clicks on macOS
app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
