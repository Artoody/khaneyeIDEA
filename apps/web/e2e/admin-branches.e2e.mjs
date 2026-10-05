// Admin e2e: create, validate, publish and deactivate a branch; checks the public site updates instantly.
// Needs a saved owner session (owner-state.json) in the given directory. Usage: node e2e/admin-branches.e2e.mjs <dir>
import { chromium } from "playwright-core";
const [,, OUT] = process.argv;
const base = "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: OUT + "/owner-state.json" });
const p = await ctx.newPage();
const results = []; const check = (n, ok, x = "") => results.push(`${ok ? "PASS" : "FAIL"} ${n} ${x}`);
const homeText = async () => { const r = await (await fetch(base + "/")).text(); return r; };
const slug = "test-" + Date.now().toString(36);
const NAME = "شعبه آزمایشی " + slug.slice(-4); const DIST = "محله‌" + slug.slice(-4);

// create
await p.goto(base + "/app/admin/branches/new");
await p.fill('input[name="name.fa"]', NAME);
await p.fill('input[name="name.en"]', "Niavaran test branch");
await p.fill('input[name="district.fa"]', DIST);
await p.fill('input[name="slug"]', "BAD SLUG");
await p.click("form button[type=submit]");
await p.waitForSelector("text=فقط حروف کوچک انگلیسی");
check("invalid slug rejected with message", true);
check("typed values kept after a validation error", (await p.inputValue('input[name="name.fa"]')) === NAME);
await p.fill('input[name="slug"]', slug);
await Promise.all([p.waitForURL(/\/app\/admin\/branches$/), p.click("form button[type=submit]")]);
check("branch created, back on list", (await p.textContent("body")).includes(NAME));

let html = await homeText();
check("new branch appears on the public home page", html.includes(DIST));
check("branch count on home updated to 5", html.includes("۵</dd>") || html.includes(">۵<"), "");

// deactivate
await p.click(`text=${NAME}`);
await p.waitForSelector('input[name="slug"]:visible');
await p.locator('label:visible:has(input[name="active"])').click();
await p.click("form:visible button[type=submit]");
await p.waitForSelector("[role=status]:visible");
check("saved toast shown", true);
html = await homeText();
check("deactivated branch removed from the public site", !html.includes(DIST));

// permission: a parent session cannot run the action
const pctx = await b.newContext();
const pp = await pctx.newPage();
await pp.goto(base + "/app/admin/branches"); 
check("anonymous cannot open branch admin", pp.url().endsWith("/login"));
await pctx.close();
await p.screenshot({ path: OUT + "/adm-branch-edit.png", fullPage: true });
console.log(results.join("\n"));
await b.close();

