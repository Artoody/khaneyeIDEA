// Runs the real bot process against a local fake of the Bale/Telegram Bot API (no tokens, no internet) and plays
// the whole teacher conversation: /start CODE links the chat, the bot asks after class, buttons and text answer,
// the report lands in the linked class group, and /link CODE in the group links it. Usage (dev server not needed):
//   pnpm --filter @khaneyeidea/bot exec tsx e2e/mock-api.e2e.ts
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import {
  chatLinks,
  classGroups,
  classSessions,
  closeDb,
  courses,
  enrollments,
  getDb,
  homework,
  sessionReports,
  students,
  teachers,
  tenants,
  userRoles,
  users,
} from "@khaneyeidea/db";
import { createLinkCode } from "@khaneyeidea/core";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const db = getDb();
const R: string[] = [];
const check = (n: string, ok: boolean, x = "") => R.push(`${ok ? "PASS" : "FAIL"} ${n} ${x}`);

type Call = { method: string; body: Record<string, any> };
const calls: Call[] = [];
const updates: Record<string, unknown>[] = [];
let updateId = 1000;
let msgId = 500;
const push = (u: Record<string, unknown>) => updates.push({ update_id: ++updateId, ...u });

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    const method = req.url!.split("/").pop()!.split("?")[0]!;
    let body: Record<string, any> = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = Object.fromEntries(new URLSearchParams(raw));
    }
    calls.push({ method, body });
    const ok = (result: unknown) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, result }));
    };
    if (method === "getMe") return ok({ id: 1, is_bot: true, first_name: "Test", username: "test_bot", can_join_groups: true });
    if (method === "getUpdates") {
      for (let i = 0; i < 10 && updates.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
      return ok(updates.splice(0, updates.length));
    }
    if (method === "sendMessage") return ok({ message_id: ++msgId, date: 0, chat: { id: Number(body.chat_id), type: "private" }, text: body.text });
    return ok(true);
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as { port: number }).port;

// Fixture: a teacher with a class, three students and a session that ended 20 minutes ago.
const [t] = await db.insert(tenants).values({ slug: `test-bot-${Date.now()}`, name: "t" }).returning();
const tenantId = t!.id;
const [u] = await db.insert(users).values({ tenantId, phone: "989120000999", fullName: "معلم تست" }).returning();
await db.insert(userRoles).values({ userId: u!.id, role: "teacher" });
const [course] = await db.insert(courses).values({ tenantId, slug: "c", title: { fa: "دوره", en: "c" } }).returning();
const [teacher] = await db.insert(teachers).values({ tenantId, userId: u!.id, name: { fa: "معلم", en: "T" } }).returning();
const [cls] = await db
  .insert(classGroups)
  .values({ tenantId, courseId: course!.id, teacherId: teacher!.id, title: "رباتیک تست", weekday: 0, startTime: "17:00", endTime: "18:30", startsOn: "2026-01-01" })
  .returning();
const kids = await db
  .insert(students)
  .values([{ tenantId, firstName: "آوا", lastName: "x" }, { tenantId, firstName: "کیان", lastName: "x" }])
  .returning();
await db.insert(enrollments).values(kids.map((k) => ({ tenantId, classGroupId: cls!.id, studentId: k.id })));
const ended = new Date(Date.now() - 20 * 60_000);
const [sess] = await db
  .insert(classSessions)
  .values({ tenantId, classGroupId: cls!.id, teacherId: teacher!.id, startsAt: new Date(ended.getTime() - 5_400_000), endsAt: ended })
  .returning();
const userCode = (await createLinkCode(db, tenantId, "user", u!.id)).code;
const classCode = (await createLinkCode(db, tenantId, "class", cls!.id)).code;

const bot = spawn("pnpm", ["exec", "tsx", "src/index.ts"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: { ...process.env, BALE_BOT_TOKEN: "test-token", BALE_API_ROOT: `http://127.0.0.1:${port}`, TELEGRAM_BOT_TOKEN: "", BOT_JOBS_EVERY_MS: "1000" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
bot.stdout.on("data", (d) => (log += d));
bot.stderr.on("data", (d) => (log += d));

const waitFor = async (what: string, test: () => boolean, ms = 20_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  check(what, false, "(timed out)");
  return false;
};
const sent = (chat: number, re: RegExp) => calls.filter((c) => c.method === "sendMessage" && Number(c.body.chat_id) === chat && re.test(String(c.body.text)));
const lastBtns = (chat: number) => {
  const m = [...calls].reverse().find((c) => (c.method === "sendMessage" || c.method === "editMessageText") && Number(c.body.chat_id) === chat && c.body.reply_markup);
  const rm = typeof m?.body.reply_markup === "string" ? JSON.parse(m.body.reply_markup) : m?.body.reply_markup;
  return (rm?.inline_keyboard ?? []).flat() as { text: string; callback_data: string }[];
};
const press = (chat: number, mid: number, data: string) =>
  push({ callback_query: { id: String(Math.random()), from: { id: chat, is_bot: false, first_name: "t" }, message: { message_id: mid, chat: { id: chat, type: "private" }, date: 0 }, chat_instance: "x", data } });
const say = (chat: number, text: string, type = "private") =>
  push({ message: { message_id: ++msgId, date: 0, chat: { id: chat, type }, from: { id: chat, is_bot: false, first_name: "t" }, text, ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]!.length }] } : {}) } });

try {
  await waitFor("bot started", () => /is running/.test(log));
  const CHAT = 777;

  say(CHAT, `/start ${userCode}`);
  if (await waitFor("link reply", () => sent(CHAT, /حساب شما وصل شد/).length > 0)) check("/start CODE links the teacher's chat", true);

  if (await waitFor("post-class question", () => sent(CHAT, /برگزار شد؟/).length > 0)) check("the bot asks after class", true);
  const ask = [...calls].reverse().find((c) => c.method === "sendMessage" && /برگزار شد؟/.test(String(c.body.text)))!;
  const askId = msgId; // the id returned for that message
  void ask;
  const held = lastBtns(CHAT).find((b) => b.callback_data.startsWith("h:"))!;
  press(CHAT, askId - 0, held.callback_data);
  await waitFor("attendance step", () => calls.some((c) => c.method === "editMessageText" && /حضور و غیاب/.test(String(c.body.text))));
  const kian = lastBtns(CHAT).find((b) => b.text.includes("کیان"))!;
  press(CHAT, askId, kian.callback_data);
  await waitFor("toggle shown", () => lastBtns(CHAT).some((b) => b.text.includes("❌")));
  check("tapping a student marks them absent", lastBtns(CHAT).some((b) => b.text.includes("❌") && b.text.includes("کیان")));
  press(CHAT, askId, lastBtns(CHAT).find((b) => b.callback_data.startsWith("a:"))!.callback_data);
  await waitFor("report step", () => calls.some((c) => c.method === "editMessageText" && /امروز چه کار کردید/.test(String(c.body.text))));
  say(CHAT, "ساخت ربات مسیریاب");
  await waitFor("homework step", () => sent(CHAT, /تکلیف جلسه‌ی بعد/).length > 0);
  say(CHAT, "تکمیل پروژه");
  await waitFor("preview", () => sent(CHAT, /پیش‌نمایش/).length > 0);
  const prevBtns = lastBtns(CHAT);
  // link the class group before sending, so the report has somewhere to go
  say(-5001, `/link ${classCode}`, "supergroup");
  await waitFor("group linked", () => calls.some((c) => c.method === "sendMessage" && Number(c.body.chat_id) === -5001 && /وصل شد/.test(String(c.body.text))));
  check("/link CODE in a group connects the class", (await db.select().from(chatLinks).where(eq(chatLinks.classGroupId, cls!.id))).length === 1);
  press(CHAT, msgId, prevBtns.find((b) => b.callback_data.startsWith("f:"))!.callback_data);
  await waitFor("report in the group", () => sent(-5001, /ساخت ربات مسیریاب/).length > 0);
  const post = sent(-5001, /ساخت ربات مسیریاب/)[0]!;
  check("the report is posted in the class group", true);
  check("without any student's name", !kids.some((k) => String(post.body.text).includes(k.firstName)));
  const [s] = await db.select().from(classSessions).where(eq(classSessions.id, sess!.id));
  check("the session is recorded as held", s!.status === "held");
  check("with report and homework saved", (await db.select().from(sessionReports).where(eq(sessionReports.sessionId, sess!.id))).length === 1 && (await db.select().from(homework).where(eq(homework.sessionId, sess!.id))).length === 1);
  check("the bot asked only once", sent(CHAT, /برگزار شد؟/).length === 1);
} finally {
  bot.kill("SIGINT");
  server.close();
  await db.delete(tenants).where(eq(tenants.id, tenantId));
  await closeDb();
}
console.log(R.join("\n"));
if (R.some((r) => r.startsWith("FAIL"))) {
  console.log("--- bot log ---\n" + log.slice(-1500));
  process.exit(1);
}
process.exit(0);
