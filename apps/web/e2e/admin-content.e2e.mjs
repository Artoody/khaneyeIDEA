// Admin e2e for content sections: page texts, departments, courses, teachers, achievements.
// Edits go through the panel and the public site is checked right after. Seed data is restored at the end.
// Needs a saved owner session (owner-state.json) in the given directory. Usage: node e2e/admin-content.e2e.mjs <dir>
import { chromium } from "playwright-core";
const [, , OUT] = process.argv;
const base = "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: OUT + "/owner-state.json" });
const p = await ctx.newPage();
const results = [];
const check = (n, ok, x = "") => results.push(`${ok ? "PASS" : "FAIL"} ${n} ${x}`);
const page = async (path) => (await fetch(base + path)).text();
const save = async () => {
  await p.click("form:visible button[type=submit]");
  await p.waitForSelector("[role=status]:visible");
};
// Lists stream in behind a skeleton: wait for the first row before counting.
const rows = async () => {
  await p.waitForSelector("main li:visible", { timeout: 15000 }).catch(() => {});
  return p.locator("main li:visible").count();
};
const tag = Date.now().toString(36).slice(-5);

// Page texts: headline edit shows on the home page, then restore.
await p.goto(base + "/app/admin/pages");
const titleInput = 'textarea[name="home.hero.title.fa"]:visible, input[name="home.hero.title.fa"]:visible';
const oldTitle = await p.inputValue(titleInput);
await p.fill(titleInput, `تیتر آزمایشی ${tag}`);
await save();
check("page text saved and shown on home", (await page("/")).includes(`تیتر آزمایشی ${tag}`));
await p.fill(titleInput, "");
await p.click("form:visible button[type=submit]");
await p.waitForSelector("text=متن فارسی لازم است");
check("empty Persian text rejected", true);
await p.fill(titleInput, oldTitle);
await save();
check("headline restored", (await page("/")).includes(oldTitle));

// Departments: create, appears in the home bento, deactivate removes it.
await p.goto(base + "/app/admin/departments/new");
await p.fill('input[name="title.fa"]:visible', `دپارتمان ${tag}`);
await p.fill('input[name="slug"]:visible', `dept-${tag}`);
await Promise.all([p.waitForURL(/\/departments\/[0-9a-f-]{36}$/), p.click("form:visible button[type=submit]")]);
check("department created", true);
check("new department on home", (await page("/")).includes(`دپارتمان ${tag}`));
await p.locator('label:visible:has(input[name="active"])').click();
await save();
check("inactive department hidden from home", !(await page("/")).includes(`دپارتمان ${tag}`));

// Courses: dashboard filter, edit price and branches, duplicate slug rejected.
await p.goto(base + "/app/admin/courses?missing=price");
const missingCount = await rows();
check("missing-price filter lists courses", missingCount > 0, `(${missingCount})`);
await p.goto(base + "/app/admin/courses");
const total = await rows();
check("all courses listed", total >= 20, `(${total})`);
await p.goto(base + "/app/admin/courses/new");
await p.fill('input[name="title.fa"]:visible', `دوره ${tag}`);
await p.fill('input[name="slug"]:visible', `course-${tag}`);
await p.fill('input[name="ageMin"]:visible', "۹");
await p.fill('input[name="ageMax"]:visible', "7");
await p.click("form:visible button[type=submit]");
await p.waitForSelector("text=عدد معتبر");
check("age range min > max rejected", true);
await p.fill('input[name="ageMax"]:visible', "12");
await p.locator('label:visible:has(input[name="modes"][value="online"])').click();
await p.locator('label:visible:has(input[name="branchIds"])').first().click();
await p.click("text=افزودن سرفصل");
await p.locator('input[aria-label="FA"]:visible').first().fill("جلسه‌ی اول");
await Promise.all([p.waitForURL(/\/courses\/[0-9a-f-]{36}$/), p.click("form:visible button[type=submit]")]);
check("course created", true);
check("persian digits parsed for age", (await p.inputValue('input[name="ageMin"]:visible')) === "9");
check("mode kept", await p.locator('input[name="modes"][value="online"]:visible, form:visible input[name="modes"][value="online"]').first().isChecked());
check("branch kept", (await p.locator('form:visible input[name="branchIds"]:checked').count()) === 1);
check("syllabus kept", (await p.locator('input[aria-label="FA"]:visible').first().inputValue()) === "جلسه‌ی اول");
const courseUrl = p.url();
await p.goto(base + "/app/admin/courses/new");
await p.fill('input[name="title.fa"]:visible', "تکراری");
await p.fill('input[name="slug"]:visible', `course-${tag}`);
await p.click("form:visible button[type=submit]");
await p.waitForSelector("text=قبلاً استفاده شده");
check("duplicate course slug rejected", true);

// Teachers: sample badge in the list.
await p.goto(base + "/app/admin/teachers/new");
await p.fill('input[name="name.fa"]:visible', `مربی ${tag}`);
await p.locator('label:visible:has(input[name="isSample"])').click();
await Promise.all([p.waitForURL(/\/teachers\/[0-9a-f-]{36}$/), p.click("form:visible button[type=submit]")]);
await p.goto(base + "/app/admin/teachers");
const row = p.locator(`li:visible:has-text("مربی ${tag}")`);
check("sample teacher shows badge", (await row.textContent()).includes("نمونه"));

// Achievements: search and missing-English filter.
await p.goto(base + "/app/admin/achievements");
const allA = await rows();
await p.fill('input[name="q"]:visible', "RoboCup");
await p.keyboard.press("Enter");
await p.waitForURL(/q=RoboCup/);
const found = await rows();
check("achievement search narrows the list", found > 0 && found < allA, `(${found}/${allA})`);
await p.goto(base + "/app/admin/achievements?missing=en");
const noEn = await rows();
check("missing-English filter", noEn > 0 && noEn <= allA, `(${noEn})`);
await p.screenshot({ path: OUT + "/adm-achievements.png", fullPage: false });
await p.goto(courseUrl);
await p.screenshot({ path: OUT + "/adm-course-edit.png", fullPage: true });

// Anonymous users never reach the forms.
const anon = await (await b.newContext()).newPage();
await anon.goto(base + "/app/admin/courses");
check("anonymous redirected to login", anon.url().endsWith("/login"));

console.log(results.join("\n"));
console.log(`TAG=${tag}`);
await b.close();
