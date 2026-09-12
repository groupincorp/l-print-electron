import { BrowserWindow } from "electron";
import { WebSocket, WebSocketServer } from "ws";
import { PosPrinter } from "electron-pos-printer";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { generateLabel } from "./lib/label-printer";
import { getLanAddresses } from "./lib/network";
import { tryAddFirewallRuleQuietly } from "./lib/firewall";
import { print as pdfPrint, type PrintOptions } from "pdf-to-printer";
import { createPrintJob, resolvePageSize } from "./render";
import type { PosPrintData } from "electron-pos-printer";
import fs from "fs";
import { deletePrintQueueRows } from "./lib/print-queue-api";

const HOST = "0.0.0.0";
const PORT = 8181;
const HEARTBEAT_INTERVAL = 30_000;

interface SocketConfig {
  authEnabled: boolean;
  token: string;
}

interface ClientMeta {
  id: string;
  ip: string;
  isAlive: boolean;
  connectedAt: number;
}

let wss: WebSocketServer | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let currentWindow: BrowserWindow | null = null;

const socketConfig: SocketConfig = { authEnabled: false, token: "" };
const clients = new Map<WebSocket, ClientMeta>();

// Serializes work per printer so two devices targeting the same printer queue
// instead of interleaving their output. Different printers still run in parallel.
const printerChains = new Map<string, Promise<unknown>>();

// While a WS-pushed kitchen ticket is printing on a given printer, the
// renderer's print_queue poller is told to pause that same printer so the
// two paths never send overlapping jobs to it. Reference-counted per
// printer so back-to-back kitchen tickets on the same printer (queued via
// printerChains above) don't cause a premature resume between them.
const activeKitchenJobsByPrinter = new Map<string, number>();

function setKitchenTicketPrinting(printerName: string, active: boolean) {
  const current = activeKitchenJobsByPrinter.get(printerName) ?? 0;
  const next = Math.max(0, current + (active ? 1 : -1));
  activeKitchenJobsByPrinter.set(printerName, next);

  if (active && current === 0) {
    currentWindow?.webContents.send("kitchen-ws-print-status", {
      printerName,
      active: true,
    });
  } else if (!active && next === 0) {
    currentWindow?.webContents.send("kitchen-ws-print-status", {
      printerName,
      active: false,
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(message: string) {
  console.log(message);
  currentWindow?.webContents.send("log", message);
}

function sendJson(ws: WebSocket, payload: unknown) {
  try {
    ws.send(JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to send WebSocket message:", err);
  }
}

function broadcastClients() {
  const list = Array.from(clients.values()).map((c) => ({
    id: c.id,
    ip: c.ip,
    connectedAt: c.connectedAt,
  }));
  currentWindow?.webContents.send("ws-clients", {
    count: list.length,
    clients: list,
  });
}

function normalizeIp(ip: string | undefined): string {
  if (!ip) return "unknown";
  // Strip the IPv4-mapped IPv6 prefix Node adds for dual-stack sockets.
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isAuthorized(reqUrl: string | undefined): boolean {
  if (!socketConfig.authEnabled) return true;
  if (!socketConfig.token) return true;
  try {
    const url = new URL(reqUrl ?? "/", "http://localhost");
    const provided =
      url.searchParams.get("token") ?? url.searchParams.get("t") ?? "";
    return provided === socketConfig.token;
  } catch {
    return false;
  }
}

// ─── Print branches ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function printProductLot(content: any, printInfo: any): Promise<void> {
  const tmp = path.join(os.tmpdir(), `label_${Date.now()}_${randomUUID()}.pdf`);
  log(`Generating label PDF at: ${tmp}`);
  try {
    await generateLabel({ ...content, size: printInfo.size }, tmp);

    const options: PrintOptions = {
      printer: printInfo.printer_name,
      silent: true,
      scale: "fit",
    };

    await pdfPrint(tmp, options);
    log(`[LabelPrint] ✓ Printed [${printInfo.size}]: ${content.sku}`);
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stderr?: string;
      stdout?: string;
    };
    const detail = e.stderr || e.stdout || e.message;
    log(`Error generating or printing label: ${detail}`);
    throw new Error(detail);
  } finally {
    fs.unlink(tmp, () => {});
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function printHtml(content: any, printInfo: any): Promise<void> {
  const win = new BrowserWindow({ show: false });
  try {
    const available = (await win.webContents.getPrintersAsync()).map(
      (p) => p.name,
    );
    if (!available.includes(printInfo.printer_name)) {
      throw new Error(
        `Printer "${printInfo.printer_name}" is not available. Available: ${available.join(", ") || "none"}`,
      );
    }

    await new Promise<void>((resolve, reject) => {
      win.webContents.once("did-finish-load", () => {
        win.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: printInfo.printer_name,
            copies: printInfo.copies || 1,
            margins: { marginType: "none" },
            // Receipt HTML has no built-in page size of its own (unlike the
            // PDF label path) - without this Chromium defaults to A4/Letter,
            // shrinking the receipt to a corner of a full page instead of
            // filling the thermal roll width.
            pageSize: resolvePageSize(printInfo.page_size || "80mm"),
          },
          (success, failureReason) => {
            if (success) resolve();
            else reject(new Error(failureReason || "Print job failed"));
          },
        );
      });

      win.webContents.once("did-fail-load", (_e, code, description) => {
        reject(new Error(`Failed to load HTML (${code}): ${description}`));
      });

      win.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(content)}`,
      );
    });
  } finally {
    if (!win.isDestroyed()) win.close();
  }
}

// Renders through the exact same HTML-based path the 10s print_queue
// poller already uses (see queue-manager.ts's run() -> backend.printJob()
// -> createPrintJob() via IPC) instead of the generic printPos() branch
// below, so a WS-pushed kitchen ticket looks identical to a polled one.
async function printKitchenTicket(
  content: PosPrintData[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printInfo: any,
): Promise<void> {
  const ok = await createPrintJob(content, {
    preview: false,
    margin: "0 0 0 0",
    copies: 1,
    printerName: printInfo.printer_name,
    timeOutPerLine: 400,
    silent: true,
    pageSize: "80mm",
    boolean: true,
  });
  if (!ok) throw new Error("Printer returned failure");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function printPos(content: any, printInfo: any): Promise<void> {
  const info = {
    preview: false,
    margin: "0 0 0 0",
    copies: 1,
    printerName: printInfo.printer_name,
    timeOutPerLine: 800,
    silent: true,
    pageSize: printInfo.page_size || "76mm",
    boolean: true,
  };
  await PosPrinter.print(content, info);
}

interface ItemResult {
  index: number;
  ok: boolean;
  error?: string;
}

async function processContents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contents: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printInfo: any,
): Promise<ItemResult[]> {
  const results: ItemResult[] = [];

  for (let index = 0; index < contents.length; index++) {
    const content = contents[index];
    try {
      log(`Printing item ${index + 1}/${contents.length} on ${printInfo.printer_name}`);
      if (printInfo.type === "product_lot") {
        await printProductLot(content, printInfo);
      } else if (printInfo.type === "data:text/html") {
        await printHtml(content, printInfo);
      } else if (printInfo.type === "kitchen_ticket") {
        await printKitchenTicket(content, printInfo);
      } else {
        await printPos(content, printInfo);
      }
      results.push({ index, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Error handling print item ${index + 1}: ${message}`);
      results.push({ index, ok: false, error: message });
    }
  }

  return results;
}

// ─── Message handling ─────────────────────────────────────────────────────────

async function handleMessage(ws: WebSocket, raw: string) {
  currentWindow?.webContents.send("ws-message", raw);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    log(`Received non-JSON message: ${raw}`);
    sendJson(ws, { type: "error", message: "Invalid JSON payload" });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = Array.isArray(payload.content) ? payload.content : [];
  const printInfo = payload.printer_info || {};
  const jobId: string = payload.jobId || payload.job_id || randomUUID();

  if (contents.length === 0) {
    sendJson(ws, {
      type: "job_result",
      jobId,
      ok: false,
      error: "No content to print",
      results: [],
    });
    return;
  }

  const printerName = printInfo.printer_name || "default";
  log(`Handling print job ${jobId} → ${printerName} (${contents.length} item(s))`);
  sendJson(ws, { type: "ack", jobId, items: contents.length });

  const isKitchenTicket = printInfo.type === "kitchen_ticket";
  if (isKitchenTicket) setKitchenTicketPrinting(printerName, true);

  const previous = printerChains.get(printerName) ?? Promise.resolve();
  const work = previous.then(() => processContents(contents, printInfo));
  printerChains.set(
    printerName,
    work.catch(() => undefined),
  );

  let results: ItemResult[];
  try {
    results = await work;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results = contents.map((_, index) => ({ index, ok: false, error: message }));
  } finally {
    // Resume the poller for this printer whether the print succeeded,
    // failed, or threw - never leave it paused indefinitely.
    if (isKitchenTicket) setKitchenTicketPrinting(printerName, false);
  }

  const ok = results.every((r) => r.ok);
  log(`Print job ${jobId} finished — ${ok ? "OK" : "with errors"}`);
  sendJson(ws, { type: "job_result", jobId, ok, results });

  // Kitchen tickets are pushed straight from a POS terminal as a speed-up
  // over the 10s print_queue poller, which normally deletes a row itself
  // right after printing it. Do the same here on success so the poller
  // never sees (and reprints) a ticket this path already delivered. On
  // failure, deliberately do nothing - the row stays queued and the next
  // poll tick retries it, same as any other print failure.
  //
  // queueId is normally one id, but a "group_by: TABLE" ticket merges
  // several print_queue rows into one printed ticket, so it arrives as a
  // comma-joined list (e.g. "12,13,14") - delete every id in the group.
  if (isKitchenTicket && ok && payload.queueId != null) {
    const ids = String(payload.queueId)
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    void deletePrintQueueRows(ids);
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    for (const [ws, meta] of clients) {
      if (!meta.isAlive) {
        log(`Dropping unresponsive client: ${meta.ip}`);
        clients.delete(ws);
        ws.terminate();
        continue;
      }
      meta.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* socket already gone */
      }
    }
    broadcastClients();
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startWebSocketServer(mainWindow: BrowserWindow | null) {
  currentWindow = mainWindow;

  if (wss) {
    console.log("WebSocket server is already running");
    return;
  }

  try {
    wss = new WebSocketServer({ port: PORT, host: HOST });

    wss.on("listening", () => {
      const addresses = getLanAddresses()
        .map((a) => `ws://${a.address}:${PORT}`)
        .join(", ");
      log(
        `WebSocket server listening on ${HOST}:${PORT}` +
          (addresses ? ` — reachable at ${addresses}` : ""),
      );
      currentWindow?.webContents.send(
        "status",
        `WebSocket server running on port ${PORT}`,
      );
      tryAddFirewallRuleQuietly();
    });

    wss.on("connection", (ws, req) => {
      const ip = normalizeIp(req.socket.remoteAddress);

      if (!isAuthorized(req.url)) {
        log(`Rejected unauthorized client: ${ip}`);
        sendJson(ws, { type: "error", message: "Unauthorized" });
        ws.close(4401, "unauthorized");
        return;
      }

      const meta: ClientMeta = {
        id: randomUUID(),
        ip,
        isAlive: true,
        connectedAt: Date.now(),
      };
      clients.set(ws, meta);
      log(`Client connected: ${ip} (${clients.size} total)`);
      broadcastClients();
      sendJson(ws, { type: "welcome", message: "Connected to Printer Maintenance" });

      ws.on("pong", () => {
        const m = clients.get(ws);
        if (m) m.isAlive = true;
      });

      ws.on("message", (data) => {
        void handleMessage(ws, data.toString());
      });

      ws.on("close", () => {
        clients.delete(ws);
        log(`Client disconnected: ${ip} (${clients.size} total)`);
        broadcastClients();
      });

      ws.on("error", (err) => {
        console.error(`Client socket error (${ip}):`, err.message);
      });
    });

    wss.on("error", (err: NodeJS.ErrnoException) => {
      console.error("WebSocket server error:", err);
      if (err.code === "EADDRINUSE") {
        currentWindow?.webContents.send(
          "status",
          `Port ${PORT} is already in use — close the other program using it and restart`,
        );
        wss = null;
        stopHeartbeat();
      } else {
        currentWindow?.webContents.send(
          "status",
          `WebSocket server error: ${err.message}`,
        );
      }
    });

    startHeartbeat();
  } catch (error) {
    console.error("Failed to start WebSocket server:", error);
    currentWindow?.webContents.send(
      "status",
      `Failed to start WebSocket server: ${(error as Error).message}`,
    );
  }
}

export function stopWebSocketServer(mainWindow: BrowserWindow | null) {
  currentWindow = mainWindow ?? currentWindow;

  if (!wss) {
    console.log("WebSocket server is not running");
    return;
  }

  stopHeartbeat();

  for (const ws of clients.keys()) {
    try {
      ws.terminate();
    } catch {
      /* ignore */
    }
  }
  clients.clear();
  broadcastClients();

  try {
    wss.close(() => {
      console.log("WebSocket server stopped");
      currentWindow?.webContents.send("status", "WebSocket server stopped");
      wss = null;
    });
  } catch (error) {
    console.error("Error stopping WebSocket server:", error);
    wss = null;
  }
}

export function getWebSocketServerStatus() {
  return wss !== null;
}

export function configureWebSocketServer(config: Partial<SocketConfig>) {
  if (typeof config.authEnabled === "boolean") {
    socketConfig.authEnabled = config.authEnabled;
  }
  if (typeof config.token === "string") {
    socketConfig.token = config.token.trim();
  }
  console.log(
    `Socket auth ${socketConfig.authEnabled ? "enabled" : "disabled"}`,
  );
}

export function getSocketInfo() {
  return {
    running: wss !== null,
    host: HOST,
    port: PORT,
    addresses: getLanAddresses().map((a) => a.address),
    authEnabled: socketConfig.authEnabled,
    clientCount: clients.size,
    clientIps: Array.from(clients.values()).map((c) => c.ip),
  };
}
