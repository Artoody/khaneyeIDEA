// The booking calendar: the admin paints Thursday 12:00-13:00 as open, a visitor sees only that on the Jalali
// calendar and books it, the admin sees the booking on the day and cancels it, then the hours are cleared again.
// Needs owner-state.json in <dir>, the dev server on :3000 (its log has the OTP codes), OTP_DEV_CODE unset or any. Usage:
//   node e2e/booking-calendar.e2e.mjs <dir> <dev.log>
import { chromium } from "playwright-core";
import fs from "node:fs";
const [, , OUT, LOG] = process.argv;
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
const lastCode = async (phone) => {
  for (let i = 0; i < 20; i++) {
    const m = [...fs.readFileSync(LOG, "utf8").matchAll(new RegExp(`\\[otp\\] ${phone}: (\\d{4})`, "g"))].pop();
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
};

const admin = await (await b.newContext({ viewport: { width: 1280, height: 1000 }, storageState: OUT + "/owner-state.json" })).newPage();
const errs = [];
admin.on("pageerror", (e) => errs.push(e.message));

// 1. paint
await admin.goto(base + "/app/admin/booking/calendar");
await admin.waitForSelector('[data-testid="painter"]');
await admin.getByRole("link", { name: "کلاس آزمایشی", exact: true }).click();
await admin.waitForURL(/t=/);
await admin.getByRole("link", { name: "آنلاین یا تلفنی", exact: true }).click();
await admin.waitForURL(/b=remote/);
await admin.waitForSelector('[data-testid="painter"]');
await admin.waitForTimeout(1500); // hydration
check("no hours open yet for this type and place", (await admin.locator('[data-cell][aria-pressed="true"]').count()) === 0);
await admin.locator('[data-cell="5|12:00"]').click();
await admin.locator('[data-cell="5|12:30"]').click();
check("two half hours painted", (await admin.locator('[data-cell][aria-pressed="true"]').count()) === 2);
check("summary counts one bookable slot", (await admin.textContent('[data-testid="painter-summary"]')).includes("۱ وقت"));
await admin.locator('[data-testid="painter-save"]').click();
await admin.waitForSelector("[role=status]:visible");
check("saved", /ذخیره شد/.test(await admin.textContent("[role=status]:visible")));
await admin.reload();
await admin.waitForSelector('[data-testid="painter"]');
check("painted hours are still there after a reload", (await admin.locator('[data-cell="5|12:00"][aria-pressed="true"]').count()) === 1);

// 2. the visitor sees them on the Jalali calendar and books
const v = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await v.goto(base + "/book?course=robotics");
await v.waitForSelector('[data-testid="step-child"]');
await v.getByRole("button", { name: "۸", exact: true }).click();
await v.getByRole("button", { name: "ادامه" }).click();
await v.waitForSelector('[data-testid="month"]');
check("the month calendar is Jalali", /(مهر|آبان|آذر|دی|بهمن|اسفند|فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور)/.test(await v.textContent('[data-testid="month"]')));
check("a nearest free time is offered", (await v.locator('[data-testid="nearest-slot"]').count()) === 1);
const days = await v.locator('[data-testid="month"] [data-day]:not([disabled])').evaluateAll((els) => els.map((e) => e.getAttribute("data-day")));
const thursdays = days.filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 4);
check("open days include a Thursday", thursdays.length > 0, `(${days.length} open days)`);
await v.locator(`[data-day="${thursdays[0]}"]`).click();
const chips = await v.locator('[data-testid="slot-times"] button:not([disabled])').allTextContents();
check("that Thursday offers 12:00", chips.some((t) => t.includes("۱۲:۰۰")), chips.join("|"));
await v.locator('[data-testid="slot-times"] button', { hasText: "۱۲:۰۰" }).first().click();
const phone = `0912${String(Date.now()).slice(-7)}`;
await v.waitForSelector('[data-testid="step-contact"] input[name="guardian"]');
await v.fill('input[name="guardian"]', `نرگس ${tag}`);
await v.fill('input[name="child"]', "کیان");
await v.fill('input[name="phone"]', phone);
await v.getByRole("button", { name: "دریافت کد تأیید" }).click();
await v.waitForSelector('input[name="code"]');
await v.fill('input[name="code"]', await lastCode(`98${phone.slice(1)}`));
await v.waitForSelector('[data-testid="booking-done"]');
check("booked", true);

// 3. the admin sees it on that day, and cancels it
await admin.getByRole("tab", { name: "تقویم و رزروها" }).click();
await admin.waitForSelector('[data-testid="month"]');
await admin.locator(`[data-day="${thursdays[0]}"]`).click();
await admin.waitForSelector('[data-testid="day-panel"]');
const panel = await admin.textContent('[data-testid="day-panel"]');
check("the day shows the booking", panel.includes(`نرگس ${tag}`));
check("and the slot is full", panel.includes("بسته") || panel.includes("۰ از"));
await admin.locator('[data-testid="day-panel"] li', { hasText: `نرگس ${tag}` }).getByRole("button", { name: "لغو" }).click();
await admin.waitForFunction((n) => !document.querySelector('[data-testid="day-panel"]')?.textContent?.includes(n), `نرگس ${tag}`, { timeout: 15000 });
check("canceling frees the slot", true);

// 4. clean up: close all hours again
await admin.getByRole("tab", { name: "ساعت‌های باز هفته" }).click();
await admin.getByRole("button", { name: "بستن همه" }).click();
await admin.locator('[data-testid="painter-save"]').click();
await admin.waitForSelector("[role=status]:visible");
await admin.reload();
await admin.waitForSelector('[data-testid="painter"]');
check("hours cleared again", (await admin.locator('[data-cell][aria-pressed="true"]').count()) === 0);

console.log(R.join("\n"));
console.log("errors:", errs);
await b.close();
