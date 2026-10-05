// Operations e2e, round 2: access page for accounts without a role, the admin dashboard, class cards, class page
// (bot connection codes, roster picker), moving a session with a clash warning, makeup sessions, and the whole
// teacher cancellation request flow (teacher asks, admin approves or declines). Leaves the data as it found it.
// Needs `pnpm db:demo`, OTP_DEV_CODE=1234, the dev server on :3000 and owner-state.json in <dir>. Usage:
//   node e2e/ops2.e2e.mjs <dir>
import { chromium } from "playwright-core";
const S = process.argv[2];
const base = "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const R = [];
const check = (n, ok, x = "") => R.push(`${ok ? "PASS" : "FAIL"} ${n} ${x}`);
const errs = [];
const open = async (ctx) => {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  return p;
};
const login = async (phone) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await open(ctx);
  await p.goto(base + "/login");
  await p.fill('input[name="phone"]', phone);
  await p.click("form button[type=submit]");
  await p.fill('input[name="code"]', "1234");
  await Promise.all([p.waitForURL(/\/app\//), p.click("form button[type=submit]")]);
  return p;
};
const V = (sel) => `${sel}:visible`;
// 24-hour time pickers (hour + minute selects) post HH:MM through a hidden input
const setTime = async (scope, name, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const sels = scope.locator(`[data-time="${name}"] select`);
  await sels.nth(0).selectOption(String(h));
  await sels.nth(1).selectOption(String(m));
};

process.on('uncaughtException', (e) => { console.log(R.join('\n')); console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });

// 1. A signed-in account with no role gets a friendly page, not a 404
{
  const p = await login("09199999998");
  await p.goto(base + "/app/admin");
  await p.waitForSelector("h1");
  const h1 = await p.textContent("h1");
  check("no-role account sees the access page", /فعال نیست/.test(h1), h1);
  check("it offers a way out", (await p.locator("button", { hasText: "خروج" }).count()) > 0);
  await p.context().close();
}

const admin = await open(await b.newContext({ viewport: { width: 1440, height: 1000 }, storageState: S + "/owner-state.json" }));

// 2. Dashboard
await admin.goto(base + "/app/admin");
await admin.waitForSelector("h1");
check("dashboard greets and shows today's section", (await admin.textContent("main")).includes("کلاس‌های امروز"));
check("dashboard shows the unanswered list", (await admin.textContent("main")).includes("منتظر گزارش معلم"));
await admin.click('[data-testid="connect-card"] button:has-text("ساخت کد اتصال")');
await admin.waitForSelector('[data-testid="connect-code"]');
check("connection code for the bot", /^\/start \d{6}$/.test((await admin.textContent('[data-testid="connect-code"]')).trim()));

// 3. Class cards by weekday
await admin.goto(base + "/app/admin/classes");
await admin.waitForSelector('[data-testid="class-days"]');
const total = await admin.locator('[data-testid="class-days"] a').count();
check("classes grouped by weekday", total >= 6, `(${total})`);
const sel = admin.locator('select[name="t"]');
const opts = await sel.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
await sel.selectOption(opts[0]);
await admin.waitForURL(/t=/);
await admin.waitForSelector('[data-testid="class-days"]');
const filtered = await admin.locator('[data-testid="class-days"] a').count();
check("teacher filter narrows the list", filtered > 0 && filtered < total, `(${filtered}/${total})`);

// 4. A class page: bot code, roster picker
await admin.goto(base + "/app/admin/classes");
await admin.waitForSelector('[data-testid="class-days"] a');
const classHref = await admin.locator('[data-testid="class-days"] a').first().getAttribute("href");
await admin.goto(base + classHref);
await admin.waitForSelector('[data-testid="groups"]');
await admin.click('[data-testid="groups"] button:has-text("ساخت کد اتصال")');
await admin.waitForSelector('[data-testid="class-code"]');
check("class group code", /^\/link \d{6}$/.test((await admin.textContent('[data-testid="class-code"]')).trim()));
const before = await admin.locator('[data-testid="roster"] li').count();
const row = admin.locator('[data-testid="picker"] li label').first();
const pickedName = (await row.textContent()).replace(/\d+\s*ساله|[۰-۹]+\s*ساله/g, "").trim();
await row.locator("input").check();
await Promise.all([admin.waitForResponse((r) => r.request().method() === "POST"), admin.click('[data-testid="picker"] button:has-text("افزودن دانش‌آموز")')]);
await admin.waitForTimeout(800);
const after = await admin.locator('[data-testid="roster"] li').count();
check("student added from the picker", after === before + 1, `(${before} -> ${after})`);
// take them out again
const added = admin.locator('[data-testid="roster"] li', { hasText: pickedName.split(" ")[0] }).last();
await added.locator("button", { hasText: "خارج کردن" }).click();
await admin.waitForTimeout(800);
check("and removed again", (await admin.locator('[data-testid="roster"] li').count()) === before);

// 5. Move one session: clash warning, then a real move and back
// a regular weekly session (not one moved or added by an earlier run)
const first = admin.locator('[data-testid="class-sessions"] a').filter({ hasNotText: /جابه‌جاشده|جبرانی/ }).first();
const sessHref = await first.getAttribute("href");
const origDay = /w=(\d{4}-\d{2}-\d{2})/.exec(sessHref)[1];
await admin.goto(base + sessHref);
await admin.waitForSelector(V('[data-testid="session-panel"]'));
const panel = admin.locator(V('[data-testid="session-panel"]'));
await panel.locator('[data-testid="move"] summary').click();
const from0 = await panel.locator('[data-testid="move"] input[name="from"]').inputValue();
const to0 = await panel.locator('[data-testid="move"] input[name="to"]').inputValue();
// the same teacher teaches another class on Wednesdays at the same hour
await panel.locator('[data-testid="move"] button[role="radio"]', { hasText: "چهارشنبه" }).first().click();
await panel.locator('[data-testid="move"] button:has-text("جابه‌جا کن")').click();
await panel.locator('[data-testid="move"] [role="alert"]').waitFor();
check("moving into a clash is flagged", /تداخل/.test(await panel.locator('[data-testid="move"] [role="alert"]').textContent()));
// a free slot on a Friday
const fridays = await panel.locator('[data-testid="move"] button[role="radio"]', { hasText: "جمعه" }).evaluateAll((bs) => bs.map((x) => x.dataset.iso));
await panel.locator(`[data-testid="move"] button[data-iso="${fridays.find((d) => d > origDay)}"]`).click(); // the Friday of the same week
await setTime(panel.locator('[data-testid=\"move\"]'), 'from', "10:00");
await setTime(panel.locator('[data-testid=\"move\"]'), 'to', "11:30");
await panel.locator('[data-testid="move"] button:has-text("جابه‌جا کن")').click();
await panel.locator('[data-testid="move"] [role="status"]').waitFor();
check("session moved", true);
await admin.goto(base + sessHref.replace(/s=[^&]+&?/, "").replace(/w=[^&]+/, `w=${origDay}`));
await admin.waitForSelector('[data-testid="board"]');
const boardText = await admin.textContent('[data-testid="board"]');
check("the board marks the moved session", boardText.includes("جابه‌جاشده"));
// move it back to its weekly slot
const moved = admin.locator('[data-testid="board"] a', { hasText: "جابه‌جاشده" }).first();
await moved.click();
await admin.waitForSelector(V('[data-testid="session-panel"]'));
const p2 = admin.locator(V('[data-testid="session-panel"]'));
await p2.locator('[data-testid="move"] summary').click();
await p2.locator(`[data-testid="move"] button[data-iso="${origDay}"]`).click();
await setTime(p2.locator('[data-testid=\"move\"]'), 'from', from0);
await setTime(p2.locator('[data-testid=\"move\"]'), 'to', to0);
await p2.locator('[data-testid="move"] button:has-text("جابه‌جا کن")').click();
await p2.locator('[data-testid="move"] [role="status"]').waitFor();
check("and moved back", true);

// 6. Makeup session and its removal
await admin.goto(base + classHref);
await admin.waitForSelector('[data-testid="makeup"]');
const mk = admin.locator('[data-testid="makeup"]');
await mk.locator("summary").click();
await mk.locator('button[role="radio"]').nth(20).click();
await setTime(mk, "from", "21:00");
await setTime(mk, "to", "22:00");
await mk.locator('button:has-text("افزودن جلسه")').click();
await mk.locator('[role="status"]').waitFor();
await admin.goto(base + classHref);
await admin.waitForSelector('[data-testid="class-sessions"]');
const extra = admin.locator('[data-testid="class-sessions"] a', { hasText: "جبرانی" });
check("makeup session listed", (await extra.count()) === 1);
await extra.first().click();
await admin.waitForSelector(V('[data-testid="session-panel"]'));
await admin.locator(V('[data-testid="session-panel"]')).locator("button", { hasText: "حذف این جلسه‌ی اضافه" }).click();
await admin.waitForTimeout(1000);
await admin.goto(base + classHref);
await admin.waitForSelector('[data-testid="class-sessions"]');
check("and deleted", (await admin.locator('[data-testid="class-sessions"] a', { hasText: "جبرانی" }).count()) === 0);

// 7. Teacher: week view, connect card, two cancellation requests
const t = await login("09120000101");
await t.goto(base + "/app/teacher");
await t.waitForSelector('[data-testid="week"]');
check("teacher connect card", (await t.locator('[data-testid="connect-card"]').count()) > 0);
await t.locator('a[aria-label="هفته‌ی بعد"]').first().click();
await t.waitForURL(/w=/);
await t.waitForSelector('[data-testid="week"] details');
const cards = t.locator('[data-testid="week"] details');
check("next week has this teacher's classes", (await cards.count()) >= 2, `(${await cards.count()})`);
const askFor = async (i, reason) => {
  const card = t.locator('[data-testid="week"] details').nth(i);
  await card.locator("summary").click();
  check(`card ${i + 1} opens with the class students`, (await card.textContent()).includes("دانش‌آموزان"));
  await card.locator("a", { hasText: "درخواست لغو" }).click();
  await t.waitForSelector(V('[data-testid="session-panel"]'));
  const sp = t.locator(V('[data-testid="session-panel"]'));
  await sp.locator("summary", { hasText: "لغو این جلسه" }).click();
  await sp.locator('input[name="reason"]').fill(reason);
  await sp.locator("button", { hasText: "لغو جلسه" }).click();
  await sp.locator('[role="status"]').waitFor();
  await t.goto(t.url().replace(/[?&]s=[^&]+/, "").replace(/\?$/, ""));
  await t.waitForSelector('[data-testid="week"] details');
};
const reasonA = `سرماخوردگی ${Date.now() % 1000}`;
await askFor(0, reasonA);
await askFor(1, "جلسه‌ی دانشگاه");
await t.context().close();

// 8. Admin decides the requests
await admin.goto(base + "/app/admin");
await admin.waitForSelector('[data-testid="requests"]');
const reqs = admin.locator('[data-testid="requests"] > li');
check("both requests wait on the dashboard", (await reqs.count()) === 2, `(${await reqs.count()})`);
const ours = admin.locator('[data-testid="requests"] > li', { hasText: reasonA });
check("the notice text is prefilled for approval", (await ours.locator("textarea").inputValue()).includes(reasonA));
await ours.locator('button[value="approve"]').click();
await admin.waitForTimeout(1500);
await admin.goto(base + "/app/admin");
await admin.waitForSelector('[data-testid="requests"]');
check("approved request leaves the inbox", (await admin.locator('[data-testid="requests"] > li').count()) === 1);
await admin.locator('[data-testid="requests"] > li button[value="reject"]').click();
await admin.waitForTimeout(1500);
await admin.goto(base + "/app/admin");
await admin.waitForSelector("h1");
check("declined request leaves the inbox", (await admin.locator('[data-testid="requests"]').count()) === 0);
// the approved one is canceled on the board; restore it
await admin.goto(base + "/app/admin/sessions?w=" + (await (async () => {
  const d = new Date(Date.now() + 7 * 86400000);
  return d.toISOString().slice(0, 10);
})()));
await admin.waitForSelector('[data-testid="board"]');
const canceled = admin.locator('[data-testid="board"] a', { hasText: "" }).filter({ has: admin.locator(".title") });
const cancelCards = admin.locator('[data-testid="board"] a.opacity-70');
check("approved cancellation shows on the board", (await cancelCards.count()) === 1, `(${await cancelCards.count()})`);
void canceled;
await cancelCards.first().click();
await admin.waitForSelector(V('[data-testid="session-panel"]'));
const cp = admin.locator(V('[data-testid="session-panel"]'));
check("with its queued notice", (await cp.textContent()).includes(reasonA));
await cp.locator("button", { hasText: "برگرداندن جلسه" }).click();
await admin.waitForTimeout(1200);
await admin.goto(base + "/app/admin/sessions?w=" + new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
await admin.waitForSelector('[data-testid="board"]');
check("restored", (await admin.locator('[data-testid="board"] a.opacity-70').count()) === 0);
await admin.screenshot({ path: `${S}/ops2-board.png` });

console.log(R.join("\n"));
console.log("errors:", errs);
await b.close();
