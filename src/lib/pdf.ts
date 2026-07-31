// Server-only PDF text extraction (text-based PDFs). Image/scanned PDFs won't yield
// text here — that path needs OCR/vision and is a follow-up. unpdf bundles pdfjs and
// runs cleanly in Node with no worker setup.

import { extractText, getDocumentProxy } from "unpdf";

/** Extract plain text from a PDF buffer. Returns "" on any failure (never throws). */
export async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text ?? "";
  } catch {
    return "";
  }
}
