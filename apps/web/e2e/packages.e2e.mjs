// Smoke: student session packages (۶/۷) on class roster + student page.
// Needs `pnpm db:demo`, OTP_DEV_CODE=1234, an owner phone (default 09120001111), dev server :3000.
//   node e2e/packages.e2e.mjs <dir> [ownerPhone]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(fileURLToPath(new URL("../../../scripts/site-export/node_modules/playwright-core", import.meta.url))));

const S = process.argv[2];
const ownerPhone = process.argv[3] || "09120001111";
if (!S) {
  console.error("usage: node e2e/packages.e2e.mjs <dir> [ownerPhone]");
  process.exit(2);
}
mkdirSync(S, { recursive: true });
const base = "http://localhost:3000";
const chrome =
  process.env.CHROME_PATH ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const b = await chromium.launch({ executablePath: chrome });
const R = [];
const check = (n, ok, x = "") => R.push(`${ok ? "PASS" : "FAIL"} ${n}${x ? ` ${x}` : ""}`);
const errs = [];

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await ctx.newPage();
admin.on("pageerror", (e) => errs.push(e.message));

await admin.goto(base + "/login");
await admin.fill('input[name="phone"]', ownerPhone);
await admin.click("form button[type=submit]");
await admin.fill('input[name="code"]', "1234");
await Promise.all([admin.waitForURL(/\/app\//, { timeout: 20000 }), admin.click("form button[type=submit]")]);
check("owner logged in", /\/app\//.test(admin.url()), admin.url());
await ctx.storageState({ path: `${S}/owner-state.json` });

await admin.goto(base + "/app/admin/classes");
await admin.waitForSelector('[data-testid="class-days"] a[href*="/classes/"]:not([href*="/classes/new"])', { timeout: 30000 });
await admin.locator('[data-testid="class-days"] a[href*="/classes/"]:not([href*="/classes/new"])').first().click();
await admin.waitForSelector('[data-testid="roster"]');

const progress = admin.locator('[data-testid="package-progress"]');
const nProgress = await progress.count();
check("roster shows package progress chips", nProgress >= 1, `(${nProgress})`);
const firstChip = await progress.first().locator("span").first().textContent();
check("progress looks like u از p", /از|of/.test(firstChip || ""), `(${firstChip?.trim()})`);

await progress.first().locator('[data-testid="package-edit"]').click();
await admin.waitForSelector('[data-testid="package-form"]');
check("edit opens package form", true);
await admin.locator('[data-testid="package-form"] select[name="plannedSessions"]').selectOption("6");
await admin.locator('[data-testid="package-form"] button[type="submit"]').click();
await admin.waitForSelector('[data-testid="package-form"]', { state: "detached", timeout: 15000 }).catch(() => {});
await admin.reload();
await admin.waitForSelector('[data-testid="package-progress"]');
const after = await admin.locator('[data-testid="package-progress"]').first().locator("span").first().textContent();
check("saved 6-session package", /۶|6/.test(after || ""), `(${after?.trim()})`);
await admin.screenshot({ path: `${S}/packages-roster.png`, fullPage: true });

const studentLink = admin.locator('[data-testid="roster"] a[href*="/students/"]').first();
const studentHref = await studentLink.getAttribute("href");
check("roster links to student", !!studentHref, studentHref || "");
if (studentHref) {
  await studentLink.click();
  await admin.waitForURL(/\/students\//);
  await admin.waitForSelector('[data-testid="package-progress"]');
  check("student page shows package progress", (await admin.locator('[data-testid="package-progress"]').count()) >= 1);
  await admin.screenshot({ path: `${S}/packages-student.png`, fullPage: true });
}

await admin.goto(base + "/app/admin/classes");
await admin.locator('[data-testid="class-days"] a[href*="/classes/"]:not([href*="/classes/new"])').first().click();
await admin.waitForSelector('[data-testid="picker"]');
check("enroll picker has plannedSessions", (await admin.locator('[data-testid="picker"] select[name="plannedSessions"]').count()) === 1);
check("enroll picker has termStartedOn", (await admin.locator('[data-testid="picker"] input[name="termStartedOn"]').count()) === 1);

check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await b.close();
console.log(R.join("\n"));
if (R.some((l) => l.startsWith("FAIL"))) process.exit(1);
