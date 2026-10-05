/**
 * Read-only public export of https://khaneyeide.ir/
 * Does not log in, does not call /wp-admin or /wp-login, does not submit forms.
 * Honors robots.txt (only MJ12bot is disallowed) and waits at least 1s between requests.
 */
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const OUT = path.join(REPO, "docs", "site-export");
const JSON_DIR = path.join(OUT, "wp-json");
const CONTENT_DIR = path.join(OUT, "content");
const DISCOVERY = path.join(OUT, "discovery");
const ASSETS = path.join(REPO, "assets", "raw", "site");
const CACHE = path.join(__dirname, ".cache");

const ORIGIN = "https://khaneyeide.ir";
const UA = "khaneyeide-export";
const MIN_GAP_MS = 1100;
const MAX_PAGES = 300;
const MAX_ASSET_BYTES = 150 * 1024 * 1024;

const BLOCKED = [/^\/wp-admin(\/|$)/i, /^\/wp-login\.php$/i, /^\/wp-login(\/|$)/i];

let lastRequestAt = 0;
const stats = { requests: 0, errors: [] };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function cachePath(key) {
  const hash = createHash("sha1").update(key).digest("hex");
  return path.join(CACHE, hash + ".json");
}

function isBlocked(url) {
  let pathname = "/";
  try {
    pathname = new URL(url).pathname;
  } catch {
    return true;
  }
  return BLOCKED.some((re) => re.test(pathname));
}

async function politeFetch(url, { binary = false } = {}) {
  if (isBlocked(url)) {
    throw new Error("blocked url " + url);
  }
  const key = (binary ? "b:" : "t:") + url;
  const cached = cachePath(key);
  if (fs.existsSync(cached)) {
    const saved = JSON.parse(fs.readFileSync(cached, "utf8"));
    return {
      url: saved.url,
      status: saved.status,
      headers: new Map(Object.entries(saved.headers || {})),
      body: binary ? Buffer.from(saved.body, "base64") : saved.body,
      fromCache: true,
    };
  }
  const wait = MIN_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  stats.requests += 1;
  process.stdout.write(`GET ${stats.requests} ${url}\n`);
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: binary ? "*/*" : "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
    },
  });
  const finalUrl = res.url;
  if (isBlocked(finalUrl)) {
    throw new Error("redirected to blocked url " + finalUrl);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const headers = {};
  for (const [k, v] of res.headers.entries()) headers[k.toLowerCase()] = v;
  const body = binary ? buf : buf.toString("utf8");
  ensureDir(CACHE);
  fs.writeFileSync(
    cached,
    JSON.stringify({
      url: finalUrl,
      status: res.status,
      headers,
      body: binary ? buf.toString("base64") : body,
    })
  );
  return {
    url: finalUrl,
    status: res.status,
    headers: new Map(Object.entries(headers)),
    body,
    fromCache: false,
  };
}

function decodePath(url) {
  const u = new URL(url);
  let pathname = u.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* keep */
  }
  return u.origin + pathname + u.search + u.hash;
}

function encodePath(url) {
  const u = new URL(url);
  let pathname = u.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* already mixed */
  }
  const encoded = pathname
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return u.origin + encoded + u.search;
}

function sameHost(url) {
  try {
    const u = new URL(url);
    return u.hostname === "khaneyeide.ir" || u.hostname === "www.khaneyeide.ir";
  } catch {
    return false;
  }
}

function absUrl(href, base) {
  if (!href) return null;
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("data:")) return null;
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}

function fileSlug(url) {
  const u = new URL(url);
  let p = u.pathname;
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep */
  }
  p = p.replace(/^\/+|\/+$/g, "");
  if (!p) return "index";
  p = p.replace(/\//g, "__").replace(/[<>:"\\|?*\u0000-\u001f]/g, "_");
  return p.slice(0, 90);
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function textOf($, el) {
  return $(el).text().replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

function classify(url, title, wpType) {
  const decoded = decodePath(url);
  const blob = `${decoded} ${title || ""}`;
  if (new URL(url).pathname === "/" || /صفحه-اصلی|صفحه اصلی/.test(blob)) return "home";
  if (/تماس/.test(blob)) return "contact";
  if (/افتخار/.test(blob)) return "achievement";
  if (/پروژه/.test(blob)) return "project";
  if (/دپارتمان/.test(blob)) return "department";
  if (/ثبت-نام|ثبت نام|مراحل-ثبت/.test(blob)) return "registration";
  if (/\/shop\/?$/.test(new URL(url).pathname) || /فروشگاه/.test(blob)) return "shop";
  if (/\/category\//.test(new URL(url).pathname)) return "category";
  if (/\/author\//.test(new URL(url).pathname)) return "author";
  if (/دوره|آموزش|ai-course|هوش-مصنوعی|هوش مصنوعی/.test(blob)) return "course";
  if (wpType === "post") return "article";
  if (/404/.test(blob)) return "utility";
  return wpType === "page" ? "page" : "other";
}

function htmlToMarkdown($, root) {
  const lines = [];
  function walk(node) {
    if (!node) return;
    if (node.type === "text") {
      const t = String(node.data || "").replace(/\s+/g, " ");
      if (t.trim()) lines.push(t);
      return;
    }
    if (node.type !== "tag") return;
    const tag = node.name;
    if (["script", "style", "noscript", "svg", "template"].includes(tag)) return;
    if (tag === "br") {
      lines.push("\n");
      return;
    }
    if (/^h[1-6]$/.test(tag)) {
      const t = textOf($, node);
      if (t) lines.push(`\n${"#".repeat(Number(tag[1]))} ${t}\n`);
      return;
    }
    if (tag === "img") {
      const src = $(node).attr("src") || $(node).attr("data-src") || "";
      const alt = $(node).attr("alt") || "";
      if (src) lines.push(`\n![${alt}](${src})\n`);
      return;
    }
    if (tag === "li") {
      const clone = $(node).clone();
      clone.children("ul,ol").remove();
      const t = clone.text().replace(/\s+/g, " ").trim();
      if (t) lines.push(`- ${t}`);
      $(node)
        .children("ul,ol")
        .each((_, child) => walk(child));
      return;
    }
    const children = node.children || [];
    for (const child of children) walk(child);
    if (["p", "div", "section", "article", "tr", "blockquote"].includes(tag)) lines.push("\n");
  }
  walk(root);
  return lines
    .join(" ")
    .replace(/[ ]+\n/g, "\n")
    .replace(/\n[ ]+/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectImages($, pageUrl) {
  const found = [];
  const push = (src, alt) => {
    const abs = absUrl(src, pageUrl);
    if (!abs) return;
    if (!/\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(abs) && !/wp-content\/uploads\//.test(abs)) return;
    found.push({ src: abs.split("#")[0], alt: (alt || "").trim() });
  };
  $("img").each((_, el) => {
    push($(el).attr("src"), $(el).attr("alt"));
    push($(el).attr("data-src"), $(el).attr("alt"));
    push($(el).attr("data-lazy-src"), $(el).attr("alt"));
    const srcset = $(el).attr("srcset") || $(el).attr("data-srcset") || "";
    for (const part of srcset.split(",")) {
      const bit = part.trim().split(/\s+/)[0];
      if (bit) push(bit, $(el).attr("alt"));
    }
  });
  $("source").each((_, el) => {
    const srcset = $(el).attr("srcset") || "";
    for (const part of srcset.split(",")) {
      const bit = part.trim().split(/\s+/)[0];
      if (bit) push(bit, "");
    }
  });
  $("[style*='url(']").each((_, el) => {
    const style = $(el).attr("style") || "";
    for (const m of style.matchAll(/url\((['"]?)(.*?)\1\)/g)) push(m[2], "");
  });
  return found;
}

function collectLinks($, pageUrl) {
  const links = [];
  $("a[href]").each((_, el) => {
    const abs = absUrl($(el).attr("href"), pageUrl);
    if (!abs || !sameHost(abs)) return;
    const u = new URL(abs);
    if (isBlocked(abs)) return;
    if (/\.(png|jpe?g|webp|gif|svg|pdf|zip|css|js)(\?|$)/i.test(u.pathname)) return;
    links.push({
      href: u.origin + u.pathname + (u.search || ""),
      text: textOf($, el).slice(0, 180),
    });
  });
  const seen = new Set();
  return links.filter((l) => {
    const key = l.href.replace(/\/$/, "") + "|" + l.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseJsonLd($) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      blocks.push({ _unparsed: true, raw });
    }
  });
  return blocks;
}

function openGraph($) {
  const og = {};
  $("meta").each((_, el) => {
    const prop = $(el).attr("property") || $(el).attr("name") || "";
    if (/^(og:|twitter:|article:)/.test(prop)) og[prop] = $(el).attr("content") ?? null;
  });
  return og;
}

function contentRoot($) {
  const main = $("main").first();
  const root = main.length ? main : $("body");
  root
    .find(
      "script,style,noscript,header,footer,nav,.elementor-location-header,.elementor-location-footer,.skip-link"
    )
    .remove();
  return root.get(0);
}

function headingsOf($, root) {
  const list = [];
  $(root)
    .find("h1,h2,h3")
    .each((_, el) => {
      const t = textOf($, el);
      if (t) list.push({ level: el.name.toUpperCase(), text: t });
    });
  return list;
}

function navTree($) {
  const menus = [];
  $("nav .elementor-nav-menu, nav ul").each((_, ul) => {
    if ($(ul).parents("ul").length) return;
    const items = [];
    $(ul)
      .children("li")
      .each((__, li) => {
        const a = $(li).children("a").first();
        const item = {
          label: textOf($, a).replace(/\s+/g, " ").trim() || null,
          url: absUrl(a.attr("href"), ORIGIN),
          children: [],
        };
        $(li)
          .find("ul")
          .first()
          .children("li")
          .each((___, sub) => {
            const sa = $(sub).children("a").first();
            item.children.push({
              label: textOf($, sa).replace(/\s+/g, " ").trim() || null,
              url: absUrl(sa.attr("href"), ORIGIN),
            });
          });
        if (item.label) items.push(item);
      });
    if (items.length) menus.push(items);
  });
  if (!menus.length) return [];
  menus.sort((a, b) => b.length - a.length);
  return menus[0];
}

function footerLinks($) {
  let scope = $("[data-elementor-type='footer'], footer, .elementor-location-footer").first();
  if (!scope.length) {
    const h = $("h2")
      .filter((_, el) => /دسترسی سریع|شبکه های اجتماعی|شبکه‌های اجتماعی/.test($(el).text()))
      .first();
    if (h.length) scope = h.parents("section, .e-con, .elementor-section").last();
  }
  if (!scope.length) return [];
  const links = [];
  const seen = new Set();
  scope.find("a[href]").each((_, el) => {
    const label = textOf($, el).replace(/\s+/g, " ").trim();
    const url = absUrl($(el).attr("href"), ORIGIN);
    if (!label && !url) return;
    const key = (label || "") + "|" + (url || "");
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ label: label || null, url });
  });
  return links;
}

function visibleBits($) {
  const bits = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = textOf($, el).replace(/\s+/g, " ").trim();
    if (href) bits.push(`${href} ${text}`.trim());
  });
  $(".elementor-icon-list-text, .elementor-heading-title, iframe[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) bits.push(src);
    const t = textOf($, el).replace(/\s+/g, " ").trim();
    if (t) bits.push(t);
  });
  return bits.join("\n");
}

function formsOf($, pageUrl) {
  const forms = [];
  $("form").each((_, el) => {
    const actionRaw = $(el).attr("action");
    const action = actionRaw ? absUrl(actionRaw, pageUrl) : null;
    const fields = [];
    $(el)
      .find("input,textarea,select,button")
      .each((__, field) => {
        const id = $(field).attr("id");
        let label = null;
        if (id) {
          const lab = $(el).find(`label[for='${id.replace(/'/g, "\\'")}']`).first();
          if (lab.length) label = textOf($, lab) || null;
        }
        if (!label) {
          const group = $(field).closest(".elementor-field-group, .elementor-field, p, div");
          const lab = group.find("label").first();
          if (lab.length) label = textOf($, lab) || null;
        }
        fields.push({
          tag: field.name,
          name: $(field).attr("name") || null,
          type: $(field).attr("type") || (field.name === "textarea" ? "textarea" : field.name === "select" ? "select" : null),
          label,
          placeholder: $(field).attr("placeholder") || null,
        });
      });
    forms.push({
      page: pageUrl,
      action: action || null,
      method: ($(el).attr("method") || null),
      id: $(el).attr("id") || null,
      class: $(el).attr("class") || null,
      fields,
    });
  });
  return forms;
}

const PLACE_WORDS = [
  ["کره جنوبی", "کره جنوبی"],
  ["تایوان", "تایوان"],
  ["روسیه", "روسیه"],
  ["ژاپن", "ژاپن"],
  ["فرانسه", "فرانسه"],
  ["سنگاپور", "سنگاپور"],
  ["آلمان", "آلمان"],
  ["رومانی", "رومانی"],
  ["ترکیه", "ترکیه"],
  ["امارات", "امارات"],
  ["چین", "چین"],
  ["ایران", "ایران"],
];

function competitionOf(text) {
  if (/ربوکاپ|روبوکاپ|robocup/i.test(text)) return "RoboCup";
  if (/فیراکاپ|فیرا کاپ|fira/i.test(text)) return "فیراکاپ";
  if (/خوارزمی/.test(text)) return "جشنواره خوارزمی";
  if (/تکنوفست|teknofest/i.test(text)) return "تکنوفست";
  if (/پیمان شانگهای/.test(text)) return "مسابقات رباتیک و مهارت کشورهای عضو پیمان شانگهای";
  if (/اختراع/.test(text)) return "مسابقات اختراعات";
  return null;
}

function countryOf(text) {
  for (const [word, country] of PLACE_WORDS) {
    if (text.includes(word)) return country;
  }
  return null;
}

function yearOf(text) {
  const m = text.match(/20\d{2}/);
  return m ? Number(m[0]) : null;
}

function parseAchievements(text, pageUrl) {
  const chunks = text
    .split(/\n+|(?=رتبه )|(?=مقام )|(?=مدال )|(?=جایزه )|(?=کسب رتبه)|(?=سرتیفیکیت)|(?=تندیس)/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 12 && s.length < 400);
  const seen = new Set();
  const out = [];
  for (const title of chunks) {
    if (!/رتبه|مقام|مدال|جایزه|سرتیفیکیت|تندیس|کسب عنوان/.test(title)) continue;
    const key = title.replace(/\s/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title,
      year: yearOf(title),
      competition: competitionOf(title),
      country: countryOf(title),
      page_url: pageUrl,
    });
  }
  return out;
}

function persianDigits(s) {
  return s.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

function courseFromPage(page) {
  const title = page.h1 || page.title;
  const head = persianDigits(`${page.title}\n${page.h1 || ""}\n${page.metaDescription || ""}`);
  const blob = persianDigits(`${head}\n${page.markdown}`);
  const age = blob.match(/(\d{1,2})\s*تا\s*(\d{1,2})\s*سال/);
  const duration = blob.match(/(\d{1,3})\s*(ساعت|جلسه|ماه|هفته|ترم)/);
  const sessions = blob.match(/(\d{1,3})\s*جلسه/);
  const price = blob.match(/(\d[\d,]*)\s*(تومان|ریال)/);
  const modes = [];
  if (/آنلاین|انلاین/.test(blob)) modes.push("online");
  if (/حضوری/.test(blob)) modes.push("in-person");
  let level = null;
  if (/مبتدی/.test(head) && /حرفه/.test(head)) level = "مبتدی تا حرفه‌ای";
  else if (/پیشرفته/.test(head)) level = "پیشرفته";
  else if (/متوسط/.test(head)) level = "متوسط";
  else if (/مبتدی/.test(head)) level = "مبتدی";
  let syllabus = null;
  const syl = page.markdown.match(/#{1,3}[^\n]*سرفصل[\s\S]*?(?=\n#{1,3} |$)/);
  if (syl) {
    const items = [...syl[0].matchAll(/^- (.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
    syllabus = items.length ? items : null;
  }
  const dept = blob.match(/دپارتمان\s+([^\n،.]{2,60})/);
  return {
    name: title || null,
    department: dept ? dept[1].trim() : null,
    age_range: age ? `${age[1]} تا ${age[2]} سال` : null,
    level,
    duration: duration ? `${duration[1]} ${duration[2]}` : null,
    sessions: sessions ? Number(sessions[1]) : null,
    price: price ? `${price[1]} ${price[2]}` : null,
    modes: modes.length ? modes : null,
    syllabus,
    page_url: page.urlDecoded,
  };
}

function looksLikeMinorContext(page) {
  const blob = `${page.title} ${page.headings.map((h) => h.text).join(" ")} ${page.images.map((i) => i.alt).join(" ")}`;
  return /دانش[\s‌]*آموز|کودک|نوجوان|دبستان|دانش[\s‌]*پژوه|گالری افتخار/.test(blob);
}

function imagePriority(item) {
  const blob = `${item.source_url} ${item.alt || ""} ${item.page || ""} ${item.role || ""}`;
  if (item.role === "logo" || /logo|logopit|favicon|\.svg(\?|$)/i.test(blob)) return 0;
  if (item.role === "hero") return 1;
  if (item.role === "award" || /افتخار|award|medal|certificate/i.test(blob)) return 2;
  if (item.role === "project" || /پروژه/.test(blob)) return 3;
  if (item.role === "team" || /مربی|استاد|تیم/.test(blob)) return 4;
  return 5;
}

function canonUrl(url) {
  const u = new URL(url);
  let pathname = u.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* keep */
  }
  return "https://khaneyeide.ir" + pathname;
}

function withoutSize(url) {
  return canonUrl(url).replace(/-\d+x\d+(?=\.(?:png|jpe?g|webp|gif|avif)$)/i, "");
}

function imageSize(buf) {
  if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const format = buf.toString("ascii", 12, 16);
    if (format === "VP8X" && buf.length >= 30) {
      const width = 1 + buf.readUIntLE(24, 3);
      const height = 1 + buf.readUIntLE(27, 3);
      return { width, height };
    }
    if (format === "VP8 " && buf.length >= 30) {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  }
  if (buf.length >= 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length && buf.toString("utf8", 0, 200).includes("<svg")) {
    const head = buf.toString("utf8", 0, 500);
    const w = head.match(/\bwidth="([\d.]+)/);
    const h = head.match(/\bheight="([\d.]+)/);
    return {
      width: w ? Math.round(Number(w[1])) : null,
      height: h ? Math.round(Number(h[1])) : null,
    };
  }
  return { width: null, height: null };
}

function safeFileName(url) {
  const u = new URL(url);
  let base = path.basename(u.pathname);
  try {
    base = decodeURIComponent(base);
  } catch {
    /* keep */
  }
  base = base.replace(/[<>:"\\|?*\u0000-\u001f]/g, "_");
  if (base.length > 140) {
    const ext = path.extname(base).slice(0, 8);
    base = base.slice(0, 80) + "-" + createHash("sha1").update(url).digest("hex").slice(0, 8) + ext;
  }
  return base || "file";
}

async function fetchCollection(resource) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const url = `${ORIGIN}/wp-json/wp/v2/${resource}?per_page=100&page=${page}`;
    const res = await politeFetch(url);
    if (res.status === 400 || res.status === 404) break;
    if (res.status !== 200) {
      stats.errors.push({ url, status: res.status });
      break;
    }
    const data = JSON.parse(res.body);
    if (!Array.isArray(data) || data.length === 0) break;
    writeJson(path.join(JSON_DIR, `${resource}-${page}.json`), data);
    all.push(...data);
    totalPages = Number(res.headers.get("x-wp-totalpages") || 1);
    page += 1;
  }
  return all;
}

function locFromSitemap(xml) {
  const locs = [];
  for (const m of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) locs.push(m[1].trim());
  return locs;
}

async function main() {
  ensureDir(OUT);
  ensureDir(JSON_DIR);
  ensureDir(CONTENT_DIR);
  ensureDir(DISCOVERY);
  ensureDir(ASSETS);
  ensureDir(CACHE);

  const discovery = {
    fetched_at: new Date().toISOString(),
    user_agent: UA,
    robots: null,
    sitemaps: {},
    cms: {
      generator: null,
      theme: null,
      theme_version: null,
      wordpress: null,
      plugins: [],
      evidence: [],
    },
  };

  const robots = await politeFetch(`${ORIGIN}/robots.txt`);
  fs.writeFileSync(path.join(DISCOVERY, "robots.txt"), robots.body, "utf8");
  discovery.robots = { status: robots.status, body: robots.body, allowed_for_this_agent: !/User-agent:\s*\*/i.test(robots.body) || !/Disallow:\s*\//.test(robots.body.split(/User-agent:\s*MJ12bot/i)[0] || "") };
  discovery.robots.note =
    "robots.txt only disallows MJ12bot. This export uses User-Agent khaneyeide-export and does not request /wp-admin or /wp-login.";

  const sitemapCandidates = ["sitemap.xml", "wp-sitemap.xml", "sitemap_index.xml"];
  const childSitemaps = new Set();
  for (const name of sitemapCandidates) {
    const res = await politeFetch(`${ORIGIN}/${name}`);
    const file = path.join(DISCOVERY, name);
    fs.writeFileSync(file, res.body, "utf8");
    discovery.sitemaps[name] = { status: res.status, final_url: res.url, bytes: Buffer.byteLength(res.body) };
    if (res.status === 200 && res.body.includes("<loc>")) {
      for (const loc of locFromSitemap(res.body)) {
        if (/sitemap/i.test(loc)) childSitemaps.add(loc);
      }
    }
  }

  const pageUrls = new Map();
  for (const loc of childSitemaps) {
    if (!sameHost(loc)) continue;
    const res = await politeFetch(loc);
    const base = path.basename(new URL(loc).pathname);
    fs.writeFileSync(path.join(DISCOVERY, base), res.body, "utf8");
    discovery.sitemaps[base] = { status: res.status, final_url: res.url };
    if (res.status !== 200) continue;
    const isIndex = res.body.includes("<sitemapindex");
    for (const url of locFromSitemap(res.body)) {
      if (isIndex) continue;
      if (sameHost(url)) pageUrls.set(encodePath(url).replace(/\/$/, "") + (url.endsWith("/") ? "/" : ""), url);
    }
  }

  const indexRes = await politeFetch(`${ORIGIN}/wp-json/`);
  fs.writeFileSync(path.join(JSON_DIR, "index.json"), indexRes.body, "utf8");
  let indexJson = null;
  try {
    indexJson = JSON.parse(indexRes.body);
  } catch {
    indexJson = null;
  }
  if (indexJson) {
    discovery.cms.evidence.push("GET /wp-json/ returned a WordPress REST index");
    discovery.cms.namespaces = indexJson.namespaces || null;
    discovery.cms.site_name = indexJson.name || null;
    discovery.cms.description = indexJson.description || null;
    discovery.cms.timezone = indexJson.timezone_string || null;
    discovery.cms.page_on_front = indexJson.page_on_front ?? null;
  }

  const pagesApi = await fetchCollection("pages");
  const postsApi = await fetchCollection("posts");
  const categoriesApi = await fetchCollection("categories");
  const tagsApi = await fetchCollection("tags");
  const mediaApi = await fetchCollection("media");

  const wpByLink = new Map();
  for (const item of [...pagesApi, ...postsApi]) {
    if (item.link) wpByLink.set(encodePath(item.link), item);
    if (item.link) pageUrls.set(encodePath(item.link), item.link);
  }
  for (const item of [...categoriesApi]) {
    if (item.link) pageUrls.set(encodePath(item.link), item.link);
  }
  const authorLinks = [`${ORIGIN}/author/khaneyeide/`];
  for (const link of authorLinks) pageUrls.set(encodePath(link), link);

  const mediaByFile = new Map();
  for (const item of mediaApi) {
    const source = item.source_url;
    if (!source) continue;
    const record = {
      source_url: source,
      width: item.media_details?.width ?? null,
      height: item.media_details?.height ?? null,
      alt: item.alt_text || "",
      mime: item.mime_type || null,
    };
    const add = (fileUrl) => {
      if (!fileUrl) return;
      try {
        mediaByFile.set(canonUrl(fileUrl), record);
        mediaByFile.set(withoutSize(fileUrl), record);
      } catch {
        /* ignore bad urls */
      }
    };
    add(source);
    const sizes = item.media_details?.sizes || {};
    for (const size of Object.values(sizes)) {
      if (size.source_url) add(size.source_url);
      else if (size.file && source) {
        const dir = source.slice(0, source.lastIndexOf("/") + 1);
        add(dir + size.file);
      }
    }
  }

  const queue = [...pageUrls.values()];
  const seenPages = new Set();
  const pages = [];
  const allForms = [];
  let headerNav = null;
  let footerNav = null;
  const stylesheetUrls = new Set();
  const pluginSet = new Set();
  const imageBag = [];

  while (queue.length && pages.length < MAX_PAGES) {
    const next = queue.shift();
    const normalized = encodePath(next).replace(/\/+$/, "") || ORIGIN;
    if (seenPages.has(normalized)) continue;
    if (isBlocked(next)) continue;
    const pathName = new URL(next).pathname;
    if (/\/wp-json\/|\/wp-content\/|\/feed\/?$/.test(pathName)) continue;
    seenPages.add(normalized);

    let res;
    try {
      res = await politeFetch(next);
    } catch (error) {
      stats.errors.push({ url: next, error: String(error) });
      continue;
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html") && !String(res.body).includes("<html")) {
      continue;
    }
    const html = String(res.body);
    const $ = cheerio.load(html);
    $("script,style,noscript").each((_, el) => {
      /* parsed below from a second load so markdown removal does not drop head meta */
    });
    const meta$ = cheerio.load(html);
    const title = meta$("title").first().text().trim() || null;
    const generator = meta$('meta[name="generator"]').attr("content") || null;
    if (generator && !discovery.cms.generator) discovery.cms.generator = generator;
    const yoast = html.match(/Yoast SEO Premium plugin v([0-9.]+) \(Yoast SEO v([0-9.]+)\)/);
    if (yoast) {
      discovery.cms.yoast_seo_premium = yoast[1];
      discovery.cms.yoast_seo = yoast[2];
    }
    for (const m of html.matchAll(/wp-content\/themes\/([^/"'?]+)/g)) {
      discovery.cms.theme = m[1];
    }
    const themeVer = html.match(/hello-elementor\/style\.min\.css\?ver=([0-9.]+)/);
    if (themeVer) discovery.cms.theme_version = themeVer[1];
    const wpVer = (generator || "").match(/WordPress\s+([0-9.]+)/);
    if (wpVer) discovery.cms.wordpress = wpVer[1];
    for (const m of html.matchAll(/wp-content\/plugins\/([^/"'?]+)/g)) pluginSet.add(m[1]);
    for (const m of html.matchAll(/elementor\/assets\/css\/frontend\.min\.css\?ver=([0-9.]+)/g)) discovery.cms.elementor = m[1];
    for (const m of html.matchAll(/elementor-pro\/assets\/css\/[^"']+\?ver=([0-9.]+)/g)) discovery.cms.elementor_pro = m[1];
    if (/wp-rocket|data-rocket-preload/.test(html)) pluginSet.add("wp-rocket");

    meta$("link[rel='stylesheet']").each((_, el) => {
      const href = absUrl(meta$(el).attr("href"), res.url);
      if (href && sameHost(href)) stylesheetUrls.add(href.split("#")[0]);
    });

    const root = contentRoot($);
    const markdown = root ? htmlToMarkdown($, root) : "";
    const heads = root ? headingsOf($, root) : [];
    const images = collectImages(meta$, res.url);
    const links = collectLinks(meta$, res.url);
    const og = openGraph(meta$);
    const jsonLd = parseJsonLd(meta$);
    const canonical = meta$('link[rel="canonical"]').attr("href") || null;
    const description = meta$('meta[name="description"]').attr("content") || null;
    const wp = wpByLink.get(encodePath(res.url)) || wpByLink.get(encodePath(next));
    const pageType = classify(res.url, title, wp?.type || null);
    const h1 = heads.find((h) => h.level === "H1")?.text || null;

    const icons = [];
    meta$("link[rel*='icon']").each((_, el) => {
      icons.push({ rel: meta$(el).attr("rel"), href: absUrl(meta$(el).attr("href"), res.url) });
    });

    const page = {
      url: res.url,
      urlDecoded: decodePath(res.url),
      urlEncoded: encodePath(res.url),
      status: res.status,
      title,
      metaDescription: description,
      canonical: canonical ? absUrl(canonical, res.url) : null,
      openGraph: og,
      jsonLd,
      headings: heads,
      h1,
      markdown,
      internalLinks: links,
      images,
      icons,
      pageType,
      wpType: wp?.type || null,
      wpId: wp?.id || null,
      htmlBytes: Buffer.byteLength(html),
      minorContext: false,
      bits: visibleBits(meta$),
    };
    page.minorContext = pageType === "achievement" || pageType === "project" || looksLikeMinorContext(page);
    pages.push(page);

    const md = [
      `# ${title || h1 || fileSlug(res.url)}`,
      "",
      `- URL (decoded): ${page.urlDecoded}`,
      `- URL (percent-encoded): ${page.urlEncoded}`,
      `- HTTP status: ${page.status}`,
      `- Title: ${title || "null"}`,
      `- Meta description: ${description || "null"}`,
      `- Canonical: ${page.canonical || "null"}`,
      "",
      "## Open Graph",
      "",
      ...Object.entries(og).map(([k, v]) => `- ${k}: ${v ?? "null"}`),
      "",
      "## JSON-LD",
      "",
      "```json",
      JSON.stringify(jsonLd, null, 2),
      "```",
      "",
      "## Headings",
      "",
      ...(heads.length ? heads.map((h) => `- ${h.level}: ${h.text}`) : ["- null"]),
      "",
      "## Content",
      "",
      markdown || "_null_",
      "",
      "## Internal links",
      "",
      ...(links.length ? links.map((l) => `- [${l.text || l.href}](${l.href})`) : ["- null"]),
      "",
      "## Images",
      "",
      ...(images.length ? images.map((img) => `- ${img.src} | alt: ${img.alt || "null"}`) : ["- null"]),
      "",
    ].join("\n");
    fs.writeFileSync(path.join(CONTENT_DIR, fileSlug(res.url) + ".md"), md, "utf8");

    if (!headerNav) headerNav = navTree(meta$);
    if (!footerNav) {
      const f = footerLinks(meta$);
      if (f.length) footerNav = f;
    }
    allForms.push(...formsOf(meta$, page.urlDecoded));

    const heroPreload = html.match(/data-rocket-preload as="image" href="([^"]+)"/);
    for (const img of images) {
      let role = "content";
      if (/logo|logopit/i.test(img.src) || /لوگو/.test(img.alt)) role = "logo";
      if (heroPreload && img.src.split("?")[0] === heroPreload[1].split("?")[0]) role = "hero";
      if (pageType === "achievement") role = role === "content" ? "award" : role;
      if (pageType === "project") role = role === "content" ? "project" : role;
      imageBag.push({ ...img, page: page.urlDecoded, role });
    }
    for (const icon of icons) {
      if (icon.href) imageBag.push({ src: icon.href, alt: icon.rel || "icon", page: page.urlDecoded, role: "logo" });
    }
    if (og["og:image"]) imageBag.push({ src: og["og:image"], alt: "og:image", page: page.urlDecoded, role: /logo/i.test(og["og:image"]) ? "logo" : "content" });
    for (const m of html.matchAll(/https?:\/\/khaneyeide\.ir\/wp-content\/uploads\/[^"'\\\s>]+\.(?:png|jpe?g|webp|gif|svg|avif)/gi)) {
      imageBag.push({ src: m[0], alt: "", page: page.urlDecoded, role: pageType === "achievement" ? "award" : pageType === "project" ? "project" : "content" });
    }

    for (const link of links) {
      const key = encodePath(link.href).replace(/\/+$/, "");
      if (!seenPages.has(key) && pages.length + queue.length < MAX_PAGES) queue.push(link.href);
    }
  }

  discovery.cms.plugins = [...pluginSet].filter((p) => p !== "*").sort();

  const phones = new Set();
  const emails = new Set();
  const addresses = new Set();
  const branches = new Set();
  const mapLinks = new Set();
  const social = { instagram: new Set(), bale: new Set(), telegram: new Set(), whatsapp: new Set() };
  const teachers = [];
  const teacherSeen = new Set();
  const projects = [];
  const projectSeen = new Set();
  const achievements = [];

  for (const page of pages) {
    const blob = `${page.markdown}\n${page.bits || ""}`;
    for (const m of blob.matchAll(/tel:(\+?\d[\d]+)/g)) phones.add(m[1]);
    for (const m of blob.matchAll(/(?<!\d)(0\d{10})(?!\d)/g)) phones.add(m[1]);
    for (const m of page.internalLinks) {
      /* phones live in footer which was stripped from markdown; scan links separately below */
    }
    for (const href of [page.markdown, ...page.internalLinks.map((l) => l.href), JSON.stringify(page.openGraph)]) {
      for (const m of String(href).matchAll(/mailto:([^"'\\\s>]+)/gi)) emails.add(decodeURIComponent(m[1]));
      for (const m of String(href).matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) emails.add(m[0]);
    }
    for (const line of blob.split("\n")) {
      const t = line.replace(/^#+\s*/, "").trim();
      if (/آدرس\s*[:：]/.test(t)) addresses.add(t.replace(/\s+/g, " ").trim());
      if (/شعبه/.test(t) && t.length < 240) branches.add(t.replace(/\s+/g, " ").trim());
    }
    const rawLinks = `${blob}\n${page.internalLinks.map((l) => l.href).join("\n")}\n${JSON.stringify(page.openGraph)}`;
    for (const m of rawLinks.matchAll(/https?:\/\/[^\s)"']+/g)) {
      const href = m[0];
      if (/instagram\.com/i.test(href)) social.instagram.add(href.replace(/[),]+$/, ""));
      if (/ble\.ir|bale\.ai|web\.bale/i.test(href)) social.bale.add(href.replace(/[),]+$/, ""));
      if (/t\.me\/|telegram\.me|telegram\.org/i.test(href)) social.telegram.add(href.replace(/[),]+$/, ""));
      if (/wa\.me|whatsapp\.com|api\.whatsapp/i.test(href)) social.whatsapp.add(href.replace(/[),]+$/, ""));
      if (/google\.[^/]+\/maps|maps\.app\.goo|goo\.gl\/maps|nshn\.ir|balad\.ir|neshan\.org|waze\.com/i.test(href)) {
        mapLinks.add(href.replace(/[),]+$/, ""));
      }
    }
    if (page.pageType === "achievement") achievements.push(...parseAchievements(blob, page.urlDecoded));
    for (const m of blob.matchAll(/پروژه\s*[«"]([^»"]+)[»"]/g)) {
      const title = m[1].trim();
      if (projectSeen.has(title)) continue;
      projectSeen.add(title);
      const sentence = blob
        .split("\n")
        .map((s) => s.trim())
        .find((s) => s.includes(title));
      projects.push({
        title,
        team: null,
        description: sentence || null,
        media: null,
        page_url: page.urlDecoded,
      });
    }
    for (const m of blob.matchAll(/(اساتید راهنما|استاد راهنما|مربی‌ها|مربی ها|مدرسین|مدرس)\s*[:：]\s*([^\n]{2,120})/g)) {
      const role = m[1];
      const names = m[2].split(/\s*[/،,]\s*/).map((s) => s.replace(/مهندس|دکتر/g, "").trim()).filter(Boolean);
      for (const name of names) {
        if (name.length < 3 || name.length > 40) continue;
        if (/دانش|پایه|رتبه|عنوان/.test(name)) continue;
        const key = name.replace(/\s/g, "");
        if (teacherSeen.has(key)) continue;
        teacherSeen.add(key);
        teachers.push({ name, role, bio: null, page_url: page.urlDecoded });
      }
    }
  }

  // Contact details are often in the header/footer, which markdown strips. Scan saved HTML-derived link lists
  // again from each content file's internal links is not enough for tel:. Re-read is unnecessary:
  // collect from pages' open graph and also do a dedicated pass using the contact page markdown plus a
  // second extraction stored during crawl. The crawl already dropped header text. Patch by scanning
  // content markdown AND the raw strings we kept. Additionally parse contact-like lines from headings.
  for (const page of pages) {
    for (const link of page.internalLinks) {
      if (link.href.startsWith("tel:")) phones.add(link.href.slice(4));
      if (link.href.startsWith("mailto:")) emails.add(link.href.slice(7));
    }
  }

  const courses = pages.filter((p) => p.pageType === "course").map(courseFromPage);

  const contact = {
    phones: [...phones],
    emails: [...emails].filter((e) => !/example\.com|sentry/i.test(e)),
    addresses: [...addresses],
    branches: [...branches],
    map_links: [...mapLinks],
    social: {
      instagram: [...social.instagram],
      bale: [...social.bale],
      telegram: [...social.telegram],
      whatsapp: [...social.whatsapp],
    },
  };
  if (!contact.phones.length) contact.phones = [];
  for (const key of ["instagram", "bale", "telegram", "whatsapp"]) {
    if (!contact.social[key].length) contact.social[key] = [];
  }

  const structured = {
    source: ORIGIN + "/",
    exported_at: new Date().toISOString(),
    unknown_values_are_null: true,
    note: "Personal names of children are not stored. Teacher names are included only when the page labels them as استاد، مربی، or مدرس. Empty arrays mean the public pages were checked and nothing was found.",
    courses,
    achievements,
    student_projects: projects,
    teachers,
    contact,
    navigation: {
      header: headerNav,
      footer: footerNav,
    },
    forms: allForms,
  };
  writeJson(path.join(OUT, "structured.json"), structured);

  const pagesJson = pages.map((p) => ({
    url_decoded: p.urlDecoded,
    url_encoded: p.urlEncoded,
    status: p.status,
    title: p.title,
    page_type: p.pageType,
    wp_type: p.wpType,
    wp_id: p.wpId,
    canonical: p.canonical,
    meta_description: p.metaDescription,
    h1: p.h1,
    content_file: "docs/site-export/content/" + fileSlug(p.url) + ".md",
    html_bytes: p.htmlBytes,
    image_count: p.images.length,
    may_show_children: p.minorContext,
  }));
  writeJson(path.join(OUT, "pages.json"), pagesJson);

  const csv = ["\ufeffold_url,title,page_type,notes"];
  for (const p of pages) {
    const notes = [
      p.wpType ? `wp:${p.wpType}` : null,
      p.wpId ? `id:${p.wpId}` : null,
      p.status !== 200 ? `status:${p.status}` : null,
      p.minorContext ? "may show children; names omitted from structured.json" : null,
    ]
      .filter(Boolean)
      .join("; ");
    csv.push([csvCell(p.urlEncoded), csvCell(p.title), csvCell(p.pageType), csvCell(notes || null)].join(","));
  }
  fs.writeFileSync(path.join(OUT, "redirect-seed.csv"), csv.join("\n") + "\n", "utf8");

  // Brand CSS: fonts and elementor globals from stylesheets linked on crawled pages.
  const fontFaces = [];
  const cssVars = {};
  const fontFamilies = new Map();
  const fontFileUrls = new Set();
  const cssToFetch = [...stylesheetUrls].filter((href) => /fonts|google-fonts|post-8\.css|post-6\.css|frontend\.min\.css|theme\.min\.css/i.test(href));
  for (const href of cssToFetch) {
    try {
      const res = await politeFetch(href);
      if (res.status !== 200) continue;
      const css = String(res.body);
      fs.writeFileSync(path.join(DISCOVERY, "css-" + safeFileName(href)), css, "utf8");
      for (const m of css.matchAll(/(--e-global-color-[\w-]+)\s*:\s*([^;}{]+)/g)) {
        cssVars[m[1]] = m[2].trim();
      }
      for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/g)) {
        const family = m[1].trim();
        fontFamilies.set(family, (fontFamilies.get(family) || 0) + 1);
      }
      for (const block of css.matchAll(/@font-face\s*{([^}]+)}/g)) {
        const body = block[1];
        const family = (body.match(/font-family\s*:\s*([^;]+)/) || [])[1] || null;
        const weight = (body.match(/font-weight\s*:\s*([^;]+)/) || [])[1] || null;
        const srcs = [...body.matchAll(/url\((['"]?)(.*?)\1\)/g)].map((m) => absUrl(m[2], href)).filter(Boolean);
        fontFaces.push({ family: family && family.replace(/['"]/g, "").trim(), weight: weight && weight.trim(), files: srcs });
        for (const src of srcs) {
          if (/\.(woff2?|ttf|otf)(\?|$)/i.test(src)) fontFileUrls.add(src);
        }
      }
    } catch (error) {
      stats.errors.push({ url: href, error: String(error) });
    }
  }

  const favicon = pages.find((p) => p.icons?.length)?.icons || [];

  // Resolve image originals.
  const resolved = new Map();
  for (const img of imageBag) {
    let fromMedia = null;
    let original = img.src;
    try {
      const clean = canonUrl(img.src.split("?")[0]);
      fromMedia = mediaByFile.get(clean) || mediaByFile.get(withoutSize(clean));
      original = fromMedia?.source_url || withoutSize(clean);
    } catch {
      continue;
    }
    const key = canonUrl(original);
    const prev = resolved.get(key);
    const roleRank = imagePriority({ ...img, source_url: original });
    if (!prev || roleRank < prev.rank) {
      resolved.set(key, {
        source_url: original,
        alt: img.alt || fromMedia?.alt || prev?.alt || "",
        page: img.page,
        role: img.role,
        rank: roleRank,
        width: fromMedia?.width ?? null,
        height: fromMedia?.height ?? null,
      });
    } else if (prev && img.alt && !prev.alt) prev.alt = img.alt;
  }
  for (const src of fontFileUrls) {
    resolved.set(src.split("?")[0], {
      source_url: src,
      alt: "font",
      page: null,
      role: "font",
      rank: 0,
      width: null,
      height: null,
    });
  }

  const manifest = [];
  let downloadedBytes = 0;
  const usedNames = new Set();
  const items = [...resolved.values()].sort((a, b) => a.rank - b.rank);
  console.log("unique assets to consider " + items.length);
  let overCap = false;
  for (const item of items) {
    const priority = item.rank <= 4;
    if (overCap && !priority) {
      manifest.push({
        file: null,
        source_url: item.source_url,
        alt: item.alt || null,
        page: item.page,
        width: item.width,
        height: item.height,
        bytes: null,
        downloaded: false,
        reason: "skipped because total downloads reached 150 MB; listed only",
      });
      continue;
    }
    if (isBlocked(item.source_url) || !/^https?:/i.test(item.source_url)) continue;
    let res;
    try {
      res = await politeFetch(item.source_url, { binary: true });
    } catch (error) {
      manifest.push({
        file: null,
        source_url: item.source_url,
        alt: item.alt || null,
        page: item.page,
        width: item.width,
        height: item.height,
        bytes: null,
        downloaded: false,
        reason: String(error),
      });
      continue;
    }
    if (res.status !== 200 || !Buffer.isBuffer(res.body)) {
      manifest.push({
        file: null,
        source_url: item.source_url,
        alt: item.alt || null,
        page: item.page,
        width: null,
        height: null,
        bytes: null,
        downloaded: false,
        reason: "HTTP " + res.status,
      });
      continue;
    }
    const bytes = res.body.length;
    if (!priority && downloadedBytes + bytes > MAX_ASSET_BYTES) {
      overCap = true;
      manifest.push({
        file: null,
        source_url: item.source_url,
        alt: item.alt || null,
        page: item.page,
        width: item.width,
        height: item.height,
        bytes,
        downloaded: false,
        reason: "skipped because total downloads would exceed 150 MB",
      });
      continue;
    }
    let name = safeFileName(item.source_url);
    if (item.role === "font") name = path.join("fonts", name);
    if (usedNames.has(name)) {
      const hash = createHash("sha1").update(item.source_url).digest("hex").slice(0, 6);
      const ext = path.extname(name);
      name = name.slice(0, -ext.length) + "-" + hash + ext;
    }
    usedNames.add(name);
    const dest = path.join(ASSETS, name);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, res.body);
    downloadedBytes += bytes;
    const dim = imageSize(res.body);
    manifest.push({
      file: "assets/raw/site/" + name.replace(/\\/g, "/"),
      source_url: item.source_url,
      alt: item.alt || null,
      page: item.page,
      width: dim.width ?? item.width,
      height: dim.height ?? item.height,
      bytes,
      downloaded: true,
      role: item.role,
    });
    if (downloadedBytes > MAX_ASSET_BYTES) overCap = true;
  }

  writeJson(path.join(OUT, "assets-manifest.json"), {
    total_downloaded_bytes: downloadedBytes,
    cap_bytes: MAX_ASSET_BYTES,
    cap_reached: overCap,
    files: manifest,
  });

  const topFonts = [...fontFamilies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([family, count]) => ({ family, declarations: count }));

  const brand = {
    source: "stylesheets linked from public pages; computed styles are added by screenshots.mjs when that step runs",
    colors: {
      css_variables: Object.keys(cssVars).length ? cssVars : null,
      note: Object.keys(cssVars).length ? null : "Global color variables were not in the fetched stylesheets. Computed colors are filled after the screenshot pass.",
    },
    fonts: topFonts,
    font_faces: fontFaces,
    font_files: manifest.filter((f) => f.role === "font").map((f) => ({ file: f.file, source_url: f.source_url, bytes: f.bytes })),
    favicon,
  };
  writeJson(path.join(OUT, "brand.json"), brand);

  const largest = manifest
    .filter((f) => f.downloaded && f.bytes)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15);

  const tech = {
    theme: discovery.cms.theme,
    theme_version: discovery.cms.theme_version,
    wordpress: discovery.cms.wordpress,
    generator: discovery.cms.generator,
    yoast_seo: discovery.cms.yoast_seo || null,
    yoast_seo_premium: discovery.cms.yoast_seo_premium || null,
    elementor: discovery.cms.elementor || null,
    elementor_pro: discovery.cms.elementor_pro || null,
    plugins_seen_in_asset_paths: discovery.cms.plugins,
    pages_crawled: pages.length,
    html_bytes_by_page: pages.map((p) => ({ url: p.urlDecoded, html_bytes: p.htmlBytes })),
    largest_downloaded_images: largest,
    total_downloaded_asset_bytes: downloadedBytes,
    browser_page_weight: null,
    lighthouse_mobile: null,
    lighthouse_note: null,
  };
  writeJson(path.join(OUT, "tech.json"), tech);
  writeJson(path.join(DISCOVERY, "cms.json"), discovery.cms);
  writeJson(path.join(OUT, "crawl-stats.json"), {
    http_requests_this_run_uncached: stats.requests,
    pages: pages.length,
    errors: stats.errors,
    minor_pages: pages.filter((p) => p.minorContext).map((p) => ({ url: p.urlDecoded, title: p.title, page_type: p.pageType })),
  });

  console.log(
    JSON.stringify(
      {
        pages: pages.length,
        courses: courses.length,
        achievements: achievements.length,
        projects: projects.length,
        teachers: teachers.length,
        images_downloaded: manifest.filter((f) => f.downloaded).length,
        downloaded_bytes: downloadedBytes,
        requests: stats.requests,
        errors: stats.errors.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
