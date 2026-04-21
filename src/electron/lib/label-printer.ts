import QRCode from "qrcode";
import PDFDoc from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LabelSize = "small" | "big";

export interface LabelData {
  size: LabelSize;
  lotNumber: string; // ★ KEY — human-readable e.g. 'LOT-2025-0042'
  expirationDate: string; // ★ KEY — ISO e.g. '2026-12-31'
  sku: string;
  lotId: string; // UUID encoded in QR
  price: string;
  manufacturingDate: string; // ISO e.g. '2025-01-15'
  slot: string; // e.g. 'SLOT-A01'
}

export interface PrintServerOptions {
  port?: number;
  printerName?: string;
}

export interface PrintResult {
  status: "ok" | "error";
  sku?: string;
  message?: string;
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

type Doc = InstanceType<typeof PDFDoc>;

const inch = (v: number): number => v * 72;
const mm = (v: number): number => v * 2.8346;

// ─── Label dimensions ─────────────────────────────────────────────────────────

interface Dims {
  w: number;
  h: number;
  pad: number;
}

const SIZES: Record<LabelSize, Dims> = {
  small: { w: inch(1.57), h: inch(0.79), pad: mm(2.5) },
  big: { w: inch(1.47), h: inch(1.97), pad: mm(2.5) },
};

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawBorder(doc: Doc, w: number, h: number): void {
  doc
    .rect(1.5, 1.5, w - 3, h - 3)
    .dash(3, { space: 3 })
    .strokeColor("#aaaaaa")
    .lineWidth(0.5)
    .stroke();
  doc.undash();
}

function drawRule(doc: Doc, x: number, y: number, len: number): void {
  doc
    .moveTo(x, y)
    .lineTo(x + len, y)
    .strokeColor("#eeeeee")
    .lineWidth(0.5)
    .stroke();
}

/** Green if not expired, red if past */
export function expColor(dateStr: string): string {
  return new Date(dateStr) < new Date() ? "#c0392b" : "#1a7a4a";
}

function buildQRValue(data: LabelData): string {
  return data.lotId.trim();
}

//  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
//  │                             │  ← QR top 50% zone (QR + lot #)
//  │       [  QR code  ]         │
//  │       LOT-2025-0042         │
//  │                             │
//  │                             │
//  │                             │
//  ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
//  │   EXP DATE   │  MFG DATE    │  ← hero block (exp + mfg side-by-side)
//  │   2026-12-31 │  2025-01-15  │
//  │   ─────────────────────     │
//  │   SLOT                      │
//  │   SLOT-A01                  │
//  │   ─────────────────────     │  ← secondary
//  │   SKU        │  PRICE       │
//  │   SKU-880…   │  $9.99       │
//  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

async function renderBig(
  doc: Doc,
  data: LabelData,
  qrSvg: string,
): Promise<void> {
  const { w, h, pad } = SIZES.big;

  // Top 50% QR zone, bottom 50% info zone
  const qrRowH = h * 0.5;
  const infoY = qrRowH;

  drawBorder(doc, w, h);

  // Section divider
  doc
    .moveTo(pad, infoY)
    .lineTo(w - pad, infoY)
    .dash(2, { space: 3 })
    .strokeColor("#cccccc")
    .lineWidth(0.5)
    .stroke();
  doc.undash();

  // ── TOP: QR code + lot number caption ────────────────────────────────────
  const qrTopPad = mm(2);
  const captionH = mm(5); // reserved for lot text below QR
  const qrSize = Math.min(qrRowH - qrTopPad - captionH, w * 0.65);
  const qrX = (w - qrSize) / 2;

  SVGtoPDF(doc, qrSvg, qrX, qrTopPad, { width: qrSize, height: qrSize });

  doc
    .font("Helvetica-Bold")
    .fontSize(5)
    .fillColor("#111111")
    .text(data.lotNumber, 0, qrTopPad + qrSize + mm(1), {
      width: w,
      align: "center",
      lineBreak: false,
    });

  // ── BOTTOM: info block ───────────────────────────────────────────────────
  const tX = pad;
  const tW = w - pad * 2;
  const heroKeySize = 5.5;
  const heroValSize = 8;
  const heroKeyLH = heroKeySize * 1.4;
  const heroValLH = heroValSize * 1.3;
  const secKeySize = 5;
  const secValSize = 6.5;
  const secKeyLH = secKeySize * 1.4;
  const secValLH = secValSize * 1.3;

  // Two equal columns for side-by-side fields
  const col1W = tW * 0.5;
  const col2X = tX + col1W;
  const col2W = tW - col1W;

  let y = infoY + mm(1);

  // ── HERO: EXP DATE | MFG DATE ────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(heroKeySize)
    .fillColor("#111111")
    .text("EXP DATE", tX, y, { width: col1W, lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fontSize(heroKeySize)
    .fillColor("#111111")
    .text("MFG DATE", col2X, y, { width: col2W, lineBreak: false });
  y += heroKeyLH + mm(0.3);

  doc
    .font("Helvetica-Bold")
    .fontSize(heroValSize)
    .fillColor("#111111")
    .text(data.expirationDate, tX, y, { width: col1W, lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fontSize(heroValSize)
    .fillColor("#111111")
    .text(data.manufacturingDate, col2X, y, { width: col2W, lineBreak: false });
  y += heroValLH + mm(0.7);

  drawRule(doc, tX, y, tW - mm(2));
  y += mm(0.8);

  // ── SLOT ──────────────────────────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(secKeySize)
    .fillColor("#111111")
    .text("SLOT", tX, y, { width: tW, lineBreak: false });
  y += secKeyLH + mm(0.3);

  doc
    .font("Helvetica-Bold")
    .fontSize(secValSize)
    .fillColor("#111111")
    .text(data.slot, tX, y, { width: tW, lineBreak: false });
  y += secValLH + mm(0.7);

  drawRule(doc, tX, y, tW - mm(2));
  y += mm(0.8);

  // ── SKU | PRICE ───────────────────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(secKeySize)
    .fillColor("#111111")
    .text("SKU", tX, y, { width: col1W, lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fontSize(secKeySize)
    .fillColor("#111111")
    .text("PRICE", col2X, y, { width: col2W, lineBreak: false });
  y += secKeyLH + mm(0.3);

  const skuDisplay =
    data.sku.length > 12 ? data.sku.slice(0, 11) + "\u2026" : data.sku;

  doc
    .font("Helvetica-Bold")
    .fontSize(secValSize)
    .fillColor("#111111")
    .text(skuDisplay, tX, y, { width: col1W, lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fontSize(secValSize)
    .fillColor("#111111")
    .text(data.price, col2X, y, { width: col2W, lineBreak: false });
}

// ─── Public: generate label PDF ──────────────────────────────────────────────

export async function generateLabel(
  data: LabelData,
  outputPath: string,
): Promise<void> {
  const { w, h } = SIZES[data.size];

  const qrSvg = await QRCode.toString(buildQRValue(data), {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
  });

  const doc = new PDFDoc({
    size: [w, h],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    // Disable stream compression so the printer driver receives raw vectors,
    // yielding the sharpest possible output at the printer's native DPI
    compress: false,
    info: { Title: `Label ${data.lotNumber} (${data.size})` },
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  if (data.size === "small") {
    // await renderSmall(doc, data, qrSvg);
  } else {
    await renderBig(doc, data, qrSvg);
  }

  doc.end();

  return new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// ─── Payload validation ───────────────────────────────────────────────────────

export function validatePayload(raw: unknown): LabelData {
  if (typeof raw !== "object" || raw === null)
    throw new Error("Payload must be a JSON object");

  const obj = raw as Record<string, unknown>;

  const required = [
    "size",
    "lotNumber", // ★ key field
    "expirationDate", // ★ key field
    "sku",
    "lotId",
    "price",
    "manufacturingDate",
    "slot",
  ] as const;

  const missing = required.filter((k) => !obj[k] || typeof obj[k] !== "string");
  if (missing.length)
    throw new Error(`Missing or empty fields: ${missing.join(", ")}`);

  const size = obj.size as string;
  if (size !== "small" && size !== "big")
    throw new Error(`Invalid size "${size}". Must be "small" or "big".`);

  return {
    size: size as LabelSize,
    lotNumber: obj.lotNumber as string,
    expirationDate: obj.expirationDate as string,
    sku: obj.sku as string,
    lotId: obj.lotId as string,
    price: obj.price as string,
    manufacturingDate: obj.manufacturingDate as string,
    slot: obj.slot as string,
  };
}

// ─── Test: npx ts-node src/label-generator.ts ────────────────────────────────

if (require.main === module) {
  const base = {
    lotNumber: "LOT-2025-0042",
    expirationDate: "2026-12-31",
    sku: "SKU-8809253649255",
    lotId: "3af64575-8a9c-452e-8004-17e4fd921277",
    price: "$9.99",
    manufacturingDate: "2025-01-15",
    slot: "SLOT-A01",
  };

  (async () => {
    // const smallOut = path.join(__dirname, 'test-label-small.pdf');
    // await generateLabel({ ...base, size: 'small' }, smallOut);
    // console.log('✅ Small label saved:', smallOut);

    const bigOut = path.join(__dirname, "test-label-big.pdf");
    await generateLabel({ ...base, size: "big" }, bigOut);
    console.log("✅ Big label saved:  ", bigOut);
  })().catch(console.error);
}
