import { BrowserWindow } from "electron";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";
import fs from "fs";
import os from "os";
import path from "path";
import QRCode from "qrcode";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CSSStyle = Record<string, unknown>;

function toCssString(style: CSSStyle | undefined): string {
  if (!style) return "";
  return Object.entries(style)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
    .join(";");
}

type ElectronPageSize =
  | Electron.Size
  | "A0"
  | "A1"
  | "A2"
  | "A3"
  | "A4"
  | "A5"
  | "A6"
  | "Legal"
  | "Letter"
  | "Tabloid";

/** Map receipt paper sizes to Electron pageSize micron objects */
function resolvePageSize(
  pageSize: PosPrintOptions["pageSize"],
): ElectronPageSize {
  if (!pageSize) return "A4";
  if (typeof pageSize === "object") {
    // SizeOptions uses points (pdf units); convert to microns (1pt ≈ 352.778µm)
    return { width: pageSize.width * 353, height: pageSize.height * 353 };
  }
  const widthMm: Record<string, number> = {
    "80mm": 80,
    "78mm": 78,
    "76mm": 76,
    "58mm": 58,
    "57mm": 57,
    "44mm": 44,
  };
  const w = widthMm[pageSize];
  return w ? { width: w * 1000, height: 297000 } : "A4";
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

async function buildReceiptHtml(
  data: PosPrintData[],
  option: PosPrintOptions,
): Promise<string> {
  const width = option.width ?? "80mm";
  const margin = option.margin ?? "0";

  const items: string[] = [];

  for (const item of data) {
    if (item.type === "text") {
      const trimmed = item.value?.trim() ?? "";
      if (/^-{3,}$/.test(trimmed)) {
        // dashes → thin solid line
        items.push(
          `<hr style="border:none;border-top:1px solid #000;margin:4px 0;" />`,
        );
      } else if (/^\*{3,}$/.test(trimmed)) {
        // asterisks → thick double line
        items.push(
          `<hr style="border:none;border-top:3px double #000;margin:6px 0;" />`,
        );
      } else if (/^={3,}$/.test(trimmed)) {
        // equals → thick solid line
        items.push(
          `<hr style="border:none;border-top:2px solid #000;margin:5px 0;" />`,
        );
      } else if (/^~{3,}$/.test(trimmed)) {
        // tildes → dashed line
        items.push(
          `<hr style="border:none;border-top:1px dashed #555;margin:4px 0;" />`,
        );
      } else {
        const css = toCssString(item.style as CSSStyle);
        items.push(`<div style="${css}">${item.value ?? ""}</div>`);
      }
    } else if (item.type === "image") {
      const src = item.path ? `file://${item.path}` : (item.url ?? "");
      const css = toCssString(item.style as CSSStyle);
      const w = item.width ? `width:${item.width};` : "";
      const h = item.height ? `height:${item.height};` : "";
      items.push(`<img src="${src}" style="${w}${h}${css}" />`);
    } else if (item.type === "qrCode" && item.value) {
      const size = item.width ? parseInt(item.width, 10) : 100;
      const svg = await QRCode.toString(item.value, {
        type: "svg",
        width: size,
        margin: 1,
      });
      const css = toCssString(item.style as CSSStyle);
      const align = item.position ?? "center";
      items.push(`<div style="text-align:${align};${css}">${svg}</div>`);
    } else if (item.type === "barCode" && item.value) {
      const css = toCssString(item.style as CSSStyle);
      const align = item.position ?? "center";
      items.push(
        `<div style="text-align:${align};font-family:monospace;${css}">${item.value}</div>`,
      );
    } else if (item.type === "table") {
      const hStyle = toCssString(item.tableHeaderStyle as CSSStyle);
      const bStyle = toCssString(item.tableBodyStyle as CSSStyle);
      const fStyle = toCssString(item.tableFooterStyle as CSSStyle);
      const th = (item.tableHeader ?? [])
        .map(
          (c) =>
            `<th style="${hStyle}">${typeof c === "string" ? c : (c.value ?? "")}</th>`,
        )
        .join("");
      const rows = (item.tableBody ?? [])
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td style="${bStyle}">${typeof c === "string" ? c : (c.value ?? "")}</td>`).join("")}</tr>`,
        )
        .join("");
      const tf = (item.tableFooter ?? [])
        .map(
          (c) =>
            `<td style="${fStyle}">${typeof c === "string" ? c : (c.value ?? "")}</td>`,
        )
        .join("");
      items.push(
        `<table style="width:100%;border-collapse:collapse">` +
          (th ? `<thead><tr>${th}</tr></thead>` : "") +
          (rows ? `<tbody>${rows}</tbody>` : "") +
          (tf ? `<tfoot><tr>${tf}</tr></tfoot>` : "") +
          `</table>`,
      );
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:ital,wght@0,100..700;1,100..700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${width}; padding: ${margin}; font-family: 'Kantumruy Pro', 'Hanuman', 'Courier New', Courier, monospace; font-size: 20px; line-height: 1.5; }
  img { max-width: 100%; }
  td, th { padding: 4px 6px; font-size: 20px; }
</style>
</head>
<body>
${option.header ? `<header>${option.header}</header>` : ""}
${items.join("\n")}
${option.footer ? `<footer>${option.footer}</footer>` : ""}
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createPrintJob(
  data: PosPrintData[],
  option: PosPrintOptions,
): Promise<boolean> {
  const html = await buildReceiptHtml(data, option);
  const tmpFile = path.join(os.tmpdir(), `receipt_${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, "utf-8");

  const win = new BrowserWindow({ show: false });

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const cleanup = (success: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try {
        win.close();
      } catch {
        /* already closed */
      }
      fs.unlink(tmpFile, () => {});
      resolve(success);
    };

    // Resolve false if the IPC would time out (Electron default ~30 s)
    const timeoutId = setTimeout(() => {
      console.error(
        "[LabelPrint] Print job timed out — printer may be offline",
      );
      cleanup(false);
    }, 25_000);

    win.webContents.once("did-fail-load", (_e, code, desc) => {
      console.error(`[LabelPrint] HTML load failed (${code}): ${desc}`);
      cleanup(false);
    });

    win.webContents.once("did-finish-load", () => {
      win.webContents.print(
        {
          silent: option.silent ?? true,
          printBackground: !!option.printBackground,
          deviceName: option.printerName ?? "",
          copies: option.copies ?? 1,
          color: option.color ?? false,
          landscape: option.landscape ?? false,
          pageSize: resolvePageSize(option.pageSize),
          ...(option.margins && { margins: option.margins }),
          ...(option.scaleFactor !== undefined && {
            scaleFactor: option.scaleFactor,
          }),
          ...(option.pagesPerSheet !== undefined && {
            pagesPerSheet: option.pagesPerSheet,
          }),
          ...(option.collate !== undefined && { collate: option.collate }),
          ...(option.pageRanges && { pageRanges: option.pageRanges }),
          ...(option.duplexMode && { duplexMode: option.duplexMode }),
          ...(option.dpi && { dpi: option.dpi }),
        },
        (success, failureReason) => {
          if (!success) {
            console.error("[LabelPrint] Receipt print failed:", failureReason);
          }
          cleanup(success);
        },
      );
    });

    win.webContents.loadFile(tmpFile);
  });
}
