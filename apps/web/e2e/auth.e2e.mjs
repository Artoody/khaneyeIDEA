// End-to-end auth check. Needs the dev server on :3000 with OTP_PROVIDER=console, an owner granted to 09120001111,
// and the dev server log path: node e2e/auth.e2e.mjs <dev.log> <screenshot-dir>
import { chromium } from "playwright-core";
import fs from "node:fs";
const LOG = process.argv[2], OUT = process.argv[3];
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const base = "http://localhost:3000";
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name} ${extra}`); };
async function codeFor(phone) {
  for (let i = 0; i < 40; i++) {
    const m = [...fs.readFileSync(LOG, "utf8").matchAll(new RegExp(`\\[otp\\] ${phone}: (\\d{5})`, "g"))];
    if (m.length) return m[m.length - 1][1];
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("no otp in log");
}
async function login(page, local, e164) {
  await page.goto(base + "/login");
  await page.fill("#phone", local);
  await page.click("button[type=submit]");
  await page.waitForSelector("#code", { timeout: 15000 });
  await page.fill("#code", await codeFor(e164));
  await Promise.all([page.waitForURL(/\/app\//, { timeout: 15000 }), page.click("form button[type=submit]")]);
}
// anonymous -> redirected to login
let ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); let p = await ctx.newPage();
await p.goto(base + "/app/admin"); check("anonymous redirected to login", p.url().endsWith("/login"), p.url());
// invalid phone shows error
await p.goto(base + "/login"); await p.fill("#phone", "12345"); await p.click("button[type=submit]");
await p.waitForSelector("#phone-help.text-red-500", { timeout: 15000 });
check("invalid phone error shown", (await p.textContent("#phone-help")).includes("معتبر نیست"));
await p.screenshot({ path: `${OUT}/login-error.png` });
// owner
await login(p, "0912 000 1111", "989120001111");
check("owner lands on admin panel", p.url().endsWith("/app/admin"), p.url());
await p.screenshot({ path: `${OUT}/panel-admin.png` });
// logout
await Promise.all([p.waitForURL(base + "/"), p.click("text=خروج")]);
await p.goto(base + "/app/admin"); check("after logout redirected to login", p.url().endsWith("/login"), p.url());
await ctx.close();
// new parent
ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); p = await ctx.newPage();
await login(p, "۰۹۱۲۰۰۰۲۲۲۲", "989120002222");
check("new parent lands on parent portal", p.url().endsWith("/app/parent"), p.url());
await p.screenshot({ path: `${OUT}/panel-parent-mobile.png` });
await p.goto(base + "/app/admin"); await p.waitForLoadState("networkidle");
const body = await p.textContent("body");
check("parent never sees the admin panel", !body.includes("پنل مدیریت"), "");
check("parent sees not-found + noindex", (await p.locator('meta[name="robots"][content*="noindex"]').count()) > 0 && body.includes("پیدا نشد"), "");
await p.screenshot({ path: `${OUT}/parent-on-admin.png` });
await ctx.close(); await b.close();
console.log(results.join("\n"));
