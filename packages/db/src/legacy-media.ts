// Moves the old site's article/course images into the new site so nothing depends on the old WordPress server.
//   pnpm --filter @khaneyeidea/db legacy-media
// Needs the export's downloaded assets (docs/site-export/assets/..., created by the site export on your machine).
// Copies each image referenced in posts and courses to apps/web/public/media/legacy/... and rewrites the links.
// Safe to run again: already-local links are left alone; images it cannot find stay as they are and are listed.
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
function localize(url: string): string {
  if (copied.has(url)) return copied.get(url)!;
  const src = localSource(url);
  if (!src) {
    missing.add(url);
    return url;
  }
  const rel = decodeURI(url).replace(/^.*\/wp-content\/uploads\//, "");
  const dest = path.join(PUBLIC, "media/legacy", rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  const local = `/media/legacy/${rel.split("/").map(encodeURIComponent).join("/")}`;
  copied.set(url, local);
  return local;
}
const rewrite = (text: string) => text.replace(URL_RE, (u) => localize(u));

const db = getDb();
let rows = 0;
for (const p of await db.select().from(posts)) {
  const body = { fa: rewrite(p.body.fa), en: rewrite(p.body.en) };
  const coverImage = p.coverImage ? rewrite(p.coverImage) : null;
  if (body.fa !== p.body.fa || body.en !== p.body.en || coverImage !== p.coverImage) {
    await db.update(posts).set({ body, coverImage }).where(eq(posts.id, p.id));
    rows++;
  }
}
for (const c of await db.select().from(courses)) {
  if (!c.body) continue;
  const body = { fa: rewrite(c.body.fa), en: rewrite(c.body.en) };
  if (body.fa !== c.body.fa || body.en !== c.body.en) {
    await db.update(courses).set({ body }).where(eq(courses.id, c.id));
    rows++;
  }
}
await closeDb();

console.log(`copied ${copied.size} images into apps/web/public/media/legacy, updated ${rows} posts/courses`);
if (missing.size) {
  console.log(`${missing.size} images were not in the export and still point to the old site:`);
  for (const m of missing) console.log("  " + m);
}
console.log("Commit apps/web/public/media/legacy so the images ship with the site.");
