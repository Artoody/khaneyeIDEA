// Moves the old site's article/course images into the new site so nothing depends on the old WordPress server.
//   pnpm --filter @khaneyeidea/db legacy-media
// Copies each image referenced in posts and courses to apps/web/public/media/legacy/... and rewrites the links.
// It uses the export's downloaded assets (docs/site-export/assets/...) when they exist; any image not there is
// downloaded from the old site (needs access to khaneyeide.ir, e.g. run it from Iran).
// Safe to run again: already-local links are left alone; images it cannot get stay as they are and are listed.
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { closeDb, courses, getDb, posts } from "./index";
import { EXPORT_DIR } from "./seed/legacy";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const PUBLIC = path.resolve(import.meta.dirname, "../../../apps/web/public");
const URL_RE = /https?:\/\/(?:www\.)?khaneyeide\.ir\/wp-content\/uploads\/[^\s)"']+/g;

type Manifest = { files: { file: string; source_url: string; downloaded?: boolean }[] };
const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "assets-manifest.json"), "utf8"));
const bySource = new Map<string, string>();
for (const f of manifest.files) if (f.downloaded) bySource.set(decodeURI(f.source_url), path.join(EXPORT_DIR, f.file));

/** WordPress serves resized copies ("name-800x800.jpg"); fall back to the original if only that was downloaded. */
function localSource(url: string): string | null {
  const u = decodeURI(url);
  for (const candidate of [u, u.replace(/-\d+x\d+(\.\w+)$/, "$1")]) {
    const file = bySource.get(candidate);
    if (file && fs.existsSync(file)) return file;
  }
  return null;
}

const copied = new Map<string, string>();
const missing = new Set<string>();
const relOf = (url: string) => decodeURI(url).replace(/^.*\/wp-content\/uploads\//, "");
const localUrl = (rel: string) => `/media/legacy/${rel.split("/").map(encodeURIComponent).join("/")}`;

/** Local file from the export, else a download from the old site; null if neither works. */
async function fetchOriginal(url: string, dest: string): Promise<boolean> {
  const src = localSource(url);
  if (src) {
    fs.copyFileSync(src, dest);
    return true;
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return false;
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function localize(url: string): Promise<string> {
  if (copied.has(url)) return copied.get(url)!;
  const rel = relOf(url);
  const dest = path.join(PUBLIC, "media/legacy", rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest) && !(await fetchOriginal(url, dest))) {
    missing.add(url);
    return url;
  }
  const local = localUrl(rel);
  copied.set(url, local);
  return local;
}
async function rewrite(text: string): Promise<string> {
  const urls = [...new Set(text.match(URL_RE) ?? [])];
  const map = new Map<string, string>();
  for (const u of urls) map.set(u, await localize(u));
  return text.replace(URL_RE, (u) => map.get(u) ?? u);
}

const db = getDb();
let rows = 0;
for (const p of await db.select().from(posts)) {
  const body = { fa: await rewrite(p.body.fa), en: await rewrite(p.body.en) };
  const coverImage = p.coverImage ? await rewrite(p.coverImage) : null;
  if (body.fa !== p.body.fa || body.en !== p.body.en || coverImage !== p.coverImage) {
    await db.update(posts).set({ body, coverImage }).where(eq(posts.id, p.id));
    rows++;
  }
}
for (const c of await db.select().from(courses)) {
  if (!c.body) continue;
  const body = { fa: await rewrite(c.body.fa), en: await rewrite(c.body.en) };
  if (body.fa !== c.body.fa || body.en !== c.body.en) {
    await db.update(courses).set({ body }).where(eq(courses.id, c.id));
    rows++;
  }
}
await closeDb();

console.log(`copied ${copied.size} images into apps/web/public/media/legacy, updated ${rows} posts/courses`);
if (missing.size) {
  console.log(`${missing.size} images could not be copied or downloaded and still point to the old site:`);
  for (const m of missing) console.log("  " + m);
}
console.log("Commit apps/web/public/media/legacy so the images ship with the site.");
