import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { chromium } from "playwright-core";

const here = path.dirname(new URL(import.meta.url).pathname);
const [, , mdPath, outPath, mode] = process.argv;
const brief = mode === "--brief";
const nm = path.join(here, "node_modules");
const fontDir = path.join(nm, "vazirmatn/fonts/webfonts");

let md = fs.readFileSync(mdPath, "utf8");
// Drop title block (everything before the first horizontal rule); the cover replaces it.
if (!brief) md = md.slice(md.indexOf("\n---\n") + 5);


const renderer = new marked.Renderer();
const headings = [];
renderer.code = ({ text, lang }) => {
  if (lang === "mermaid") return `<div class="diagram" dir="ltr"><pre class="mermaid">${text}</pre></div>`;
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const dir = /[؀-ۿ]/.test(text) ? "rtl" : "ltr";
  return `<pre dir="${dir}"><code>${esc}</code></pre>`;
};
renderer.heading = function ({ tokens, depth, text }) {
  const inner = this.parser.parseInline(tokens);
  const id = `h-${headings.length}`;
  if (depth === 2) headings.push({ id, text });
  return `<h${depth} id="${id}">${inner}</h${depth}>`;
};
renderer.hr = () => "";
marked.use({ renderer, gfm: true });
const body = marked.parse(md);

const toc = headings
  .map((h) => `<li><a href="#${h.id}">${h.text.replace(/\*\*/g, "")}</a></li>`)
  .join("");

const fontFaces = [
  [300, "Light"], [400, "Regular"], [500, "Medium"], [600, "SemiBold"], [700, "Bold"], [800, "ExtraBold"], [900, "Black"],
].map(([w, n]) => `@font-face{font-family:Vazirmatn;font-weight:${w};src:url("file://${fontDir}/Vazirmatn-${n}.woff2") format("woff2");}`).join("\n");

const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>پروپوزال پلتفرم خانه ایده</title>
<style>
${fontFaces}
:root{
  --ink:#18181b; --muted:#52525b; --line:#e4e4e7; --soft:#f4f4f5;
  --accent:#0f766e; --accent-soft:#e6f4f2; --accent-ink:#0b4f4a;
}
@page{ size:A4; margin:18mm 16mm 20mm 16mm; }
${brief ? "@page{ margin:14mm 16mm; } body{ font-size:10.2pt; line-height:1.85; } h2{ margin:5mm 0 2mm !important; font-size:14pt !important; } li{ margin:0 0 .6mm !important; } table{ margin:2mm 0 3mm !important; } td,th{ padding:1.6mm 3mm !important; }" : "@page :first{ margin:0; }"}
*{ box-sizing:border-box; }
html,body{ margin:0; }
body{ font-family:Vazirmatn, sans-serif; color:var(--ink); font-size:10.6pt; line-height:1.95; background:#fff; }

/* Cover */
.cover{ height:297mm; width:210mm; position:relative; overflow:hidden; background:var(--accent-ink); color:#f8fafc; page-break-after:always; display:flex; flex-direction:column; justify-content:space-between; padding:26mm 22mm; }
.cover::before{ content:""; position:absolute; inset:auto -40mm -60mm auto; width:170mm; height:170mm; border-radius:50%; background:radial-gradient(circle at 30% 30%, rgba(94,234,212,.35), rgba(15,118,110,0) 65%); }
.cover::after{ content:""; position:absolute; top:-30mm; left:-30mm; width:110mm; height:110mm; border-radius:50%; border:1px solid rgba(255,255,255,.12); }
.cover .brand{ font-weight:800; font-size:13pt; letter-spacing:0; opacity:.9; position:relative; z-index:1; }
.cover h1{ font-size:34pt; line-height:1.35; margin:0 0 6mm; font-weight:900; position:relative; z-index:1; }
.cover .sub{ font-size:13pt; line-height:1.9; max-width:140mm; color:#ccfbf1; position:relative; z-index:1; }
.cover .meta{ position:relative; z-index:1; display:flex; gap:12mm; font-size:10pt; color:#a7f3d0; }
.cover .meta b{ display:block; color:#fff; font-size:11pt; }
.pill-row{ display:flex; flex-wrap:wrap; gap:3mm; margin-top:10mm; position:relative; z-index:1; }
.pill{ border:1px solid rgba(255,255,255,.28); border-radius:999px; padding:1.5mm 5mm; font-size:9.5pt; color:#ecfeff; }

/* TOC */
.toc{ page-break-after:always; }
.toc h2{ border:0; margin-top:0; }
.toc ol{ list-style:none; padding:0; margin:0; columns:1; }
.toc li{ padding:2.4mm 0; border-bottom:1px solid var(--line); font-size:11.5pt; }
.toc a{ color:var(--ink); text-decoration:none; }

/* Content */
h2{ font-size:17pt; font-weight:800; color:var(--accent-ink); margin:12mm 0 4mm; padding-bottom:2.5mm; border-bottom:2px solid var(--accent); break-after:avoid; }
main > h1{ font-size:22pt; font-weight:900; color:var(--accent-ink); margin:0 0 4mm; padding-bottom:3mm; border-bottom:3px solid var(--accent); }
h3{ font-size:12.8pt; font-weight:700; color:var(--ink); margin:8mm 0 2mm; break-after:avoid; }
h3::before{ content:""; display:inline-block; width:2.2mm; height:2.2mm; background:var(--accent); border-radius:1px; margin-left:2.5mm; vertical-align:middle; }
p{ margin:0 0 3mm; }
strong{ font-weight:700; color:#0b0b0d; }
a{ color:var(--accent); text-decoration:none; word-break:break-word; }
ul,ol{ padding-right:6mm; padding-left:0; margin:0 0 3mm; }
li{ margin:0 0 1.2mm; }
main ol{ list-style-type:persian; }
ul ul{ list-style-type:circle; }
li > ul, li > ol{ margin-top:1.2mm; }
blockquote{ margin:4mm 0; padding:3mm 5mm; background:var(--accent-soft); border-right:3px solid var(--accent); border-radius:2mm; color:var(--accent-ink); break-inside:avoid; }
blockquote p:last-child{ margin:0; }
code{ font-family:Vazirmatn, monospace; background:var(--soft); border:1px solid var(--line); border-radius:1.2mm; padding:0 1.4mm; font-size:9.4pt; direction:ltr; unicode-bidi:isolate; }
pre{ background:#fafafa; border:1px solid var(--line); border-radius:2mm; padding:4mm 5mm; font-size:9.6pt; line-height:1.9; white-space:pre-wrap; break-inside:avoid; }
pre code{ background:none; border:0; padding:0; direction:inherit; unicode-bidi:normal; font-size:inherit; }
table{ width:100%; border-collapse:separate; border-spacing:0; margin:3mm 0 5mm; font-size:9.6pt; line-height:1.8; border:1px solid var(--line); border-radius:2mm; overflow:hidden; }
thead th{ background:var(--accent-ink); color:#fff; font-weight:700; text-align:right; padding:2.4mm 3mm; }
td{ padding:2.2mm 3mm; vertical-align:top; border-top:1px solid var(--line); }
tbody tr:nth-child(even) td{ background:#fafafa; }
tr{ break-inside:avoid; }
.diagram{ margin:5mm 0; padding:4mm; border:1px solid var(--line); border-radius:2mm; background:#fcfcfc; break-inside:avoid; text-align:center; }
.diagram svg{ max-width:100%; height:auto; }
pre.mermaid{ background:none; border:0; padding:0; margin:0; }
</style>
</head>
<body>
${brief ? "" : `<section class="cover">
  <div class="brand">خانه ایده · آموزشگاه رباتیک، برنامه‌نویسی و هوش مصنوعی</div>
  <div>
    <h1>پروپوزال پلتفرم هوشمند<br>خانه ایده</h1>
    <div class="sub">سایت، پنل‌های مدیریت و آموزش، ربات بله و تلگرام، رزرو خودکار وقت، گزارش هوشمند جلسات و بازی کشف علاقه برای بچه‌ها.</div>
    <div class="pill-row">
      <span class="pill">اتاق کنترل ادمین</span><span class="pill">رزرو خودکار</span><span class="pill">ربات بله و تلگرام</span>
      <span class="pill">گزارش جلسه با ویس</span><span class="pill">سفر کاوشگر</span><span class="pill">۳۲ ایده‌ی تمایز</span>
    </div>
  </div>
  <div class="meta">
    <div><b>نام کاری محصول</b>ایده‌یار</div>
    <div><b>نسخه</b>۰.۳، پیش‌نویس برای بررسی</div>
    <div><b>تاریخ</b>مهر ۱۴۰۵</div>
  </div>
</section>
<section class="toc">
  <h2>فهرست</h2>
  <ol>${toc}</ol>
</section>`}
<main>${body}</main>
<script src="file://${nm}/mermaid/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({ startOnLoad:false, theme:"base", fontFamily:"Vazirmatn",
    themeVariables:{ primaryColor:"#e6f4f2", primaryBorderColor:"#0f766e", primaryTextColor:"#18181b", lineColor:"#52525b", clusterBkg:"#fafafa", clusterBorder:"#d4d4d8", fontSize:"15px" } });
  mermaid.run().then(()=>{ document.body.dataset.ready = "1"; }).catch(e=>{ document.body.dataset.ready = "err:"+e; });
</script>
</body>
</html>`;

const htmlPath = path.join(here, "proposal.html");
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.goto("file://" + htmlPath, { waitUntil: "load" });
await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 30000 });
console.log("mermaid:", await page.evaluate(() => document.body.dataset.ready));
await page.evaluate(() => document.fonts.ready);
const footer = `<div style="width:100%;font-size:8px;color:#71717a;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif;"><span>Khaneye Idea Platform Proposal v0.3</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
if (brief) {
  await page.pdf({ path: outPath, format: "A4", printBackground: true, preferCSSPageSize: true });
  await browser.close();
} else {
  await page.pdf({ path: outPath + ".cover.pdf", format: "A4", printBackground: true, preferCSSPageSize: true, pageRanges: "1" });
  await page.pdf({ path: outPath + ".body.pdf", format: "A4", printBackground: true, preferCSSPageSize: true, pageRanges: "2-",
    displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: footer });
  await browser.close();
  const { execFileSync } = await import("node:child_process");
  execFileSync("pdfunite", [outPath + ".cover.pdf", outPath + ".body.pdf", outPath]);
  fs.unlinkSync(outPath + ".cover.pdf"); fs.unlinkSync(outPath + ".body.pdf");
}
console.log("wrote", outPath);
