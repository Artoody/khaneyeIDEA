import { and, asc, desc, eq, gt, inArray, isNull, lte, ne, notExists, sql } from "drizzle-orm";
import {
  chatLinks,
  classGroups,
  classSessions,
  enrollments,
  guardians,
  messengerAccounts,
  notificationPrefs,
  outboundMessages,
  scheduledAnnouncements,
  sessionCheckins,
  students,
  teachers,
  userRoles,
  type getDb,
} from "@khaneyeidea/db";
import { tehranDay, zonedToUtc } from "./booking";
import type { BotChannel } from "./linking";
import { NOT_HELD_REASONS, recordHeld, recordNotHeld, type Mark } from "./session-work";

type Db = ReturnType<typeof getDb>;

// The teacher's post-class conversation and the scheduled notices, independent of grammY. The bot app supplies a
// Messenger per channel. First answer wins across channels; the other channel's prompt is deleted or edited
// (SESSION-LIFECYCLE.md section 2). Children's names go only to their own teacher and guardians in private chats;
// class groups only ever receive the report text, the homework and cancellation notices.

export type Button = { text: string; data: string };
export interface Messenger {
  channel: BotChannel;
  send(chatId: string, text: string, buttons?: Button[][]): Promise<string>;
  edit(chatId: string, messageId: string, text: string, buttons?: Button[][]): Promise<void>;
  remove(chatId: string, messageId: string): Promise<boolean>;
}
export type Messengers = Partial<Record<BotChannel, Messenger>>;

const CHANNEL_NAME: Record<BotChannel, string> = { bale: "بله", telegram: "تلگرام" };
const REASON_LABEL: Record<(typeof NOT_HELD_REASONS)[number], string> = {
  teacher: "معلم نتوانست بیاید",
  holiday: "تعطیلی",
  no_students: "دانش‌آموزان نیامدند",
  place: "مشکل مکان یا تجهیزات",
  other: "دلیل دیگر",
};
const fmtDay = (d: Date) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long" }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const fa = (n: number) => n.toLocaleString("fa-IR");

type Draft = { absent?: string[]; report?: string; homework?: string; noHomework?: boolean; reason?: string; nudged?: boolean };

async function linkedChats(db: Db, ms: Messengers, userId: string) {
  const rows = await db.select().from(messengerAccounts).where(eq(messengerAccounts.userId, userId));
  return rows.filter((r) => ms[r.channel as BotChannel]).map((r) => ({ channel: r.channel as BotChannel, chatId: r.chatId }));
}

async function track(db: Db, tenantId: string, channel: BotChannel, chatId: string, messageId: string, kind: string, refId: string) {
  await db.insert(outboundMessages).values({ tenantId, channel, chatId, messageId, kind, refType: "session", refId });
}

async function rosterOf(db: Db, classGroupId: string) {
  return db
    .select({ id: students.id, firstName: students.firstName })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.classGroupId, classGroupId), eq(enrollments.status, "active")))
    .orderBy(asc(students.firstName), asc(students.id));
}

async function sessionRow(db: Db, sessionId: string) {
  const [r] = await db
    .select({ s: classSessions, c: classGroups, teacherUserId: teachers.userId })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .where(eq(classSessions.id, sessionId));
  return r ?? null;
}

type Row = NonNullable<Awaited<ReturnType<typeof sessionRow>>>;

const askText = (r: Row, prefix = "") =>
  `${prefix}کلاس «${r.c.title}»، ${fmtDay(r.s.startsAt)} ${fmtTime(r.s.startsAt)} تا ${fmtTime(r.s.endsAt)} تمام شد.\nبرگزار شد؟`;
const askButtons = (sid: string): Button[][] => [[{ text: "✅ برگزار شد", data: `h:${sid}` }, { text: "❌ برگزار نشد", data: `n:${sid}` }]];

/** Step 1: ask the teacher, in every channel they linked, ten minutes after the class ended. */
export async function askDueCheckins(db: Db, ms: Messengers, now = new Date(), opts: { delayMin?: number; maxAgeHours?: number } = {}) {
  const delay = (opts.delayMin ?? 10) * 60_000;
  const oldest = new Date(now.getTime() - (opts.maxAgeHours ?? 72) * 3_600_000);
  const due = await db
    .select({ s: classSessions, c: classGroups, teacherUserId: teachers.userId })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .innerJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .where(
      and(
        eq(classSessions.status, "scheduled"),
        lte(classSessions.endsAt, new Date(now.getTime() - delay)),
        gt(classSessions.endsAt, oldest),
        notExists(db.select({ one: sql`1` }).from(sessionCheckins).where(eq(sessionCheckins.sessionId, classSessions.id))),
      ),
    );
  let asked = 0;
  for (const r of due) {
    if (!r.teacherUserId) continue;
    const chats = await linkedChats(db, ms, r.teacherUserId);
    if (!chats.length) continue; // the board shows it as awaiting; asked once the teacher links a chat
    const [claimed] = await db.insert(sessionCheckins).values({ sessionId: r.s.id, step: "asked", firstAskedAt: now }).onConflictDoNothing().returning();
    if (!claimed) continue;
    let sent = 0;
    for (const ch of chats) {
      try {
        const id = await ms[ch.channel]!.send(ch.chatId, askText(r), askButtons(r.s.id));
        await track(db, r.s.tenantId, ch.channel, ch.chatId, id, "checkin_ask", r.s.id);
        sent++;
      } catch (e) {
        console.error(`[followup] ${ch.channel} send failed`, e instanceof Error ? e.message : e);
      }
    }
    if (sent) asked++;
    else await db.delete(sessionCheckins).where(eq(sessionCheckins.sessionId, r.s.id)); // try again on the next tick
  }
  return { asked };
}

/** Admins (owner/admin) who linked a chat and did not switch this event off. */
async function notifyAdmins(db: Db, ms: Messengers, tenantId: string, eventKey: string, text: string) {
  const admins = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(messengerAccounts, eq(messengerAccounts.userId, userRoles.userId))
    .where(inArray(userRoles.role, ["owner", "admin"]));
  for (const a of admins) {
    const [pref] = await db.select().from(notificationPrefs).where(and(eq(notificationPrefs.userId, a.userId), eq(notificationPrefs.eventKey, eventKey)));
    if (pref?.mode === "off") continue;
    for (const ch of await linkedChats(db, ms, a.userId)) {
      await ms[ch.channel]!.send(ch.chatId, text).catch((e) => console.error(`[followup] admin notice failed`, e instanceof Error ? e.message : e));
    }
  }
  void tenantId;
}

/** A reminder after two hours, and after 21:00 on the class day the admin hears about the unanswered session. */
export async function remindPending(db: Db, ms: Messengers, now = new Date()) {
  let reminded = 0;
  let escalated = 0;
  const open = await db.select().from(sessionCheckins).where(ne(sessionCheckins.step, "done"));
  for (const k of open) {
    const r = await sessionRow(db, k.sessionId);
    if (!r || r.s.status !== "scheduled") continue;
    if (!k.remindedAt && k.firstAskedAt && k.firstAskedAt.getTime() <= now.getTime() - 2 * 3_600_000 && r.teacherUserId) {
      await db.update(sessionCheckins).set({ remindedAt: now }).where(eq(sessionCheckins.sessionId, k.sessionId));
      for (const ch of await linkedChats(db, ms, r.teacherUserId)) {
        if (k.answeredChannel && k.answeredChannel !== ch.channel) continue;
        try {
          if (k.step === "asked") {
            const id = await ms[ch.channel]!.send(ch.chatId, askText(r, "یادآوری: "), askButtons(r.s.id));
            await track(db, r.s.tenantId, ch.channel, ch.chatId, id, "checkin_ask", r.s.id);
          } else {
            const v = await view(db, k.sessionId);
            if (v) await ms[ch.channel]!.send(ch.chatId, `یادآوری: این جلسه هنوز کامل ثبت نشده.\n\n${v.text}`, v.buttons);
          }
          reminded++;
        } catch (e) {
          console.error("[followup] reminder failed", e instanceof Error ? e.message : e);
        }
      }
    }
    const cutoff = zonedToUtc(tehranDay(r.s.endsAt), "21:00");
    if (!k.escalatedAt && cutoff <= now) {
      const [won] = await db
        .update(sessionCheckins)
        .set({ escalatedAt: now })
        .where(and(eq(sessionCheckins.sessionId, k.sessionId), isNull(sessionCheckins.escalatedAt)))
        .returning();
      if (won) {
        await notifyAdmins(db, ms, r.s.tenantId, "session_unanswered", `جلسه‌ی «${r.c.title}» (${fmtDay(r.s.startsAt)}) هنوز بی‌جواب است. در تابلوی جلسات دیده می‌شود.`);
        escalated++;
      }
    }
  }
  return { reminded, escalated };
}

// ---- the conversation ------------------------------------------------------------------------------------------

async function view(db: Db, sessionId: string): Promise<{ text: string; buttons?: Button[][] } | null> {
  const r = await sessionRow(db, sessionId);
  const [k] = await db.select().from(sessionCheckins).where(eq(sessionCheckins.sessionId, sessionId));
  if (!r || !k) return null;
  const d = (k.draft ?? {}) as Draft;
  const title = `«${r.c.title}»، ${fmtDay(r.s.startsAt)}`;
  switch (k.step) {
    case "attendance": {
      const roster = await rosterOf(db, r.c.id);
      const absent = new Set(d.absent ?? []);
      const rows: Button[][] = [];
      for (let i = 0; i < roster.length; i += 2) {
        rows.push(roster.slice(i, i + 2).map((s, j) => ({ text: `${absent.has(s.id) ? "❌" : "✅"} ${s.firstName}`, data: `t:${sessionId}:${i + j}` })));
      }
      rows.push([{ text: "تأیید حضور و غیاب", data: `a:${sessionId}` }]);
      return { text: `حضور و غیاب ${title}\nهمه حاضر فرض شده‌اند. روی غایب‌ها بزنید.`, buttons: rows };
    }
    case "report":
      return { text: `گزارش جلسه ${title}\nامروز چه کار کردید؟ متن بنویسید.` };
    case "homework":
      return { text: "تکلیف جلسه‌ی بعد؟ متن بنویسید یا دکمه را بزنید.", buttons: [[{ text: "تکلیف ندارد", data: `w:${sessionId}` }]] };
    case "preview": {
      const absent = d.absent?.length ?? 0;
      return {
        text: `پیش‌نمایش ${title}\n\n${d.report ?? ""}\n\nتکلیف: ${d.noHomework ? "ندارد" : (d.homework ?? "")}\nغایب: ${fa(absent)} نفر\n\nبا «ارسال»، گزارش در گروه کلاس منتشر می‌شود.`,
        buttons: [[{ text: "ارسال", data: `f:${sessionId}` }, { text: "ویرایش گزارش", data: `e:${sessionId}` }]],
      };
    }
    case "reason":
      return {
        text: `چرا برگزار نشد؟ ${title}`,
        buttons: NOT_HELD_REASONS.map((k2, i) => [{ text: REASON_LABEL[k2], data: `r:${sessionId}:${i}` }]),
      };
    case "makeup":
      return {
        text: "جلسه‌ی جبرانی لازم است؟",
        buttons: [[{ text: "بله", data: `m:${sessionId}:y` }, { text: "نه", data: `m:${sessionId}:n` }, { text: "ادمین تصمیم بگیرد", data: `m:${sessionId}:a` }]],
      };
    default:
      return null;
  }
}

async function setStep(db: Db, sessionId: string, step: string, draft?: Draft) {
  await db
    .update(sessionCheckins)
    .set({ step, ...(draft ? { draft } : {}), updatedAt: new Date() })
    .where(eq(sessionCheckins.sessionId, sessionId));
}

async function actorFor(db: Db, channel: BotChannel, chatId: string) {
  const [a] = await db.select().from(messengerAccounts).where(and(eq(messengerAccounts.channel, channel), eq(messengerAccounts.chatId, chatId)));
  if (!a) return null;
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, a.userId));
  return { userId: a.userId, isAdmin: roles.some((x) => x.role === "owner" || x.role === "admin") };
}

/** After one channel answers: delete the other channels' prompts, or edit them when deleting is not possible. */
async function supersedeOthers(db: Db, ms: Messengers, sessionId: string, winner: BotChannel) {
  const rows = await db
    .select()
    .from(outboundMessages)
    .where(and(eq(outboundMessages.refType, "session"), eq(outboundMessages.refId, sessionId), eq(outboundMessages.kind, "checkin_ask"), eq(outboundMessages.state, "sent")));
  for (const m of rows) {
    if (m.channel === winner) continue;
    const msgr = ms[m.channel as BotChannel];
    if (!msgr) continue;
    let state: "deleted" | "edited" | "failed" = "failed";
    if (await msgr.remove(m.chatId, m.messageId).catch(() => false)) state = "deleted";
    else if (await msgr.edit(m.chatId, m.messageId, `در ${CHANNEL_NAME[winner]} پاسخ داده شد ✓`).then(() => true, () => false)) state = "edited";
    await db.update(outboundMessages).set({ state }).where(eq(outboundMessages.id, m.id));
  }
}

export type CallbackResult = { toast?: string };

/** A button press from a teacher (or an admin) in a private chat. */
export async function handleCallback(
  db: Db,
  ms: Messengers,
  p: { channel: BotChannel; chatId: string; messageId: string; data: string },
): Promise<CallbackResult> {
  const [op, sid, arg] = p.data.split(":");
  if (!op || !sid || !/^[0-9a-f-]{36}$/.test(sid)) return {};
  const me = ms[p.channel]!;
  const actor = await actorFor(db, p.channel, p.chatId);
  const r = await sessionRow(db, sid);
  if (!actor || !r || (!actor.isAdmin && r.teacherUserId !== actor.userId)) return { toast: "این جلسه برای شما نیست." };

  const show = async () => {
    const v = await view(db, sid);
    if (v) await me.edit(p.chatId, p.messageId, v.text, v.buttons);
  };
  const [k] = await db.select().from(sessionCheckins).where(eq(sessionCheckins.sessionId, sid));
  if (!k) return { toast: "این پرسش دیگر فعال نیست." };
  if (r.s.status !== "scheduled" && k.step !== "sending" && k.step !== "done") {
    // answered on the website meanwhile
    await me.edit(p.chatId, p.messageId, "این جلسه قبلاً ثبت شده است ✓").catch(() => {});
    return {};
  }
  if (k.step === "done") {
    await me.edit(p.chatId, p.messageId, "این جلسه قبلاً ثبت شده است ✓").catch(() => {});
    return {};
  }
  const draft = (k.draft ?? {}) as Draft;

  if (op === "h" || op === "n") {
    const [won] = await db
      .update(sessionCheckins)
      .set({ answeredChannel: p.channel, step: op === "h" ? "attendance" : "reason", updatedAt: new Date() })
      .where(and(eq(sessionCheckins.sessionId, sid), isNull(sessionCheckins.answeredChannel), eq(sessionCheckins.step, "asked")))
      .returning();
    if (!won) {
      if (k.answeredChannel && k.answeredChannel !== p.channel) {
        await me.edit(p.chatId, p.messageId, `در ${CHANNEL_NAME[k.answeredChannel as BotChannel]} پاسخ داده شد ✓`).catch(() => {});
        return { toast: `در ${CHANNEL_NAME[k.answeredChannel as BotChannel]} پاسخ داده شد` };
      }
      await show();
      return {};
    }
    await supersedeOthers(db, ms, sid, p.channel);
    await show();
    return {};
  }
  // everything after the first answer belongs to the channel that won
  if (k.answeredChannel !== p.channel) return { toast: `ادامه در ${k.answeredChannel ? CHANNEL_NAME[k.answeredChannel as BotChannel] : "پیام‌رسان دیگر"} است.` };

  switch (op) {
    case "t": {
      if (k.step !== "attendance") return {};
      const roster = await rosterOf(db, r.c.id);
      const stu = roster[Number(arg)];
      if (!stu) return {};
      const absent = new Set(draft.absent ?? []);
      if (absent.has(stu.id)) absent.delete(stu.id);
      else absent.add(stu.id);
      await setStep(db, sid, "attendance", { ...draft, absent: [...absent] });
      await show();
      return {};
    }
    case "a":
      if (k.step === "attendance") await setStep(db, sid, "report");
      await show();
      return {};
    case "w":
      if (k.step === "homework") await setStep(db, sid, "preview", { ...draft, noHomework: true, homework: undefined });
      await show();
      return {};
    case "e":
      if (k.step === "preview") await setStep(db, sid, "report");
      await show();
      return {};
    case "r": {
      if (k.step !== "reason") return {};
      const reason = NOT_HELD_REASONS[Number(arg)];
      if (!reason) return {};
      await setStep(db, sid, "makeup", { ...draft, reason });
      await show();
      return {};
    }
    case "m": {
      if (k.step !== "makeup") return {};
      const [claim] = await db
        .update(sessionCheckins)
        .set({ step: "sending" })
        .where(and(eq(sessionCheckins.sessionId, sid), eq(sessionCheckins.step, "makeup")))
        .returning();
      if (!claim) return {};
      const needsMakeup = arg !== "n";
      await recordNotHeld(db, { sessionId: sid, reason: draft.reason ?? "other", needsMakeup });
      await setStep(db, sid, "done");
      await me.edit(p.chatId, p.messageId, "ثبت شد ✓ ادمین مطلع شد.");
      await notifyAdmins(
        db,
        ms,
        r.s.tenantId,
        "session_not_held",
        `جلسه‌ی «${r.c.title}» (${fmtDay(r.s.startsAt)}) برگزار نشد: ${REASON_LABEL[(draft.reason as keyof typeof REASON_LABEL) ?? "other"]}.${needsMakeup ? " جلسه‌ی جبرانی لازم است." : ""}`,
      );
      return {};
    }
    case "f": {
      if (k.step !== "preview") return {};
      const [claim] = await db
        .update(sessionCheckins)
        .set({ step: "sending" })
        .where(and(eq(sessionCheckins.sessionId, sid), eq(sessionCheckins.step, "preview")))
        .returning();
      if (!claim) return {};
      const marks: Record<string, Mark> = Object.fromEntries((draft.absent ?? []).map((id) => [id, "absent" as const]));
      await recordHeld(db, { sessionId: sid, userId: actor.userId, channel: p.channel, marks, summary: draft.report ?? null, homework: draft.noHomework ? null : (draft.homework ?? null) });
      await setStep(db, sid, "done");
      const posted = await publishReport(db, ms, r, draft);
      await notifyAbsentParents(db, ms, r, draft.absent ?? []);
      await me.edit(p.chatId, p.messageId, posted ? "ثبت شد ✓ گزارش در گروه کلاس منتشر شد." : "ثبت شد ✓ (گروهی به این کلاس وصل نیست، گزارش فقط ذخیره شد.)");
      return {};
    }
    default:
      return {};
  }
}

/** A text message from a teacher while a report or homework answer is expected. Returns false if it is not one. */
export async function handleText(db: Db, ms: Messengers, p: { channel: BotChannel; chatId: string; text: string }): Promise<boolean> {
  const actor = await actorFor(db, p.channel, p.chatId);
  if (!actor) return false;
  const [k] = await db
    .select({ k: sessionCheckins, s: classSessions })
    .from(sessionCheckins)
    .innerJoin(classSessions, eq(classSessions.id, sessionCheckins.sessionId))
    .innerJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .where(and(eq(teachers.userId, actor.userId), eq(sessionCheckins.answeredChannel, p.channel), inArray(sessionCheckins.step, ["report", "homework"])))
    .orderBy(desc(sessionCheckins.updatedAt))
    .limit(1);
  if (!k) return false;
  const text = p.text.trim().slice(0, 4000);
  if (!text) return false;
  const draft = (k.k.draft ?? {}) as Draft;
  const sid = k.k.sessionId;
  if (k.k.step === "report") await setStep(db, sid, "homework", { ...draft, report: text });
  else await setStep(db, sid, "preview", { ...draft, homework: text, noHomework: false });
  const v = await view(db, sid);
  if (v) await ms[p.channel]!.send(p.chatId, v.text, v.buttons);
  return true;
}

// ---- delivery --------------------------------------------------------------------------------------------------

async function groupChats(db: Db, ms: Messengers, classGroupId: string) {
  const rows = await db.select().from(chatLinks).where(eq(chatLinks.classGroupId, classGroupId));
  return rows.filter((l) => ms[l.channel as BotChannel]);
}

async function publishReport(db: Db, ms: Messengers, r: Row, d: Draft) {
  const text = `گزارش جلسه‌ی «${r.c.title}»، ${fmtDay(r.s.startsAt)}\n\n${d.report ?? ""}${d.noHomework || !d.homework ? "" : `\n\nتکلیف: ${d.homework}`}`;
  let ok = 0;
  for (const l of await groupChats(db, ms, r.c.id)) {
    try {
      const id = await ms[l.channel as BotChannel]!.send(l.chatId, text);
      await track(db, r.s.tenantId, l.channel as BotChannel, l.chatId, id, "report", r.s.id);
      ok++;
    } catch (e) {
      console.error(`[followup] group post failed (${l.channel})`, e instanceof Error ? e.message : e);
    }
  }
  return ok > 0;
}

async function parentChats(db: Db, ms: Messengers, studentIds: string[]) {
  if (!studentIds.length) return [];
  const rows = await db
    .select({ studentId: guardians.studentId, userId: guardians.userId })
    .from(guardians)
    .where(inArray(guardians.studentId, studentIds));
  const out: { studentId: string; channel: BotChannel; chatId: string }[] = [];
  for (const g of rows) for (const ch of await linkedChats(db, ms, g.userId)) out.push({ studentId: g.studentId, ...ch });
  return out;
}

/** Absent children's parents hear about it privately (never in the group). */
async function notifyAbsentParents(db: Db, ms: Messengers, r: Row, absentIds: string[]) {
  if (!absentIds.length) return;
  const names = new Map((await db.select({ id: students.id, n: students.firstName }).from(students).where(inArray(students.id, absentIds))).map((s) => [s.id, s.n]));
  for (const c of await parentChats(db, ms, absentIds)) {
    await ms[c.channel]!
      .send(c.chatId, `امروز ${names.get(c.studentId) ?? "فرزندتان"} در کلاس «${r.c.title}» حضور نداشت. برای جلسه‌ی جبرانی با آموزشگاه هماهنگ کنید.`)
      .catch((e) => console.error("[followup] absent notice failed", e instanceof Error ? e.message : e));
  }
}

/** Sends every approved notice whose time has come (cancellations etc.). Claims first, so it never sends twice. */
export async function sendDueAnnouncements(db: Db, ms: Messengers, now = new Date()) {
  const due = await db
    .update(scheduledAnnouncements)
    .set({ status: "sent", sentAt: now })
    .where(and(eq(scheduledAnnouncements.status, "scheduled"), lte(scheduledAnnouncements.sendAt, now)))
    .returning();
  let sent = 0;
  let failed = 0;
  for (const a of due) {
    const [sess] = a.sessionId ? await db.select().from(classSessions).where(eq(classSessions.id, a.sessionId)) : [];
    let delivered = 0;
    if (sess) {
      const targets: { channel: BotChannel; chatId: string }[] = [];
      if (a.targets.group) for (const l of await groupChats(db, ms, sess.classGroupId)) targets.push({ channel: l.channel as BotChannel, chatId: l.chatId });
      if (a.targets.parents) {
        const roster = await db.select({ id: enrollments.studentId }).from(enrollments).where(and(eq(enrollments.classGroupId, sess.classGroupId), eq(enrollments.status, "active")));
        for (const c of await parentChats(db, ms, roster.map((x) => x.id))) targets.push({ channel: c.channel, chatId: c.chatId });
      }
      const seen = new Set<string>();
      for (const t of targets) {
        const key = `${t.channel}:${t.chatId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          const id = await ms[t.channel]!.send(t.chatId, a.text);
          await track(db, a.tenantId, t.channel, t.chatId, id, "announcement", sess.id);
          delivered++;
        } catch (e) {
          console.error(`[announce] ${t.channel} failed`, e instanceof Error ? e.message : e);
        }
      }
    }
    if (delivered) sent++;
    else {
      failed++;
      await db.update(scheduledAnnouncements).set({ status: "failed", sentAt: null }).where(eq(scheduledAnnouncements.id, a.id));
    }
  }
  return { sent, failed };
}
