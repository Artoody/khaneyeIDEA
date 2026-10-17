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
  check(`${mode}: the page is visible after the fade`, (await p.evaluate(() => getComputedStyle(document.body).opacity)) !== "0");
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
console.log(R.join("\n"));
console.log("review left pending: e2e-" + tag);
await b.close();
