// Booking e2e: admin defines a template and a closed day; a visitor books through the site with the phone code;
// the admin board shows it with its source; a signed-in parent books without a code; templates clean up.
// Needs owner-state.json in <dir> and the dev server log (OTP codes are printed there in dev). Usage:
//   node e2e/booking.e2e.mjs <dir> <dev.log>
import { chromium } from "playwright-core";
import fs from "node:fs";
const [, , OUT, LOG] = process.argv;
const base = "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const results = [];
const check = (n, ok, x = "") => results.push(`${ok ? "PASS" : "FAIL"} ${n} ${x}`);
const tag = Date.now().toString(36).slice(-5);
const lastCode = async (phone) => {
  for (let i = 0; i < 20; i++) {
    const m = [...fs.readFileSync(LOG, "utf8").matchAll(new RegExp(`\\[otp\\] ${phone}: (\\d{5})`, "g"))].pop();
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
};

// --- admin: template
const admin = await (await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: OUT + "/owner-state.json" })).newPage();
await admin.goto(base + "/app/admin/booking/templates/new");
await admin.fill('input[name="name"]:visible', `آزمایشی ${tag}`);
await admin.click("form:visible button[type=submit]");
await admin.waitForSelector("text=حداقل یک روز");
check("template without weekdays rejected", true);
for (let d = 0; d < 7; d++) await admin.locator(`label:visible:has(input[name="weekdays"][value="${d}"])`).click();
await admin.fill('input[name="startTime"]:visible', "08:00");
await admin.fill('input[name="endTime"]:visible', "07:00");
await admin.click("form:visible button[type=submit]");
await admin.waitForSelector("text=ساعت پایان باید بعد از شروع باشد");
check("end before start rejected", true);
await admin.fill('input[name="endTime"]:visible', "22:00");
await admin.fill('input[name="slotMinutes"]:visible', "60");
await admin.fill('input[name="capacity"]:visible', "1");
await admin.fill('input[name="minLeadHours"]:visible', "0");
await admin.fill('input[name="maxDaysAhead"]:visible', "5");
await admin.selectOption('select[name="branchId"]:visible', { index: 1 });
await Promise.all([admin.waitForURL(/\/templates\/[0-9a-f-]{36}$/), admin.click("form:visible button[type=submit]")]);
const tplUrl = admin.url();
await admin.waitForSelector('[data-testid="preview"]');
check("template created with live preview", (await admin.locator('[data-testid="preview"] li li').count()) > 0);
await admin.goto(base + "/app/admin/booking/types");
await admin.waitForSelector("main li:visible");
check("types list shows seeded types", (await admin.locator("main li:visible").count()) >= 5);

// --- visitor books from an Instagram link
const vctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const v = await vctx.newPage();
await v.goto(base + "/book?src=instagram&course=robotics");
await v.waitForSelector('[data-testid="step-child"]');
check("course link preselects trial class and course", (await v.textContent('[data-testid="step-child"]')).includes("رباتیک"));
const next = v.getByRole("button", { name: "ادامه" });
check("continue disabled until age is chosen", await next.isDisabled());
await v.getByRole("button", { name: "۸", exact: true }).click();
await next.click();
await v.waitForSelector('[data-testid="step-time"] [role=tabpanel] button');
const firstTime = v.locator('[data-testid="step-time"] [role=tabpanel] button:not([disabled])').first();
const timeText = (await firstTime.locator("span").first().textContent()).trim();
await firstTime.click();
await v.waitForSelector('[data-testid="step-contact"] input[name="guardian"]');
await v.getByRole("button", { name: "دریافت کد تأیید" }).click();
await v.waitForSelector("text=نام خود را بنویسید");
check("name required before sending code", true);
const phone = `0912${String(Date.now()).slice(-7)}`;
await v.fill('input[name="guardian"]', `مریم ${tag}`);
await v.fill('input[name="child"]', "آوا");
await v.fill('input[name="phone"]', "۰۹۱۲۱۲");
await v.getByRole("button", { name: "دریافت کد تأیید" }).click();
await v.waitForSelector("text=شماره‌ی موبایل معتبر نیست");
check("invalid phone rejected", true);
await v.fill('input[name="phone"]', phone);
await v.getByRole("button", { name: "دریافت کد تأیید" }).click();
await v.waitForSelector('input[name="code"]');
const code = await lastCode(`98${phone.slice(1)}`);
check("code sent", !!code);
await v.fill('input[name="code"]', code === "11111" ? "22222" : "11111");
await v.waitForSelector("text=کد درست نیست");
check("wrong code rejected", true);
await v.fill('input[name="code"]', code);
await v.waitForSelector('[data-testid="booking-done"]');
check("booking confirmed", (await v.textContent('[data-testid="booking-done"]')).includes(timeText.slice(0, 2)));
check("calendar file offered", (await v.locator('a[download$=".ics"]').count()) === 1);
await v.screenshot({ path: OUT + "/book-done-m.png", fullPage: true });

// The slot (capacity 1) is now full for everyone.
const v2 = await (await b.newContext()).newPage();
await v2.goto(base + "/book?course=robotics");
await v2.getByRole("button", { name: "۸", exact: true }).click();
await v2.getByRole("button", { name: "ادامه" }).click();
await v2.waitForSelector('[data-testid="step-time"] [role=tabpanel] button');
const fullBtn = v2.locator('[data-testid="step-time"] [role=tabpanel] button', { hasText: timeText }).first();
check("booked slot shows as full to others", await fullBtn.isDisabled());

// --- admin board
await admin.goto(base + "/app/admin/booking");
const row = admin.locator('[data-testid="booking-row"]', { hasText: `مریم ${tag}` });
check("booking on admin board", (await row.count()) === 1);
check("board shows source and child first name", (await row.textContent()).includes("اینستاگرام") && (await row.textContent()).includes("آوا"));
await row.getByRole("button", { name: "تأیید" }).click();
await admin.waitForTimeout(800);
check("admin confirms booking", (await admin.locator('[data-testid="booking-row"]', { hasText: `مریم ${tag}` }).textContent()).includes("تأیید شده"));

// --- signed-in parent books without a code (the visitor is now signed in)
await v.goto(base + "/book");
await v.waitForSelector('[data-testid="step-type"], [data-testid="step-child"]');
if (await v.locator('[data-testid="step-type"] button[aria-pressed]').count()) await v.locator('[data-testid="step-type"] button[aria-pressed]').first().click();
await v.getByRole("button", { name: "۸", exact: true }).click();
await v.getByRole("button", { name: "ادامه" }).click();
await v.waitForSelector('[data-testid="step-time"] [role=tabpanel] button:not([disabled])');
await v.locator('[data-testid="step-time"] [role=tabpanel] button:not([disabled])').first().click();
await v.fill('input[name="guardian"]', `مریم ${tag}`);
check("signed-in parent sees no phone field", (await v.locator('input[name="phone"]').count()) === 0);
await v.getByRole("button", { name: "تأیید و رزرو" }).click();
await v.waitForSelector('[data-testid="booking-done"]');
check("signed-in booking without code", true);

// --- closing tomorrow removes it from the template preview
const tomorrow = new Date(Date.now() + 86_400_000);
const jp = Object.fromEntries(new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { timeZone: "Asia/Tehran", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(tomorrow).map((x) => [x.type, x.value]));
const label = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long" }).format(tomorrow);
await admin.goto(tplUrl);
await admin.waitForSelector('[data-testid="preview"]');
check("tomorrow is in the preview before closing", (await admin.textContent('[data-testid="preview"]')).includes(label), label);
await admin.goto(base + "/app/admin/booking/closures");
await admin.selectOption('select[aria-label="روز"]:visible', jp.day);
await admin.selectOption('select[aria-label="ماه"]:visible', jp.month);
await admin.selectOption('select[aria-label="سال"]:visible', jp.year.replace(/\D/g, ""));
await admin.fill('input[name="reason.fa"]:visible', `تعطیل آزمایشی ${tag}`);
await admin.click("form:visible button[type=submit]");
await admin.waitForSelector(`text=تعطیل آزمایشی ${tag}`);
check("closed day listed", true);
await admin.screenshot({ path: OUT + "/adm-closures.png" });
await admin.goto(tplUrl);
await admin.waitForSelector('[data-testid="preview"]');
check("closed day removed from the preview", !(await admin.textContent('[data-testid="preview"]')).includes(label));
await admin.goto(base + "/app/admin/booking/closures");
await admin.locator("main li", { hasText: `تعطیل آزمایشی ${tag}` }).getByRole("button").click();
await admin.waitForTimeout(800);
check("closed day removed", (await admin.locator("main li", { hasText: `تعطیل آزمایشی ${tag}` }).count()) === 0);

// --- cleanup: deactivate the template so it stops offering times
await admin.goto(tplUrl);
await admin.locator('label:visible:has(input[name="active"])').click();
await admin.click("form:visible button[type=submit]");
await admin.waitForSelector("[role=status]:visible");
await admin.screenshot({ path: OUT + "/adm-template.png", fullPage: true });

console.log(results.join("\n"));
console.log(`TAG=${tag} PHONE=${phone}`);
await b.close();
