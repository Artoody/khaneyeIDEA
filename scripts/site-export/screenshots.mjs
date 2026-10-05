/**
 * Full-page screenshots and computed brand colors.
 * One navigation at a time, with a pause between pages.
 * Does not log in and does not submit forms.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const OUT = path.join(REPO, "docs", "site-export");
const SHOTS = path.join(OUT, "screenshots");

const PAGES = [
  ["home", "https://khaneyeide.ir/"],
  ["courses", "https://khaneyeide.ir/%D8%AF%D9%88%D8%B1%D9%87%D9%87%D8%A7%DB%8C-%D8%AE%D8%A7%D9%86%D9%87%DB%8C-%D8%A7%DB%8C%D8%AF%D9%87/"],
  ["projects", "https://khaneyeide.ir/%D9%BE%D8%B1%D9%88%DA%98%D9%87%D9%87%D8%A7%DB%8C-%D8%AF%D8%A7%D9%86%D8%B4%D9%BE%DA%98%D9%88%D9%87%D8%A7%D9%86/"],
  ["contact", "https://khaneyeide.ir/%D8%AA%D9%85%D8%A7%D8%B3-%D8%A8%D8%A7-%D9%85%D8%A7/"],
];

const WIDTHS = [1440, 390];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function computedBrand(page) {
  return page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        color: s.color,
        backgroundColor: s.backgroundColor,
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
      };
    };
    const button = document.querySelector(".elementor-button, button[type='submit']");
    const link = document.querySelector("main a, .elementor-heading-title");
    const vars = {};
    const rootStyle = getComputedStyle(document.documentElement);
    for (const name of [
      "--e-global-color-primary",
      "--e-global-color-secondary",
      "--e-global-color-text",
      "--e-global-color-accent",
      "--e-global-typography-primary-font-family",
      "--e-global-typography-secondary-font-family",
      "--e-global-typography-text-font-family",
      "--e-global-typography-accent-font-family",
    ]) {
      const value = rootStyle.getPropertyValue(name).trim();
      vars[name] = value || null;
    }
    const fontFaces = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      for (const rule of rules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          fontFaces.push(rule.cssText.slice(0, 500));
        }
      }
    }
    return {
      body: pick(document.body),
      h1: pick(document.querySelector("h1")),
      h2: pick(document.querySelector("h2")),
      button: pick(button),
      link: pick(link),
      css_variables: vars,
      font_face_rules_sample: fontFaces.slice(0, 30),
    };
  });
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const weights = [];
  let brandComputed = null;
  for (const [name, url] of PAGES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        userAgent: "khaneyeide-export",
        locale: "fa-IR",
      });
      const page = await context.newPage();
      const requests = [];
      page.on("response", async (response) => {
        try {
          const headers = response.headers();
          const len = Number(headers["content-length"] || 0);
          requests.push({
            url: response.url(),
            status: response.status(),
            type: response.request().resourceType(),
            content_length: Number.isFinite(len) ? len : null,
          });
        } catch {
          /* ignore */
        }
      });
      await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
      await page.waitForTimeout(500);
      const file = path.join(SHOTS, `${name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      if (name === "home" && width === 1440) {
        brandComputed = await computedBrand(page);
        const transfer = await page.evaluate(() =>
          performance.getEntriesByType("resource").map((e) => ({
            name: e.name,
            type: e.initiatorType,
            transferSize: e.transferSize,
            encodedBodySize: e.encodedBodySize,
            decodedBodySize: e.decodedBodySize,
          }))
        );
        const doc = await page.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          return nav
            ? {
                transferSize: nav.transferSize,
                encodedBodySize: nav.encodedBodySize,
                decodedBodySize: nav.decodedBodySize,
                duration: nav.duration,
              }
            : null;
        });
        weights.push({ page: name, width, url, navigation: doc, resources: transfer, response_count: requests.length });
      } else if (width === 1440) {
        const summary = await page.evaluate(() => {
          const resources = performance.getEntriesByType("resource");
          const nav = performance.getEntriesByType("navigation")[0];
          const bytes = resources.reduce((sum, e) => sum + (e.transferSize || 0), 0) + (nav?.transferSize || 0);
          return { requests: resources.length + 1, transfer_bytes: bytes };
        });
        weights.push({ page: name, width, url, summary, response_count: requests.length });
      }
      await context.close();
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  await browser.close();

  const brandPath = path.join(OUT, "brand.json");
  const brand = fs.existsSync(brandPath) ? readJson(brandPath) : {};
  brand.computed = brandComputed;
  if (brandComputed?.css_variables) {
    brand.colors = brand.colors || {};
    brand.colors.computed_variables = brandComputed.css_variables;
    brand.colors.computed_elements = {
      body: brandComputed.body,
      h1: brandComputed.h1,
      h2: brandComputed.h2,
      button: brandComputed.button,
      link: brandComputed.link,
    };
  }
  fs.writeFileSync(brandPath, JSON.stringify(brand, null, 2), "utf8");

  const techPath = path.join(OUT, "tech.json");
  const tech = fs.existsSync(techPath) ? readJson(techPath) : {};
  const home = weights.find((w) => w.page === "home");
  if (home?.resources) {
    const resources = home.resources;
    const total = resources.reduce((sum, e) => sum + (e.transferSize || 0), 0) + (home.navigation?.transferSize || 0);
    const images = resources
      .filter((e) => e.type === "img" || /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(e.name))
      .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
      .slice(0, 10);
    tech.browser_page_weight = {
      home_1440: {
        url: home.url,
        document: home.navigation,
        resource_count: resources.length,
        response_count: home.response_count,
        transfer_bytes_including_document: total,
        largest_transferred_images: images,
      },
      other_pages_1440: weights.filter((w) => w.page !== "home").map((w) => ({ page: w.page, url: w.url, ...w.summary, response_count: w.response_count })),
    };
  }
  tech.lighthouse_mobile = null;
  tech.lighthouse_note =
    "Lighthouse was not run. A mobile Lighthouse pass fires hundreds of requests at once, which breaks the 1 request/second limit used for this export.";
  tech.screenshots = PAGES.flatMap(([name]) => WIDTHS.map((w) => `docs/site-export/screenshots/${name}-${w}.png`));
  fs.writeFileSync(techPath, JSON.stringify(tech, null, 2), "utf8");
  console.log(JSON.stringify({ screenshots: tech.screenshots, home_transfer: tech.browser_page_weight?.home_1440?.transfer_bytes_including_document }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
