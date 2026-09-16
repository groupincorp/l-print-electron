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

// A thermal head is 1-bit: it can only burn a dot or not. Anything that isn't
// pure black gets halftone-dithered into a scatter of dots, which at label type
// sizes reads as a smudge or disappears — so every mark on the label is #000 and
// hairlines are one dot wide (0.125 mm at 203 dpi) rather than a pale grey.
const INK = "#000000";

function drawRule(doc: Doc, x: number, y: number, len: number): void {
  doc
    .moveTo(x, y)
    .lineTo(x + len, y)
    .strokeColor(INK)
    .lineWidth(DOT)
    .stroke();
}

/** Green if not expired, red if past */
export function expColor(dateStr: string): string {
  return new Date(dateStr) < new Date() ? "#c0392b" : "#1a7a4a";
}

function buildQRValue(data: LabelData): string {
  return data.lotId.trim();
}

// ─── QR sizing ────────────────────────────────────────────────────────────────
// The Deli DL-720C head is 203 dpi, so one dot is 72/203 pt. A QR whose module
// is not a whole number of dots gets rounded unevenly by the rasteriser and the
// module edges blur, which costs more scan range than a few tenths of a mm of
// size does. So both the module and the symbol's origin are snapped to whole
// dots. Change PRINTER_DPI if these labels ever move to a 300 dpi head.

const PRINTER_DPI = 203;
const DOT = 72 / PRINTER_DPI;

const snapToDot = (v: number): number => Math.round(v / DOT) * DOT;

const QR_ECC = "H" as const;
const QR_QUIET = 1; // quiet-zone modules per side, emitted by the encoder

interface QRArt {
  svg: string;
  /** Symbol width in modules, including the quiet zone on both sides. */
  units: number;
}

async function buildQR(data: LabelData): Promise<QRArt> {
  const value = buildQRValue(data);

  // create() is what exposes the module count; toString() re-encodes the same
  // value at the same ECC, so the two always agree on the version.
  const symbol = QRCode.create(value, { errorCorrectionLevel: QR_ECC });
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: QR_ECC,
    margin: QR_QUIET,
  });

  return { svg, units: symbol.modules.size + QR_QUIET * 2 };
}

/**
 * Largest symbol whose module is a whole number of dots and that still fits
 * `max`. Rounding the module up can push the symbol a little past `target`,
 * which is intended: at 203 dpi a 6-dot module beats a 5.7-dot one even though
 * it costs ~1.2 mm.
 */
function fitQR(units: number, target: number, max: number): number {
  let dots = Math.max(1, Math.round(target / units / DOT));
  while (dots > 1 && units * dots * DOT > max) dots -= 1;
  return units * dots * DOT;
}

/** Baseline offset from the top of a line box, as a fraction of the font size. */
function ascentRatio(doc: Doc): number {
  const asc = (doc as unknown as { _font?: { ascender?: number } })._font
    ?.ascender;
  return typeof asc === "number" ? asc / 1000 : 0.92;
}

//  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
//  │  ███████   █ ██  ███████   │
//  │  █     █  ██ ██  █     █   │  ← QR: half the label height, 1:1,
//  │  █ ███ █   ███   █ ███ █   │    snapped to a whole-dot module
//  │  ███████  █ █ █  ███████   │
//  │                             │
//  ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
//  │          CKPC-014           │
//  │    Test Product (default)   │
//  │   ───────────────────│
//  │  MFG / ថ្ងៃផលិត      2025-01-15 │  ← key and value share one line
//  │   ───────────────────│
//  │  EXP / ថ្ងៃផុតកំណត់   2026-12-31 │
//  │   ───────────────────│
//  │  SLOT                SLOT-A01 │
//  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

// Type sizes in points. Everything here is fitted around the QR rather than the
// other way round: the old layout derived the QR from whatever vertical space
// the text left over, which is how it shrank to 16 mm — 0.46 mm per module,
// under what a handheld imager resolves.
const BARCODE_SIZE = 7;
const TITLE_SIZE = 5.5;
const TITLE_LINES = 2; // reserve; longer titles are ellipsized
const VAL_SIZE = 7;
const SLOT_VAL_SIZE = 6.5;
const LINE = 1.18; // Kantumruy Pro line box: (920 ascender + 260 descender) / 1000

// Field keys carry stacked Khmer (coeng subscripts, vowel signs) that needs
// real height to survive a 203 dpi head — 5 pt put the whole cluster inside
// 13 dots and it printed as a blur. Keys are bold at 6.5 pt and give way only
// when a long value needs the room.
const KEY_SIZE = 6.5;
const KEY_MIN = 5;
const VAL_MIN = 5.5;
const ROW_GAP = mm(1.2); // minimum clear space between a key and its value

async function renderBig(doc: Doc, data: LabelData, qr: QRArt): Promise<void> {
  const { w, h, pad } = SIZES.big;

  drawBorder(doc, w, h);

  doc.font(FONT_BOLD);
  const ascent = ascentRatio(doc);

  // ── QR ───────────────────────────────────────────────────────────────────
  const qrSize = fitQR(qr.units, h / 2, Math.min(h * 0.55, w - pad * 2));
  const qrTop = snapToDot(mm(1));
  const qrX = snapToDot((w - qrSize) / 2);

  SVGtoPDF(doc, qr.svg, qrX, qrTop, { width: qrSize, height: qrSize });

  // ── Section divider ──────────────────────────────────────────────────────
  const infoY = qrTop + qrSize + mm(0.7);
  doc
    .moveTo(pad, infoY)
    .lineTo(w - pad, infoY)
    .dash(2, { space: 3 })
    .strokeColor("#cccccc")
    .lineWidth(0.5)
    .stroke();
  doc.undash();

  // ── Barcode + product title ──────────────────────────────────────────────
  let y = infoY + mm(0.6);

  doc
    .font(FONT_BOLD)
    .fontSize(BARCODE_SIZE)
    .fillColor(INK)
    .text(data.barcode, 0, y, {
      width: w,
      height: BARCODE_SIZE * LINE,
      align: "center",
      lineBreak: false,
    });
  y += BARCODE_SIZE * LINE;

  doc
    .font(FONT_BOLD)
    .fontSize(TITLE_SIZE)
    .fillColor(INK)
    .text(data.productTitle, mm(1), y, {
      width: w - mm(2),
      height: TITLE_SIZE * LINE * TITLE_LINES,
      align: "center",
      ellipsis: true,
    });
  y += TITLE_SIZE * LINE * TITLE_LINES;

  // ── Fields ───────────────────────────────────────────────────────────────
  const tX = pad;
  const tW = w - pad * 2;

  // One line per field: key left, value right, both on a shared baseline.
  // Values are the reason someone picks the label up, so a row that would
  // collide shrinks the value first and only then the key — slot codes like
  // "4-A-03-MEATBALL9797" are wide enough to need it.
  const widthOf = (text: string, size: number): number =>
    doc.font(FONT_BOLD).fontSize(size).widthOfString(text);

  const fitRow = (
    key: string,
    value: string,
    nominal: number,
  ): { keySize: number; valSize: number } => {
    let keySize = KEY_SIZE;
    let valSize = nominal;
    const overflows = (): boolean =>
      widthOf(key, keySize) + widthOf(value, valSize) + ROW_GAP > tW;

    while (valSize > VAL_MIN && overflows()) valSize -= 0.5;
    while (keySize > KEY_MIN && overflows()) keySize -= 0.5;

    return { keySize, valSize };
  };

  // PDFKit places text by the top of its line box, so each run is offset up
  // from the row's baseline by its own ascent. The baseline itself is pinned to
  // the nominal value size, which keeps the rows on an even rhythm even when a
  // long value forces a smaller face.
  const drawRow = (
    key: string,
    value: string,
    nominal: number,
    fit: { keySize: number; valSize: number } = fitRow(key, value, nominal),
  ): void => {
    const { keySize, valSize } = fit;
    const baseline = y + ascent * nominal;

    doc
      .font(FONT_BOLD)
      .fontSize(keySize)
      .fillColor(INK)
      .text(key, tX, baseline - ascent * keySize, {
        width: tW,
        height: keySize * LINE,
        lineBreak: false,
      });

    doc
      .font(FONT_BOLD)
      .fontSize(valSize)
      .fillColor(INK)
      .text(value, tX, baseline - ascent * valSize, {
        width: tW,
        height: valSize * LINE,
        align: "right",
        lineBreak: false,
        ellipsis: true,
      });

    y += nominal * LINE;
  };

  const drawSeparator = (): void => {
    y += mm(0.5);
    drawRule(doc, tX, y, tW - mm(2));
    y += mm(0.6);
  };

  // The two dates are read against each other, so they share one size:
  // whichever row is tightest sets it for both.
  const mfg: [string, string] = ["MFG / ថ្ងៃផលិត", data.manufacturingDate];
  const exp: [string, string] = ["EXP / ថ្ងៃផុតកំណត់", data.expirationDate];
  const a = fitRow(...mfg, VAL_SIZE);
  const b = fitRow(...exp, VAL_SIZE);
  const dateFit = {
    keySize: Math.min(a.keySize, b.keySize),
    valSize: Math.min(a.valSize, b.valSize),
  };

  drawSeparator();
  drawRow(...mfg, VAL_SIZE, dateFit);
  drawSeparator();
  drawRow(...exp, VAL_SIZE, dateFit);
  drawSeparator();
  drawRow("SLOT", data.slot, SLOT_VAL_SIZE);
}

// ─── Public: generate label PDF ──────────────────────────────────────────────

export async function generateLabel(
  data: LabelData,
  outputPath: string,
): Promise<void> {
  const { w, h } = SIZES[data.size];

  const qr = await buildQR(data);

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
    // await renderSmall(doc, data, qr);
  } else {
    await renderBig(doc, data, qr);
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
    lotNumber: "LOT-2026-0028",
    expirationDate: "2026-12-04",
    sku: "SKU-8809253649255",
    lotId: "3af64575-8a9c-452e-8004-17e4fd921277",
    price: "$9.99",
    manufacturingDate: "2026-09-05",
    slot: "4-A-03-MEATBALL9797",
    productTitle: "ទឹកជ្រលក់ត្រកួនក្រហម 290g (គុណ) (ចំ)",
    barcode: "FREE-028",
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
