import { BrowserWindow } from "electron";
import { WebSocketServer } from "ws";
import { PosPrinter } from "electron-pos-printer";
import path from "path";
import os from "os";
import { generateLabel } from "./lib/label-printer";
import { print as pdfPrint, type PrintOptions } from "pdf-to-printer";
import fs from "fs";

let wss: WebSocketServer | null = null;
let clientIP: string | undefined = undefined;

export function startWebSocketServer(mainWindow: BrowserWindow | null) {
  if (wss) {
    console.log("WebSocket server is already running");
    return;
  }

  try {
    wss = new WebSocketServer({ port: 8181, host: "127.0.0.1" });
    wss.on("listening", () => {
      const address = wss?.address();
      if (address && typeof address === "object") {
        console.log(
          "WebSocket server listening on ws://" +
            address.address +
            ":" +
            address.port,
        );
      }
    });

    wss.on("connection", (ws, req) => {
      console.log("Client connected to WebSocket");
      clientIP = req.socket.remoteAddress;
      mainWindow?.webContents.send("log", `Client connected: ${clientIP}`);
      ws.send("Welcome from Electron!");

      ws.on("message", async (msg) => {
        ws.send(`Echo: ${msg.toString()}`);
        // Send message to renderer process via IPC
        mainWindow?.webContents.send("ws-message", msg.toString());
        mainWindow?.webContents.send("log", `Received: ${msg.toString()}`);

        try {
          const payload = JSON.parse(msg.toString());
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const contents: any[] = payload.content || [];
          const print_info = payload.printer_info || {};

          console.log("Handling print job via WebSocket...");

          const printJobs = contents.map(async (content) => {
            try {
              console.log("Printer:", print_info.printer_name);
              if (print_info.type === "product_lot") {
                const tmp = path.join(os.tmpdir(), `label_${Date.now()}.pdf`);
                console.log("Generating label PDF at:", tmp);
                try {
                  if (contents.length > 0) {
                    await generateLabel(
                      { ...content, size: print_info.size },
                      tmp,
                    );
                  }

                  const options: PrintOptions & { win32Options?: string[] } = {
                    printer: print_info.printer_name,
                    silent: true,
                    scale: "noscale",
                    orientation: "portrait",
                    win32Options: [
                      "Resolution=600dpi",
                      "PrintQuality=High",
                      "FitToPage=false",
                    ],
                  };

                  await pdfPrint(tmp, options);
                  console.log(
                    `[LabelPrint] ✓ Printed [${print_info.size}]: ${content.sku}`,
                  );
                } catch (err) {
                  console.error("Error generating or printing label:", err);
                } finally {
                  fs.unlink(tmp, () => {});
                }
              }
              if (print_info.type === "data:text/html") {
                const win = new BrowserWindow({ show: false });
                const printer = (await win.webContents.getPrintersAsync()).map(
                  (p) => p.name,
                );
                if (printer.includes(print_info.printer_name)) {
                  console.log(
                    `Printer ${print_info.printer_name} is available.`,
                  );
                } else {
                  console.error(
                    `Printer ${print_info.printer_name} is not available. Available printers: ${printer.join(", ")}`,
                  );
                }

                // Set up the event listener BEFORE loading the URL
                await new Promise<void>((resolve, reject) => {
                  win.webContents.once("did-finish-load", () => {
                    win.webContents.print(
                      {
                        silent: true,
                        printBackground: true,
                        deviceName: print_info.printer_name,
                      },
                      (success, failureReason) => {
                        if (success) {
                          console.log("Print job completed successfully");
                        } else {
                          console.error("Print job failed:", failureReason);
                        }
                        win.close();
                        resolve();
                      },
                    );
                  });

                  win.webContents.once(
                    "did-fail-load",
                    (_event, errorCode, errorDescription) => {
                      console.error(
                        "Failed to load HTML:",
                        errorCode,
                        errorDescription,
                      );
                      win.close();
                      reject(new Error(errorDescription));
                    },
                  );

                  // Use the actual content instead of hardcoded test HTML
                  win.loadURL(
                    `data:text/html;charset=utf-8,${encodeURIComponent(content)}`,
                  );
                });
              } else {
                const info = {
                  preview: false,
                  margin: "0 0 0 0",
                  copies: 1,
                  printerName: print_info.printer_name,
                  timeOutPerLine: 800,
                  silent: true,
                  pageSize: print_info.page_size || "76mm",
                  boolean: true,
                };
                await PosPrinter.print(content, info);
              }
            } catch (err) {
              console.error("Error handling print job:", err);
            }
          });

          await Promise.all(printJobs);
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      });

      ws.on("close", () => {
        console.log("Client disconnected from WebSocket");
        mainWindow?.webContents.send("log", `Client disconnected: ${clientIP}`);
      });
    });

    mainWindow?.webContents.send(
      "status",
      "WebSocket server running on port 8181",
    );

    wss.on("error", (error) => {
      console.error("WebSocket server error:", error);
    });
  } catch (error) {
    console.error("Failed to start WebSocket server:", error);
  }
}

// Function to stop WebSocket server
export function stopWebSocketServer(mainWindow: BrowserWindow | null) {
  if (!wss) {
    console.log("WebSocket server is not running");
    return;
  }

  try {
    wss.close(() => {
      console.log("WebSocket server stopped");
      mainWindow?.webContents.send("log", `Client disconnected: ${clientIP}`);
      wss = null;
    });
  } catch (error) {
    console.error("Error stopping WebSocket server:", error);
  }
}

export function getWebSocketServerStatus() {
  return wss !== null;
}
