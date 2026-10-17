import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(root, "apps/web/package.json"));
const sharp = (await import(pathToFileURL(require.resolve("sharp")).href)).default;

const svg = readFileSync(join(root, "apps/web/public/brand/mark.svg"));
const bg = { r: 11, g: 12, b: 16, alpha: 1 };

async function out(size, file, maskable = false) {
  mkdirSync(dirname(file), { recursive: true });
  const pad = Math.round(size * (maskable ? 0.18 : 0.12));
  const inner = size - pad * 2;
  const icon = await sharp(svg)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: icon, left: pad, top: pad }])
    .png()
    .toFile(file);
  console.log("wrote", file);
}

await out(192, join(root, "apps/web/public/brand/teacher-192.png"));
await out(512, join(root, "apps/web/public/brand/teacher-512.png"));
await out(512, join(root, "apps/web/public/brand/teacher-512-maskable.png"), true);
await out(512, join(root, "apps/teacher-android/icon-512.png"));
await out(512, join(root, "apps/teacher-android/icon-512-maskable.png"), true);
