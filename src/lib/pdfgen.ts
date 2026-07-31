import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

// Lightweight PDF builder on pdf-lib for internal documents (generated invoices,
// dispatch summaries). Not for reading PDFs — that's src/lib/pdf.ts (unpdf).

export type PdfTable = {
  columns: string[];
  rows: string[][];
  widths?: number[]; // column width fractions (sum ~1); defaults to equal
  align?: ("left" | "right")[];
};

export type PdfSection = { heading?: string; table?: PdfTable; note?: string };

export type PdfDocSpec = {
  title: string;
  subtitle?: string;
  meta?: [string, string][];
  sections?: PdfSection[];
  footer?: string;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;

// The 14 standard PDF fonts use WinAnsi encoding, which can't encode ₹ (0x20B9) or various
// smart-punctuation glyphs. Map those to ASCII so drawing never throws.
function clean(s: string): string {
  return (s ?? "")
    .replace(/₹/g, "Rs ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x00-\xFF]/g, "?");
}
const GRAY = rgb(0.45, 0.45, 0.45);
const DARK = rgb(0.1, 0.1, 0.1);
const LINE = rgb(0.85, 0.85, 0.85);

export async function buildPdf(spec: PdfDocSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const contentW = A4[0] - MARGIN * 2;

  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;

  const ensure = (space: number) => {
    if (y - space < MARGIN + 30) {
      page = doc.addPage(A4);
      y = A4[1] - MARGIN;
    }
  };

  const fit = (raw: string, f: PDFFont, size: number, maxW: number) => {
    let t = clean(raw);
    if (f.widthOfTextAtSize(t, size) <= maxW) return t;
    while (t.length > 1 && f.widthOfTextAtSize(t + "...", size) > maxW) t = t.slice(0, -1);
    return t + "...";
  };

  const text = (
    s: string,
    x: number,
    size: number,
    f: PDFFont,
    color = DARK,
  ) => page.drawText(clean(s), { x, y, size, font: f, color });

  // Header
  text(spec.title, MARGIN, 20, bold);
  y -= 26;
  if (spec.subtitle) {
    text(spec.subtitle, MARGIN, 11, font, GRAY);
    y -= 18;
  }

  // Meta lines
  if (spec.meta?.length) {
    y -= 4;
    for (const [k, v] of spec.meta) {
      ensure(16);
      text(`${k}:`, MARGIN, 10, bold, GRAY);
      text(fit(v, font, 10, contentW - 120), MARGIN + 110, 10, font);
      y -= 15;
    }
  }
  y -= 10;

  for (const section of spec.sections ?? []) {
    if (section.heading) {
      ensure(24);
      text(section.heading, MARGIN, 12, bold);
      y -= 18;
    }
    if (section.table) drawTable(section.table);
    if (section.note) {
      ensure(16);
      text(fit(section.note, font, 9, contentW), MARGIN, 9, font, GRAY);
      y -= 14;
    }
    y -= 8;
  }

  if (spec.footer) {
    const fy = MARGIN - 15;
    page.drawText(fit(spec.footer, font, 8, contentW), {
      x: MARGIN,
      y: fy,
      size: 8,
      font,
      color: GRAY,
    });
  }

  function drawTable(t: PdfTable) {
    const n = t.columns.length;
    const widths = t.widths ?? Array(n).fill(1 / n);
    const xs: number[] = [];
    let acc = MARGIN;
    for (let i = 0; i < n; i++) {
      xs.push(acc);
      acc += widths[i] * contentW;
    }
    const cellW = (i: number) => widths[i] * contentW - 6;

    const drawRow = (cells: string[], f: PDFFont, size: number, color = DARK) => {
      ensure(18);
      for (let i = 0; i < n; i++) {
        const s = fit(cells[i] ?? "", f, size, cellW(i));
        const right = t.align?.[i] === "right";
        const x = right ? xs[i] + widths[i] * contentW - 6 - f.widthOfTextAtSize(s, size) : xs[i];
        page.drawText(s, { x, y, size, font: f, color });
      }
      y -= 16;
    };

    drawRow(t.columns, bold, 9, GRAY);
    // header underline
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: MARGIN + contentW, y: y + 6 },
      thickness: 0.5,
      color: LINE,
    });
    y -= 2;
    for (const row of t.rows) drawRow(row, font, 10);
  }

  return doc.save();
}
