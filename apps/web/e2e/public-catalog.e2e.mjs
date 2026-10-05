// Public catalog e2e: course filters (and their shareable URL), course pages, achievements filter,
// old-site redirects, and an admin edit reaching the course page. Needs owner-state.json in <dir>.
// Usage: node e2e/public-catalog.e2e.mjs <dir>
import { chromium } from "playwright-core";
const [, , OUT] = process.argv;
const base = "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const results = [];
const check = (n, ok, x = "") => results.push(`${ok ? "PASS" : "FAIL"} ${n} ${x}`);
const cards = () => p.locator("main ul > li:visible").count();

// Catalog filters
await p.goto(base + "/courses");
await p.waitForSelector("main ul > li");
const all = await cards();
check("catalog lists published courses", all > 0, `(${all})`);
await p.getByRole("button", { name: "رباتیک", exact: true }).click();
await p.waitForURL(/\?d=/);
await p.waitForTimeout(600);
const robo = await cards();
check("department filter narrows the list", robo > 0 && robo < all, `(${robo}/${all})`);
const shared = p.url();
await p.goto(shared);
await p.waitForSelector("main ul > li");
await p.waitForTimeout(400);
check("filter survives reload from the shared URL", (await cards()) === robo);
await p.getByRole("button", { name: "آنلاین" }).click();
await p.waitForTimeout(600);
check("mode filter combines with department", (await cards()) <= robo);
await p.goto(base + "/courses?mode=online&d=game-dev-unknown");
await p.waitForSelector("main ul > li");
check("unknown department in URL is ignored", (await cards()) > 0);

// Course page
let r = await p.goto(base + "/courses/robotics");
check("course page 200", r.status() === 200);
check("course page has booking link with course", (await p.locator('a[href="/book?course=robotics"]').count()) > 0);
check("course page JSON-LD", (await p.locator('script[type="application/ld+json"]').count()) === 1);
r = await p.goto(base + "/courses/does-not-exist");
check("unknown course is a real 404", r.status() === 404);
r = await p.goto(base + "/en/courses/robotics");
check("english course page 200", r.status() === 200 && (await p.textContent("h1")).length > 0);

// Old-site URL redirects to the new course page
r = await fetch(base + "/" + encodeURIComponent("دوره-آردوئینو"), { redirect: "manual" });
check("legacy URL redirects permanently", r.status === 308 && r.headers.get("location")?.endsWith("/courses/arduino"));
r = await fetch(base + "/some-unknown-old-page", { redirect: "manual" });
check("unknown old URL is 404", r.status === 404);

// Achievements
await p.goto(base + "/achievements");
await p.waitForSelector("main section li");
const allA = await p.locator("main section li").count();
await p.getByRole("button", { name: "جهانی" }).click();
await p.waitForTimeout(800);
const world = await p.locator("main section li").count();
check("achievements scope filter", world > 0 && world < allA, `(${world}/${allA})`);
check("no link remnants in titles", !(await p.textContent("main")).includes("wp-content"));

// Admin edit reaches the course page instantly
const actx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: OUT + "/owner-state.json" });
const ap = await actx.newPage();
await ap.goto(base + "/app/admin/courses");
await ap.locator("main li:visible a", { hasText: "رباتیک" }).first().click();
await ap.waitForSelector('textarea[name="summary.fa"]:visible');
const tag = "خلاصه‌ی آزمایشی " + Date.now().toString(36).slice(-4);
await ap.fill('textarea[name="summary.fa"]:visible', tag);
await ap.fill('input[name="ageMin"]:visible', "8");
await ap.fill('input[name="ageMax"]:visible', "12");
await ap.click("form:visible button[type=submit]");
await ap.waitForSelector("[role=status]:visible");
let html = await (await fetch(base + "/courses/robotics")).text();
check("admin summary edit shows on course page", html.includes(tag));
check("age range shows on course page", html.includes("۸-۱۲"));
html = await (await fetch(base + "/courses")).text();
check("catalog card updated too", html.includes(tag));
// restore
await ap.fill('textarea[name="summary.fa"]:visible', "");
await ap.fill('input[name="ageMin"]:visible', "");
await ap.fill('input[name="ageMax"]:visible', "");
await ap.click("form:visible button[type=submit]");
await ap.waitForTimeout(800);
check("restored", !(await (await fetch(base + "/courses/robotics")).text()).includes(tag));

console.log(results.join("\n"));
await b.close();
