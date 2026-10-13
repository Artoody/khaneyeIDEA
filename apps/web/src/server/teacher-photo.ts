import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 3_000_000;
const TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Saves a coach photo under public/media/teachers and returns the public URL. */
export async function saveTeacherPhotoFile(file: File): Promise<{ ok: true; url: string } | { ok: false; reason: "type" | "size" }> {
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, reason: "type" };
  if (file.size < 1 || file.size > MAX_BYTES) return { ok: false, reason: "size" };
  const name = `${randomBytes(12).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "media", "teachers");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { ok: true, url: `/media/teachers/${name}` };
}
