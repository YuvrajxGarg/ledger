import { promises as fs } from "fs";
import path from "path";

// Shared file-upload helper for user-supplied attachments (reimbursement receipts,
// manual invoice attachments, …). Files land in public/uploads/<subdir>/ and are served
// statically by Next. Mirrors the Gmail attachment convention in src/lib/gmail.ts.

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

/**
 * Persist an uploaded file under public/uploads/<subdir>/ and return its public URL.
 * Returns null when no file was supplied or the file is rejected (best-effort — never
 * throws, so it won't blow up the surrounding server action). Type/size are validated.
 */
export async function saveUpload(
  entry: FormDataEntryValue | null,
  subdir: string,
): Promise<string | null> {
  if (!isUpload(entry)) return null;
  const file = entry;
  if (file.size > MAX_BYTES) return null;
  if (!ALLOWED.test(file.name)) return null;

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const safeSub = subdir.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dir = path.join(process.cwd(), "public", "uploads", safeSub);
    await fs.mkdir(dir, { recursive: true });
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    await fs.writeFile(path.join(dir, name), buf);
    return `/uploads/${safeSub}/${name}`;
  } catch {
    return null;
  }
}
