// Offline renderer: drives scene.html frame by frame (deterministic) and writes PNGs.
// Usage:
//   node render.mjs stills <outDir> 0.5 1.2 2.4     -> selected frames
//   node render.mjs frames <outDir> [fps]          -> full sequence (default 120 fps)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const here = path.dirname(new URL(import.meta.url).pathname);
const [, , mode = "stills", outDir = path.join(here, "out", "stills"), ...rest] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--allow-file-access-from-files", "--force-color-profile=srgb", "--disable-gpu-vsync"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => { console.error("[page error]", e.message); process.exitCode = 1; });
await page.goto("file://" + path.join(here, "scene.html"));
await page.evaluate(() => window.ready);

async function grab(t, file) {
  const b64 = await page.evaluate((tt) => {
    window.render(tt);
    return document.getElementById("c").toDataURL("image/png").split(",")[1];
  }, t);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
}

if (mode === "events") {
  // exact event timeline for sound design (screen x is used for stereo panning)
  const ev = await page.evaluate(() => {
    const xf0 = logoXform(0);
    const paths = PATHS.map((p) => {
      const a = uToImg(p.pts[0][0], p.pts[0][1]), b = p.node;
      return { t0: p.t0, t1: p.t1, x0: toScreen(xf0, a[0], a[1])[0], x1: toScreen(xf0, b[0], b[1])[0] };
    });
    const sparks = SPARKS.map((s) => {
      const p = PATHS[s.pi]; const hp = pointAt(p.P, headAt(p, s.tb)); const im = uToImg(hp[0], hp[1]);
      return { t: s.tb, x: toScreen(logoXform(s.tb), im[0], im[1])[0], size: s.size };
    });
    return { W, DURATION, T_PULSE, T_MOVE0, T_MOVE1, T_TEXT, T_ACAD, T_TAG, T_LINE0, T_LINE1,
      title: TITLE.length, acad: ACAD.length, tagWords: TAG.split(" ").length, lineX: LAY.tx, paths, sparks };
  });
  fs.writeFileSync(path.join(outDir, "events.json"), JSON.stringify(ev, null, 1));
} else if (mode === "stills") {
  const times = rest.length ? rest.map(Number) : [0.3, 0.8, 1.3, 1.8, 2.2, 2.7, 3.2, 3.8, 4.95];
  for (const t of times) await grab(t, path.join(outDir, `t${t.toFixed(2)}.png`));
} else {
  const fps = Number(rest[0] || 120);
  const dur = await page.evaluate(() => window.DURATION);
  const n = Math.round(dur * fps);
  const started = Date.now();
  for (let i = 0; i < n; i++) {
    await grab(i / fps, path.join(outDir, `f${String(i).padStart(4, "0")}.png`));
    if (i % 60 === 0) console.log(`frame ${i}/${n} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
}
await browser.close();
