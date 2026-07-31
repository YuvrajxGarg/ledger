import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";

// Shared file storage for user-supplied attachments (reimbursement receipts, manual
// invoice attachments, saved Gmail attachments). Uses Vercel Blob when
// BLOB_READ_WRITE_TOKEN is set (serverless-safe + persistent — required on Vercel),
// otherwise the local public/uploads/ disk for dev. Same graceful pattern as notify.ts.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = /\.(pdf|png|jpe?g|webp)$/i;

/** Duck-typed check for a populated upload (server-action FormData yields a web File). */
function isUpload(v: FormDataEntryValue | null): v is File {
  return (
    !!v &&
    typeof v === "object" &&
    "arrayBuffer" in v &&
    "size" in v &&
    (v as File).size > 0
  );
}

function uniqueName(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
}

/**
 * Persist raw bytes under <subdir>/ and return a public URL. Blob when configured, else
 * local disk. Best-effort — never throws (returns null on failure), so it won't break the
 * surrounding server action / Gmail scan.
 */
export async function saveBuffer(
  buf: Buffer,
  filename: string,
  subdir: string,
): Promise<string | null> {
  const safeSub = subdir.replace(/[^a-zA-Z0-9._-]/g, "_");
  const name = uniqueName(filename);
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`${safeSub}/${name}`, buf, {
        access: "public",
        addRandomSuffix: true,
      });
      return blob.url;
    }
    const dir = path.join(process.cwd(), "public", "uploads", safeSub);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), buf);
    return `/uploads/${safeSub}/${name}`;
  } catch {
    return null;
  }
}

/**
 * Persist an uploaded file (from a server action's FormData). Validates type + size, then
 * stores via saveBuffer. Returns the public URL, or null when absent/rejected.
 */
export async function saveUpload(
  entry: FormDataEntryValue | null,
  subdir: string,
): Promise<string | null> {
  if (!isUpload(entry)) return null;
  const file = entry;
  if (file.size > MAX_BYTES) return null;
  if (!ALLOWED.test(file.name)) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return saveBuffer(buf, file.name, subdir);
}
