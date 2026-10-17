// Site polish: the theme survives a language switch (both ways), the review carousel and the "write your review"
// dialog work, and the partner logos are shown in uniform tiles. Needs the dev server on :3000 and `pnpm --filter
// @khaneyeidea/db upsert-site-copy` (sample reviews and partners). It leaves one pending review named e2e-<tag>
// (delete it in the admin reviews page). Usage:
//   node e2e/site-polish.e2e.mjs
import { chromium } from "playwright-core";
const base = "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const R = [];
const check = (n, ok, x = "") => R.push(`${ok ? "PASS" : "FAIL"} ${n} ${x}`);
const tag = Date.now().toString(36).slice(-5);
process.on("uncaughtException", (e) => {
  console.log(R.join("\n"));
  console.log("CRASH", e.message.split("\n")[0]);
  process.exit(1);
});
const theme = (p) => p.evaluate(() => document.documentElement.dataset.theme);

// 1. theme and language
for (const mode of ["dark", "light"]) {
  const c = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: mode });
  await c.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(base + "/courses", { timeout: 120000 });
  await p.waitForSelector('a[hreflang="en"]');
  await p.waitForTimeout(1500);
  check(`${mode}: starts in ${mode}`, (await theme(p)) === mode);
  await p.locator('a[hreflang="en"]').first().click();
  await p.waitForURL(/\/en\/courses/);
  await p.waitForTimeout(300);
  check(`${mode}: stays ${mode} in English`, (await theme(p)) === mode);
  await p.locator('a[hreflang="fa"]').first().click();
  await p.waitForURL((u) => !u.pathname.startsWith("/en"));
  await p.waitForTimeout(300);
  check(`${mode}: and back in Persian`, (await theme(p)) === mode);
  await p.waitForTimeout(700);
  check(`${mode}: the page is fully visible again after the switch (no leftover dimming)`, (await p.evaluate(() => getComputedStyle(document.body).opacity)) === "1");
  // an explicit choice wins over the system
  await p.evaluate(() => localStorage.setItem("theme", "dark"));
  await p.locator('a[hreflang="en"]').first().click();
  await p.waitForURL(/\/en\/courses/);
  check(`${mode}: a saved dark choice survives the switch`, (await theme(p)) === "dark");
  check(`${mode}: no script errors`, errs.length === 0, errs.join("|"));
  await c.close();
}

// 2. reviews and partners on the home page
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
const p = await ctx.newPage();
await p.goto(base + "/", { timeout: 120000 });
await p.waitForSelector('[data-testid="review-carousel"]');
await p.waitForTimeout(1500);
const quote = () => p.locator('[data-testid="review-carousel"] figure[aria-hidden="false"] blockquote').first().textContent();
const first = await quote();
await p.getByRole("button", { name: "نظر بعدی" }).click();
await p.waitForTimeout(700);
check("next review shows another quote", (await quote()) !== first);
const tabs = await p.locator('[data-testid="review-carousel"] [role=tab]').count();
check("one tab per review", tabs >= 2, `(${tabs})`);

await p.locator('[data-testid="review-open"]').click();
await p.waitForSelector('[data-testid="review-dialog"][open]');
check("the dialog opens", true);
await p.fill("#rv-name", "ا");
await p.fill("#rv-body", "کوتاه");
await p.locator('[data-testid="review-dialog"] button[type=submit]').click();
await p.waitForTimeout(600);
check("a too short review is not sent", (await p.locator('[data-testid="review-dialog"] [role=status]').count()) === 0);
await p.fill("#rv-name", `e2e-${tag}`);
await p.fill("#rv-body", "کلاس‌ها و مربی‌ها عالی بودند و فرزندم هر هفته با شوق می‌رود. ممنون از همه‌ی تیم.");
await p.locator('[data-testid="review-dialog"] button[type=submit]').click();
await p.waitForSelector('[data-testid="review-dialog"] [role=status]');
check("the thank-you message appears", true);
await p.keyboard.press("Escape");
await p.waitForSelector('[data-testid="review-dialog"]:not([open])', { state: "attached" });
check("Escape closes the dialog", (await p.locator('[data-testid="review-dialog"][open]').count()) === 0);

const logos = await p.locator("#partners img").evaluateAll((els) => els.map((e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, ok: e.complete && e.naturalWidth > 0 })));
check("partner logos are shown", logos.length >= 6, `(${logos.length})`);
check("every logo fits its tile", logos.every((l) => l.w <= 170 && l.h <= 100 && l.w > 10));
// 3. the header never wraps and the page never scrolls sideways, in both languages
for (const [lang, path] of [["fa", "/"], ["en", "/en"]]) {
  const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await c.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  const q = await c.newPage();
  await q.goto(base + path, { timeout: 120000 });
  await q.waitForSelector("header");
  for (const w of [360, 390, 768, 1024, 1180, 1280, 1440, 1600]) {
    await q.setViewportSize({ width: w, height: 800 });
    await q.waitForTimeout(250);
    const r = await q.evaluate(() => {
      const bad = [];
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth + 1) bad.push("sideways scroll " + de.scrollWidth + ">" + de.clientWidth);
      for (const el of document.querySelectorAll("header a, header button")) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const cs = getComputedStyle(el);
        const text = (el.textContent || "").trim();
        if (text && r.height > parseFloat(cs.fontSize) * 2.4 && r.height > 46) bad.push("wrapped: " + text);
        if (r.right > innerWidth + 1 || r.left < -1) bad.push("off screen: " + (text || el.getAttribute("aria-label")));
      }
      return bad;
    });
    check(`${lang} @${w}: header and page fit`, r.length === 0, r.join(" | "));
  }
  await c.close();
}
// 4. on a wide screen the section headings use the width they have (one line), and a heading never ends in a lone word
{
  const c = await b.newContext({ viewport: { width: 1920, height: 1000 } });
  await c.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  const q = await c.newPage();
  await q.goto(base + "/", { timeout: 120000 });
  await q.waitForSelector("main h2");
  await q.waitForTimeout(1200);
  const heads = await q.evaluate(() =>
    [...document.querySelectorAll("main h2")].map((h) => ({ t: (h.textContent || "").trim().slice(0, 40), lines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight || "1") || 1) })),
  );
  check("home headings fit on one line at 1920 px", heads.every((h) => h.lines <= 1), heads.filter((h) => h.lines > 1).map((h) => h.t).join("|"));
  await c.close();
}
console.log(R.join("\n"));
console.log("review left pending: e2e-" + tag);
await b.close();
