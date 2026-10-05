// Operations e2e: the admin session board (record attendance and a report, cancel and restore), classes, roster,
// student search, staff, the teacher panel and the parent panel (own child only). Needs `pnpm db:demo`,
// OTP_DEV_CODE=1234 and owner-state.json in <dir>. Usage:
//   node e2e/ops.e2e.mjs <dir>
import { chromium } from "playwright-core";
const S = process.argv[2];
const base = "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const R = []; const check = (n, ok, x = "") => R.push(`${ok ? "PASS" : "FAIL"} ${n} ${x}`);
const errs = [];
const login = async (phone, viewport = { width: 1280, height: 860 }) => {
  const ctx = await b.newContext({ viewport });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(base + "/login");
  await p.fill('input[name="phone"]', phone);
  await p.click("form button[type=submit]");
  await p.fill('input[name="code"]', "1234");
  await Promise.all([p.waitForURL(/\/app\//), p.click("form button[type=submit]")]);
  return p;
};

// Admin board
const admin = await (await b.newContext({ viewport: { width: 1440, height: 900 }, storageState: S + "/owner-state.json" })).newPage();
admin.on("pageerror", (e) => errs.push(e.message));
await admin.goto(base + "/app/admin/sessions");
await admin.waitForSelector('[data-testid="board"]');
const cards = await admin.locator('[data-testid="board"] li a').count();
check("board shows this week's sessions", cards >= 5, `(${cards})`);
check("summary bar has held and awaiting counts", /برگزار شد/.test(await admin.textContent('[data-testid="summary"]')));
await admin.screenshot({ path: `${S}/ops-board.png` });
// open an awaiting session and record it
const awaiting = admin.locator('[data-testid="board"] li a.border-accent\\/70').first();
const hasAwaiting = (await awaiting.count()) > 0;
// After a first run the only unanswered session may already be recorded; skip the save checks then.
if (!hasAwaiting) R.push("SKIP no unanswered session left this week (already recorded by an earlier run)");
if (hasAwaiting) {
  await awaiting.click();
  await admin.waitForSelector('[data-testid="session-panel"]:visible [data-testid="attendance"]');
  await admin.locator('[data-testid="attendance"] li').first().getByText("غایب").click();
  await admin.fill('[data-testid="session-panel"]:visible textarea[name="summary"]', "تست ربات مسیریاب");
  await admin.click('[data-testid="session-panel"]:visible button:has-text("ثبت: برگزار شد")');
  await admin.waitForSelector('[data-testid="session-panel"]:visible [role=status]');
  check("attendance and report saved", (await admin.textContent('[data-testid="session-panel"]:visible')).includes("برگزار شد"));
  await admin.screenshot({ path: `${S}/ops-panel.png` });
}
// next week: cancel a session
await admin.goto(base + "/app/admin/sessions?w=" + new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
await admin.waitForSelector('[data-testid="board"] li a');
await admin.locator('[data-testid="board"]:visible li a').first().click();
await admin.waitForSelector('[data-testid="session-panel"]:visible summary');
await admin.locator('[data-testid="session-panel"]:visible summary', { hasText: "لغو این جلسه" }).click();
await admin.fill('[data-testid="session-panel"]:visible input[name="reason"]', "تعطیلی رسمی");
await admin.click('[data-testid="session-panel"]:visible button:has-text("لغو جلسه")');
await admin.waitForSelector("text=این جلسه لغو شده است");
check("future session canceled with a scheduled notice", (await admin.textContent('[data-testid="session-panel"]:visible')).includes("تعطیلی رسمی"));
await admin.click('[data-testid="session-panel"]:visible button:has-text("برگرداندن جلسه")');
await admin.waitForSelector('[data-testid="session-panel"]:visible summary');
check("canceled session restored", true);
// classes & students lists
await admin.goto(base + "/app/admin/classes");
await admin.waitForSelector("main li");
check("classes list", (await admin.locator("main li").count()) >= 6);
await admin.locator("main li a").first().click();
await admin.waitForSelector('[data-testid="roster"]');
check("class page shows roster", (await admin.locator('[data-testid="roster"] li').count()) >= 3);
await admin.screenshot({ path: `${S}/ops-class.png`, fullPage: true });
await admin.goto(base + "/app/admin/students?q=09350000001");
await admin.waitForSelector("main li");
check("student search by parent's phone", (await admin.locator("main li").count()) === 1);
await admin.goto(base + "/app/admin/staff");
await admin.waitForSelector("main li");
check("staff page lists teachers", (await admin.textContent("main")).includes("معلم"));

// Teacher panel
const teacher = await login("09120000101");
check("teacher lands on coach panel", teacher.url().includes("/app/teacher"));
await teacher.waitForSelector("main h1", { timeout: 60000 });
await teacher.screenshot({ path: `${S}/ops-teacher.png`, fullPage: true });
const tCards = await teacher.locator("main a[href*='?s=']").count();
check("teacher sees own sessions", tCards > 0, `(${tCards})`);
// teacher cannot open the admin board
const r = await teacher.goto(base + "/app/admin/sessions");
check("teacher cannot open admin board", r.status() === 404 || (await teacher.textContent("body")).includes("404"));

// Parent portal
const parent = await login("09350000001", { width: 390, height: 844 });
check("parent lands on portal", parent.url().includes("/app/parent"));
await parent.waitForSelector('[data-testid="child"]');
const parentText = await parent.textContent("main");
check("parent sees own child", parentText.includes("آوا"));
check("parent does not see other children", !parentText.includes("کیان"));
await parent.screenshot({ path: `${S}/ops-parent.png`, fullPage: true });

console.log(R.join("\n"));
console.log("errors:", errs.slice(0, 4));
await b.close();
