import { and, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  chatLinks,
  classGroups,
  classSessions,
  groupMentions,
  messengerAccounts,
  outboundMessages,
  scheduledAnnouncements,
  sessionReports,
  siteSettings,
  teachers,
  userRoles,
  users,
  type getDb,
} from "@khaneyeidea/db";
import { addDays, tehranDay, zonedToUtc } from "./booking";
import type { BotChannel } from "./linking";
import type { Messengers } from "./followup";
import { sendPush, type PushDeliver, type PushPayload } from "./push";

type Db = ReturnType<typeof getDb>;

const fmtDay = (d: Date) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long" }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

function tehranHour(d: Date) {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", hour: "2-digit", hourCycle: "h23" }).format(d);
  return Number(h) % 24;
}

function weekKey(day: string) {
  const noon = zonedToUtc(day, "12:00");
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", weekday: "short" }).format(noon);
  const map: Record<string, number> = { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 };
  return addDays(day, -(map[wd] ?? 0));
}

async function hourSetting(db: Db, tenantId: string, which: "eve" | "eod") {
  const [s] = await db.select().from(siteSettings).where(eq(siteSettings.tenantId, tenantId));
  const n = which === "eve" ? s?.eveNoticeHour : s?.eodReportDeadlineHour;
  return n ?? 21;
}

/**
 * At the configured Tehran hour, tell each linked group that tomorrow's class is on,
 * unless an admin already queued a notice for that class during the same week.
 */
export async function sendEveNotices(db: Db, ms: Messengers, now = new Date()) {
  void ms;
  const tomorrow = addDays(tehranDay(now), 1);
  const from = zonedToUtc(tomorrow, "00:00");
  const to = zonedToUtc(addDays(tomorrow, 1), "00:00");
  const due = await db
    .select({ s: classSessions, c: classGroups, meetingUrl: teachers.meetingUrl })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .where(and(eq(classSessions.status, "scheduled"), eq(classGroups.eveNoticeEnabled, true), gte(classSessions.startsAt, from), lt(classSessions.startsAt, to)));

  let sent = 0;
  for (const row of due) {
    if (tehranHour(now) !== (await hourSetting(db, row.s.tenantId, "eve"))) continue;
    const week = weekKey(tomorrow);
    const weekFrom = zonedToUtc(week, "00:00");
    const weekTo = zonedToUtc(addDays(week, 7), "00:00");
    const [adminNote] = await db
      .select({ id: scheduledAnnouncements.id })
      .from(scheduledAnnouncements)
      .innerJoin(classSessions, eq(classSessions.id, scheduledAnnouncements.sessionId))
      .where(
        and(
          eq(classSessions.classGroupId, row.c.id),
          inArray(scheduledAnnouncements.status, ["scheduled", "sent"]),
          gte(classSessions.startsAt, weekFrom),
          lt(classSessions.startsAt, weekTo),
          or(sql`${scheduledAnnouncements.targets}->>'kind' is null`, sql`${scheduledAnnouncements.targets}->>'kind' = 'notice'`),
        ),
      )
      .limit(1);
    if (adminNote) continue;
    const [already] = await db
      .select({ id: scheduledAnnouncements.id })
      .from(scheduledAnnouncements)
      .where(and(eq(scheduledAnnouncements.sessionId, row.s.id), sql`${scheduledAnnouncements.targets}->>'kind' = 'eve'`, inArray(scheduledAnnouncements.status, ["scheduled", "sent"])))
      .limit(1);
    if (already) continue;

    const link = row.c.onlineUrl || row.meetingUrl;
    const text = `کلاس «${row.c.title}» ${fmtDay(row.s.startsAt)} ساعت ${fmtTime(row.s.startsAt)} برگزار می‌شود.${link ? `\nلینک کلاس: ${link}` : ""}`;
    const [claim] = await db
      .insert(scheduledAnnouncements)
      .values({
        tenantId: row.s.tenantId,
        sessionId: row.s.id,
        text,
        sendAt: now,
        targets: { group: true, parents: false, kind: "eve" },
        status: "scheduled",
      })
      .returning({ id: scheduledAnnouncements.id });
    if (claim) sent++;
  }
  return { queued: sent };
}

type MentionIn = {
  channel: BotChannel;
  chatId: string;
  messageId: string;
  fromId: string;
  text: string;
  username?: string | null;
};

/** A group message: the teacher's own reply closes open questions; a tag opens one. */
export async function ingestGroupMessage(db: Db, p: MentionIn) {
  const [link] = await db
    .select({ classGroupId: chatLinks.classGroupId, tenantId: chatLinks.tenantId, teacherId: classGroups.teacherId })
    .from(chatLinks)
    .innerJoin(classGroups, eq(classGroups.id, chatLinks.classGroupId))
    .where(and(eq(chatLinks.channel, p.channel), eq(chatLinks.chatId, p.chatId)));
  if (!link?.teacherId) return { tagged: false as const };
  const [teacher] = await db
    .select({ id: teachers.id, userId: teachers.userId, name: teachers.name })
    .from(teachers)
    .where(eq(teachers.id, link.teacherId));
  if (!teacher?.userId) return { tagged: false as const };
  const accounts = await db.select().from(messengerAccounts).where(eq(messengerAccounts.userId, teacher.userId));
  const mine = accounts.some((a) => a.channel === p.channel && a.chatId === p.fromId);
  if (mine) {
    await db
      .update(groupMentions)
      .set({ answeredAt: new Date() })
      .where(and(eq(groupMentions.channel, p.channel), eq(groupMentions.chatId, p.chatId), eq(groupMentions.teacherId, teacher.id), isNull(groupMentions.answeredAt)));
    return { tagged: false as const, answered: true as const };
  }
  const [user] = await db.select({ username: users.username, fullName: users.fullName }).from(users).where(eq(users.id, teacher.userId));
  const handles = [user?.username, ...accounts.map((a) => a.username)].filter((x): x is string => !!x).map((x) => x.replace(/^@/, "").toLowerCase());
  const name = teacher.name.fa?.trim() ?? "";
  const lower = p.text.toLowerCase();
  const tagged = handles.some((h) => h.length >= 3 && (lower.includes(`@${h}`) || lower.includes(h))) || (name.length >= 3 && p.text.includes(name));
  if (!tagged) return { tagged: false as const };
  await db
    .insert(groupMentions)
    .values({
      tenantId: link.tenantId,
      channel: p.channel,
      chatId: p.chatId,
      messageId: p.messageId,
      classGroupId: link.classGroupId,
      teacherId: teacher.id,
      snippet: p.text.trim().slice(0, 280),
    })
    .onConflictDoNothing();
  return { tagged: true as const };
}

/** One day after a tag, and once a day after that, ping the teacher in private until they answer in the group. */
export async function remindOpenMentions(db: Db, ms: Messengers, deliver: PushDeliver | null, now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  const open = await db
    .select({ m: groupMentions, title: classGroups.title, userId: teachers.userId })
    .from(groupMentions)
    .leftJoin(classGroups, eq(classGroups.id, groupMentions.classGroupId))
    .innerJoin(teachers, eq(teachers.id, groupMentions.teacherId))
    .where(and(isNull(groupMentions.answeredAt), lte(groupMentions.askedAt, new Date(now.getTime() - day)), or(isNull(groupMentions.remindedAt), lte(groupMentions.remindedAt, new Date(now.getTime() - day)))));
  let reminded = 0;
  for (const row of open) {
    const [claim] = await db
      .update(groupMentions)
      .set({ remindedAt: now })
      .where(and(eq(groupMentions.id, row.m.id), isNull(groupMentions.answeredAt)))
      .returning();
    if (!claim) continue;
    const text = `در گروه «${row.title ?? "کلاس"}» از شما سؤال شده و هنوز جوابی ثبت نشده.\n${row.m.snippet ?? ""}`.trim();
    if (row.userId) {
      const chats = await db.select().from(messengerAccounts).where(eq(messengerAccounts.userId, row.userId));
      for (const ch of chats) {
        const bot = ms[ch.channel as BotChannel];
        if (!bot) continue;
        await bot.send(ch.chatId, text).catch(() => {});
      }
      if (deliver) {
        const payload: PushPayload = { title: "سؤال بی‌جواب در گروه", body: row.title ?? "کلاس", url: "/teacher", tag: `mention-${row.m.id}` };
        await sendPush(db, row.userId, payload, deliver);
      }
    }
    reminded++;
  }
  return { reminded };
}

/** Until the deadline hour, nudge the teacher when today's class has no published report. */
export async function remindIncompleteReports(db: Db, ms: Messengers, deliver: PushDeliver | null, now = new Date()) {
  const day = tehranDay(now);
  const from = zonedToUtc(day, "00:00");
  const to = zonedToUtc(addDays(day, 1), "00:00");
  const rows = await db
    .select({ s: classSessions, c: classGroups, userId: teachers.userId, reportStatus: sessionReports.status })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .innerJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .leftJoin(sessionReports, eq(sessionReports.sessionId, classSessions.id))
    .where(and(gte(classSessions.endsAt, from), lt(classSessions.endsAt, to), lte(classSessions.endsAt, now), inArray(classSessions.status, ["scheduled", "awaiting_teacher", "held_incomplete"])));
  let nudged = 0;
  for (const row of rows) {
    if (!row.userId) continue;
    if (row.reportStatus === "published" || row.reportStatus === "approved" || row.reportStatus === "pending_approval") continue;
    if (tehranHour(now) > (await hourSetting(db, row.s.tenantId, "eod"))) continue;
    const [recent] = await db
      .select({ id: outboundMessages.id })
      .from(outboundMessages)
      .where(and(eq(outboundMessages.kind, "report_nudge"), eq(outboundMessages.refId, row.s.id), gt(outboundMessages.createdAt, new Date(now.getTime() - 3 * 60 * 60 * 1000))))
      .limit(1);
    if (recent) continue;
    const chats = await db.select().from(messengerAccounts).where(eq(messengerAccounts.userId, row.userId));
    const text = `گزارش کلاس «${row.c.title}» هنوز کامل نشده. تا پایان امروز از پنل دبیر یا همین‌جا ثبتش کنید.`;
    let messageId = "push";
    let channel: BotChannel = "bale";
    let chatId = row.userId;
    for (const ch of chats) {
      const bot = ms[ch.channel as BotChannel];
      if (!bot) continue;
      messageId = await bot.send(ch.chatId, text).catch(() => "");
      if (messageId) {
        channel = ch.channel as BotChannel;
        chatId = ch.chatId;
        break;
      }
    }
    await db.insert(outboundMessages).values({ tenantId: row.s.tenantId, channel, chatId, messageId: messageId || `nudge-${row.s.id}-${now.getTime()}`, kind: "report_nudge", refType: "session", refId: row.s.id });
    if (deliver) await sendPush(db, row.userId, { title: "گزارش کلاس ناقص است", body: row.c.title, url: "/teacher", tag: `report-${row.s.id}` }, deliver);
    nudged++;
  }
  return { nudged };
}

/** Classes that have no linked group yet, for an admin chat. */
export async function listUnlinkedClasses(db: Db, p: { channel: BotChannel; chatId: string }) {
  const [me] = await db
    .select({ userId: messengerAccounts.userId, tenantId: users.tenantId })
    .from(messengerAccounts)
    .innerJoin(users, eq(users.id, messengerAccounts.userId))
    .where(and(eq(messengerAccounts.channel, p.channel), eq(messengerAccounts.chatId, p.chatId)));
  if (!me) return null;
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, me.userId));
  if (!roles.some((r) => r.role === "owner" || r.role === "admin")) return null;
  const classes = await db.select({ id: classGroups.id, title: classGroups.title }).from(classGroups).where(and(eq(classGroups.tenantId, me.tenantId), eq(classGroups.active, true)));
  const links = await db.select({ id: chatLinks.classGroupId }).from(chatLinks).where(eq(chatLinks.tenantId, me.tenantId));
  const linked = new Set(links.map((l) => l.id));
  return classes.filter((c) => !linked.has(c.id)).map((c) => c.title);
}
