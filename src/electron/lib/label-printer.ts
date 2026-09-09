import QRCode from "qrcode";
import PDFDoc from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import fs from "fs";
import path from "path";

// ─── Fonts ────────────────────────────────────────────────────────────────────
// PDFKit's built-in "Helvetica" fonts only cover WinAnsi (Latin) glyphs, so
// Khmer script in fields like productTitle rendered blank. Kantumruy Pro
// covers Khmer + Latin (and is already used for Khmer receipts in render.ts),
// so it's embedded here and used for all label text instead.

const FONT_REGULAR = "LabelSans";
const FONT_BOLD = "LabelSans-Bold";

function resolveFontPath(fileName: string): string {
  const candidates = [
    path.join(__dirname, "../assets/fonts", fileName),
    path.join(__dirname, "../../assets/fonts", fileName),
    process.resourcesPath
      ? path.join(process.resourcesPath, "assets/fonts", fileName)
      : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Font file not found: ${fileName}`);
}

function registerFonts(doc: Doc): void {
  doc.registerFont(FONT_REGULAR, resolveFontPath("KantumruyPro-Regular.ttf"));
  doc.registerFont(FONT_BOLD, resolveFontPath("KantumruyPro-Bold.ttf"));
}

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
  productTitle: string; // e.g. 'Test Product (default)'
  barcode: string; // e.g. 'CKPC-014'
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

//  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
//  │                             │  ← QR zone (QR + barcode + title)
//  │       [  QR code  ]         │
//  │            CKPC-014         │
//  │     Test Product (default)  │
//  │                             │
//  ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
//  │   MFG DATE                  │  ← hero block (mfg)
//  │   2025-01-15                │
//  │   ───────────────────│
//  │   EXP DATE                  │  ← hero block (exp)
//  │   2026-12-31                │
//  │   ───────────────────│
//  │   SLOT                      │
//  │   SLOT-A01                  │
//  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

async function renderBig(
  doc: Doc,
  data: LabelData,
  qrSvg: string,
): Promise<void> {
  const { w, h, pad } = SIZES.big;

  // Top ~52% QR zone, bottom info zone
  const qrRowH = h * 0.52;
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

  // ── TOP: QR code + barcode + product title ───────────────────────────────
  const qrTopPad = mm(1.5);
  const barcodeSize = 6.5;
  const barcodeH = mm(2.6);
  const titleSize = 6;
  const titleLH = titleSize * 1.1;
  const titleH = titleLH * 2; // reserve up to 2 lines, overflow ellipsized
  const qrSize = Math.min(
    qrRowH - qrTopPad - barcodeH - titleH - mm(1.1),
    w * 0.62,
  );
  const qrX = (w - qrSize) / 2;

  SVGtoPDF(doc, qrSvg, qrX, qrTopPad, { width: qrSize, height: qrSize });

  const barcodeY = qrTopPad + qrSize + mm(0.8);
  doc
    .font(FONT_BOLD)
    .fontSize(barcodeSize)
    .fillColor("#111111")
    .text(data.barcode, 0, barcodeY, {
      width: w,
      height: barcodeH,
      align: "center",
      lineBreak: false,
    });

  const titleY = barcodeY + barcodeH + mm(0.3);
  doc
    .font(FONT_BOLD)
    .fontSize(titleSize)
    .fillColor("#111111")
    .text(data.productTitle, mm(1), titleY, {
      width: w - mm(2),
      height: titleH,
      align: "center",
      ellipsis: true,
    });

  // ── BOTTOM: info block ───────────────────────────────────────────────────
  const tX = pad;
  const tW = w - pad * 2;
  const heroKeySize = 5.5;
  const heroValSize = 7.5;
  const heroKeyLH = heroKeySize * 1.4;
  const heroValLH = heroValSize * 1.3;
  const secKeySize = 5;
  const secValSize = 6.5;
  const secKeyLH = secKeySize * 1.4;
  const secValLH = secValSize * 1.3;

  let y = infoY + mm(0.8);

  // Full-width labeled row: key line, then value line, both left-aligned.
  const drawField = (
    key: string,
    value: string,
    keySize: number,
    keyLH: number,
    valSize: number,
    valLH: number,
  ): void => {
    doc
      .font(FONT_BOLD)
      .fontSize(keySize)
      .fillColor("#111111")
      .text(key, tX, y, { width: tW, height: keyLH, lineBreak: false });
    y += keyLH + mm(0.2);

    doc
      .font(FONT_BOLD)
      .fontSize(valSize)
      .fillColor("#111111")
      .text(value, tX, y, { width: tW, height: valLH, lineBreak: false });
    y += valLH;
  };

  // ── HERO: MFG DATE ────────────────────────────────────────────────────────
  drawField(
    "MFG DATE / ថ្ងៃផលិត",
    data.manufacturingDate,
    heroKeySize,
    heroKeyLH,
    heroValSize,
    heroValLH,
  );
  y += mm(0.5);
  drawRule(doc, tX, y, tW - mm(2));
  y += mm(0.6);

  // ── HERO: EXP DATE ────────────────────────────────────────────────────────
  drawField(
    "EXP DATE / ថ្ងៃផុតកំណត់",
    data.expirationDate,
    heroKeySize,
    heroKeyLH,
    heroValSize,
    heroValLH,
  );
  y += mm(0.5);
  drawRule(doc, tX, y, tW - mm(2));
  y += mm(0.6);

  // ── SLOT ──────────────────────────────────────────────────────────────────
  drawField("SLOT", data.slot, secKeySize, secKeyLH, secValSize, secValLH);
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

  registerFonts(doc);

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
    "productTitle",
    "barcode",
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
    productTitle: obj.productTitle as string,
    barcode: obj.barcode as string,
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
    productTitle: "Test Product (default)",
    barcode: "CKPC-014",
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
