import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  attendance,
  chatLinks,
  classGroups,
  classSessions,
  closeDb,
  courses,
  enrollments,
  getDb,
  guardians,
  homework,
  messengerAccounts,
  scheduledAnnouncements,
  sessionCheckins,
  sessionReports,
  students,
  teachers,
  tenants,
  userRoles,
  users,
} from "@khaneyeidea/db";
import {
  askDueCheckins,
  cancelPlanned,
  classScheduleConflicts,
  createLinkCode,
  createMakeup,
  deleteExtraSession,
  handleCallback,
  handleText,
  redeemClassCode,
  redeemUserCode,
  remindPending,
  rescheduleSession,
  sendDueAnnouncements,
  sessionConflicts,
  syncClassSessions,
  type Button,
  type Messenger,
  type Messengers,
} from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

// A fake Bale/Telegram: records what was sent, edited and deleted.
function fake(channel: "bale" | "telegram", opts: { canDelete?: boolean } = {}) {
  const log: { op: string; chatId: string; id: string; text?: string; buttons?: Button[][] }[] = [];
  let n = 0;
  const m: Messenger = {
    channel,
    async send(chatId, text, buttons) {
      const id = `${channel}-${++n}`;
      log.push({ op: "send", chatId, id, text, buttons });
      return id;
    },
    async edit(chatId, id, text, buttons) {
      log.push({ op: "edit", chatId, id, text, buttons });
    },
    async remove(chatId, id) {
      if (opts.canDelete === false) return false;
      log.push({ op: "remove", chatId, id });
      return true;
    },
  };
  return { m, log };
}

describe("post-class follow-up", () => {
  const db = getDb();
  let tenantId = "";
  let classId = "";
  let teacherUserId = "";
  let adminUserId = "";
  let parentUserId = "";
  let kids: { id: string; firstName: string }[] = [];
  let sessionId = "";
  const now = new Date();
  const ended = new Date(now.getTime() - 30 * 60_000); // ended half an hour ago

  beforeAll(async () => {
    const [t] = await db.insert(tenants).values({ slug: `test-fu-${Date.now()}`, name: "t" }).returning();
    tenantId = t!.id;
    const mk = async (phone: string, role: "teacher" | "admin" | "parent") => {
      const [u] = await db.insert(users).values({ tenantId, phone, fullName: role }).returning();
      await db.insert(userRoles).values({ userId: u!.id, role });
      return u!.id;
    };
    teacherUserId = await mk("989120000901", "teacher");
    adminUserId = await mk("989120000902", "admin");
    parentUserId = await mk("989120000903", "parent");
    const [course] = await db.insert(courses).values({ tenantId, slug: "c", title: { fa: "دوره", en: "c" } }).returning();
    const [teacher] = await db.insert(teachers).values({ tenantId, userId: teacherUserId, name: { fa: "معلم", en: "T" } }).returning();
    const [g] = await db
      .insert(classGroups)
      .values({ tenantId, courseId: course!.id, teacherId: teacher!.id, title: "رباتیک ۲", weekday: 0, startTime: "17:00", endTime: "18:30", startsOn: "2026-01-01" })
      .returning();
    classId = g!.id;
    kids = await db
      .insert(students)
      .values([{ tenantId, firstName: "آوا", lastName: "x" }, { tenantId, firstName: "کیان", lastName: "x" }, { tenantId, firstName: "نیلا", lastName: "x" }])
      .returning({ id: students.id, firstName: students.firstName });
    await db.insert(enrollments).values(kids.map((k) => ({ tenantId, classGroupId: classId, studentId: k.id })));
    await db.insert(guardians).values({ studentId: kids.find((k) => k.firstName === "کیان")!.id, userId: parentUserId });
    const [s] = await db
      .insert(classSessions)
      .values({ tenantId, classGroupId: classId, teacherId: teacher!.id, startsAt: new Date(ended.getTime() - 90 * 60_000), endsAt: ended })
      .returning();
    sessionId = s!.id;
  });
  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  const bale = fake("bale");
  const tg = fake("telegram", { canDelete: false });
  const ms: Messengers = { bale: bale.m, telegram: tg.m };
  const press = (channel: "bale" | "telegram", chatId: string, data: string) =>
    handleCallback(db, ms, { channel, chatId, messageId: "m", data });

  it("a link code connects a teacher's chat (once, and not after it expires)", async () => {
    const { code } = await createLinkCode(db, tenantId, "user", teacherUserId);
    expect((await redeemUserCode(db, { code: "000000", channel: "bale", chatId: "T-bale" })).ok).toBe(false);
    expect((await redeemUserCode(db, { code, channel: "bale", chatId: "T-bale", username: "teach" })).ok).toBe(true);
    expect((await redeemUserCode(db, { code, channel: "bale", chatId: "other" })).ok).toBe(false); // used
    const old = await createLinkCode(db, tenantId, "user", teacherUserId, new Date(Date.now() - 3 * 3_600_000));
    expect((await redeemUserCode(db, { code: old.code, channel: "telegram", chatId: "x" })).ok).toBe(false); // expired
    const c2 = await createLinkCode(db, tenantId, "user", teacherUserId);
    await redeemUserCode(db, { code: c2.code, channel: "telegram", chatId: "T-tg" });
    const mine = await db.select().from(messengerAccounts).where(eq(messengerAccounts.userId, teacherUserId));
    expect(mine.map((m) => m.channel).sort()).toEqual(["bale", "telegram"]);
    // admin and parent chats
    for (const [uid, chat] of [[adminUserId, "A-bale"], [parentUserId, "P-bale"]] as const) {
      const c = await createLinkCode(db, tenantId, "user", uid);
      await redeemUserCode(db, { code: c.code, channel: "bale", chatId: chat });
    }
  });

  it("a class code links a group; relinking replaces it", async () => {
    const c = await createLinkCode(db, tenantId, "class", classId);
    const r = await redeemClassCode(db, { code: c.code, channel: "bale", chatId: "G-bale" });
    expect(r.ok && r.title).toBe("رباتیک ۲");
    const c2 = await createLinkCode(db, tenantId, "class", classId);
    await redeemClassCode(db, { code: c2.code, channel: "bale", chatId: "G-bale-2" });
    const links = await db.select().from(chatLinks).where(eq(chatLinks.classGroupId, classId));
    expect(links).toHaveLength(1);
    expect(links[0]!.chatId).toBe("G-bale-2");
  });

  it("asks the teacher in both channels, once", async () => {
    expect((await askDueCheckins(db, ms, now)).asked).toBe(1);
    expect((await askDueCheckins(db, ms, now)).asked).toBe(0);
    expect(bale.log.filter((l) => l.op === "send" && l.chatId === "T-bale")).toHaveLength(1);
    expect(tg.log.filter((l) => l.op === "send" && l.chatId === "T-tg")).toHaveLength(1);
  });

  it("does not ask before ten minutes have passed", async () => {
    const [late] = await db
      .insert(classSessions)
      .values({ tenantId, classGroupId: classId, teacherId: (await db.select().from(teachers).where(eq(teachers.tenantId, tenantId)))[0]!.id, startsAt: new Date(now.getTime() - 60 * 60_000), endsAt: new Date(now.getTime() - 3 * 60_000) })
      .returning();
    expect((await askDueCheckins(db, ms, now)).asked).toBe(0);
    await db.delete(classSessions).where(eq(classSessions.id, late!.id));
  });

  it("the first channel to answer wins; the other prompt is edited when it cannot be deleted", async () => {
    await press("bale", "T-bale", `h:${sessionId}`);
    const r = await press("telegram", "T-tg", `h:${sessionId}`);
    expect(r.toast).toMatch(/بله/);
    expect(tg.log.some((l) => l.op === "edit" && /در بله پاسخ داده شد/.test(l.text ?? ""))).toBe(true);
    const [k] = await db.select().from(sessionCheckins).where(eq(sessionCheckins.sessionId, sessionId));
    expect(k!.answeredChannel).toBe("bale");
    expect(k!.step).toBe("attendance");
  });

  it("other people cannot answer for the teacher", async () => {
    const r = await press("bale", "P-bale", `a:${sessionId}`);
    expect(r.toast).toMatch(/برای شما نیست/);
  });

  it("attendance, report, homework, preview and send", async () => {
    const att = bale.log.filter((l) => l.op === "edit").at(-1)!;
    expect(att.text).toMatch(/حضور و غیاب/);
    // mark کیان absent: find its button in the keyboard (the roster order is the database's)
    const idx = att.buttons!.flat().find((b) => b.text.includes("کیان"))!.data;
    await press("bale", "T-bale", idx);
    await press("bale", "T-bale", `a:${sessionId}`);
    expect(await handleText(db, ms, { channel: "bale", chatId: "T-bale", text: "ساخت ربات مسیریاب" })).toBe(true);
    expect(await handleText(db, ms, { channel: "telegram", chatId: "T-tg", text: "should be ignored" })).toBe(false);
    expect(await handleText(db, ms, { channel: "bale", chatId: "T-bale", text: "تکمیل پروژه" })).toBe(true);
    const preview = bale.log.filter((l) => l.op === "send" && l.chatId === "T-bale").at(-1)!;
    expect(preview.text).toMatch(/پیش‌نمایش/);
    await press("bale", "T-bale", `f:${sessionId}`);
    await press("bale", "T-bale", `f:${sessionId}`); // a second press changes nothing

    const [s] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId));
    expect(s!.status).toBe("held");
    const marks = await db.select().from(attendance).where(eq(attendance.sessionId, sessionId));
    expect(marks.find((m) => m.studentId === kids[1]!.id)!.status).toBe("absent");
    expect(marks.filter((m) => m.status === "present")).toHaveLength(2);
    expect((await db.select().from(sessionReports).where(eq(sessionReports.sessionId, sessionId)))[0]!.summary).toBe("ساخت ربات مسیریاب");
    expect((await db.select().from(homework).where(eq(homework.sessionId, sessionId)))[0]!.text).toBe("تکمیل پروژه");

    // the group got the report, with no student names; the absent child's parent was told privately
    const group = bale.log.filter((l) => l.op === "send" && l.chatId === "G-bale-2");
    expect(group).toHaveLength(1);
    expect(group[0]!.text).toMatch(/ساخت ربات مسیریاب/);
    for (const k of kids) expect(group[0]!.text).not.toContain(k.firstName);
    const parent = bale.log.filter((l) => l.op === "send" && l.chatId === "P-bale");
    expect(parent).toHaveLength(1);
    expect(parent[0]!.text).toContain("کیان");
  });

  it("not held: reason, makeup, and the admin is told", async () => {
    const teacher = (await db.select().from(teachers).where(eq(teachers.tenantId, tenantId)))[0]!;
    const [s2] = await db
      .insert(classSessions)
      .values({ tenantId, classGroupId: classId, teacherId: teacher.id, startsAt: new Date(now.getTime() - 4 * 3_600_000), endsAt: new Date(now.getTime() - 3 * 3_600_000) })
      .returning();
    await askDueCheckins(db, { bale: bale.m }, now);
    await press("bale", "T-bale", `n:${s2!.id}`);
    await press("bale", "T-bale", `r:${s2!.id}:1`); // holiday
    await press("bale", "T-bale", `m:${s2!.id}:y`);
    const [row] = await db.select().from(classSessions).where(eq(classSessions.id, s2!.id));
    expect(row!.status).toBe("needs_makeup");
    expect(row!.notHeldReason).toBe("holiday");
    expect(bale.log.some((l) => l.op === "send" && l.chatId === "A-bale" && /برگزار نشد/.test(l.text ?? ""))).toBe(true);
  });

  it("an unanswered session reminds after two hours and tells the admin after 21:00", async () => {
    const teacher = (await db.select().from(teachers).where(eq(teachers.tenantId, tenantId)))[0]!;
    const [s3] = await db
      .insert(classSessions)
      .values({ tenantId, classGroupId: classId, teacherId: teacher.id, startsAt: new Date(now.getTime() - 9 * 3_600_000), endsAt: new Date(now.getTime() - 8 * 3_600_000) })
      .returning();
    await askDueCheckins(db, { bale: bale.m }, now);
    const later = new Date(now.getTime() + 3 * 3_600_000);
    const r1 = await remindPending(db, { bale: bale.m }, later);
    expect(r1.reminded).toBeGreaterThanOrEqual(1);
    const far = new Date(now.getTime() + 40 * 3_600_000);
    const r2 = await remindPending(db, { bale: bale.m }, far);
    expect(r1.escalated + r2.escalated).toBeGreaterThanOrEqual(1);
    expect((await remindPending(db, { bale: bale.m }, far)).escalated).toBe(0);
    await db.delete(classSessions).where(eq(classSessions.id, s3!.id));
  });

  it("a planned cancellation is sent once, at its time", async () => {
    const teacher = (await db.select().from(teachers).where(eq(teachers.tenantId, tenantId)))[0]!;
    const future = new Date(now.getTime() + 2 * 86_400_000);
    const [s4] = await db
      .insert(classSessions)
      .values({ tenantId, classGroupId: classId, teacherId: teacher.id, startsAt: future, endsAt: new Date(future.getTime() + 5_400_000) })
      .returning();
    await cancelPlanned(db, { tenantId, sessionId: s4!.id, userId: adminUserId, reason: "بیماری", message: "کلاس این هفته برگزار نمی‌شود.", sendAt: new Date(now.getTime() + 3_600_000), toParents: false });
    expect((await sendDueAnnouncements(db, ms, now)).sent).toBe(0); // not yet
    const at = new Date(now.getTime() + 2 * 3_600_000);
    const r = await sendDueAnnouncements(db, ms, at);
    expect(r.sent).toBe(1);
    expect((await sendDueAnnouncements(db, ms, at)).sent).toBe(0);
    expect(bale.log.some((l) => l.op === "send" && l.chatId === "G-bale-2" && /برگزار نمی‌شود/.test(l.text ?? ""))).toBe(true);
  });

  it("a notice with nowhere to go is marked failed", async () => {
    const [s5] = await db
      .insert(classSessions)
      .values({ tenantId, classGroupId: classId, startsAt: new Date(now.getTime() + 5 * 86_400_000), endsAt: new Date(now.getTime() + 5 * 86_400_000 + 5_400_000) })
      .returning();
    await cancelPlanned(db, { tenantId, sessionId: s5!.id, userId: adminUserId, reason: null, message: "x", sendAt: now, toParents: false });
    const r = await sendDueAnnouncements(db, {}, new Date(now.getTime() + 1000)); // no bot running
    expect(r.failed).toBe(1);
    const [a] = await db.select().from(scheduledAnnouncements).where(and(eq(scheduledAnnouncements.sessionId, s5!.id)));
    expect(a!.status).toBe("failed");
  });
});

describe("session operations", () => {
  const db = getDb();
  let tenantId = "";
  let classId = "";
  let otherClassId = "";
  let teacherId = "";
  let roomId = "";
  const now = new Date("2026-10-01T05:00:00Z");

  beforeAll(async () => {
    const [t] = await db.insert(tenants).values({ slug: `test-ops-${Date.now()}`, name: "t" }).returning();
    tenantId = t!.id;
    const [course] = await db.insert(courses).values({ tenantId, slug: "c", title: { fa: "دوره", en: "c" } }).returning();
    const [te] = await db.insert(teachers).values({ tenantId, name: { fa: "م", en: "T" } }).returning();
    teacherId = te!.id;
    const base = { tenantId, courseId: course!.id, weekday: 0, startsOn: "2026-10-01", teacherId };
    const [a] = await db.insert(classGroups).values({ ...base, title: "A", startTime: "16:00", endTime: "17:30" }).returning();
    const [b] = await db.insert(classGroups).values({ ...base, title: "B", startTime: "19:00", endTime: "20:00" }).returning();
    classId = a!.id;
    otherClassId = b!.id;
    void roomId;
    await syncClassSessions(db, tenantId, classId, now);
    await syncClassSessions(db, tenantId, otherClassId, now);
  });
  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it("flags a teacher teaching two classes at once in the class form", async () => {
    const c = { teacherId, roomId: null, weekday: 0, startTime: "17:00", endTime: "18:00", startsOn: "2026-10-01", endsOn: null };
    const hit = await classScheduleConflicts(db, tenantId, c);
    expect(hit.map((x) => x.title)).toEqual(["A"]);
    expect(await classScheduleConflicts(db, tenantId, { ...c, startTime: "17:30", endTime: "18:30" })).toHaveLength(0); // touching ends are fine
    expect(await classScheduleConflicts(db, tenantId, { ...c, id: classId })).toHaveLength(0); // the class itself is excluded
  });

  it("moving one session keeps it through a schedule sync and does not re-create the old slot", async () => {
    const [s] = await db.select().from(classSessions).where(eq(classSessions.classGroupId, classId)).orderBy(classSessions.startsAt).limit(1);
    const target = new Date(s!.startsAt.getTime() + 2 * 86_400_000);
    const res = await rescheduleSession(db, { sessionId: s!.id, startsAt: target, endsAt: new Date(target.getTime() + 5_400_000), now });
    expect(res.ok).toBe(true);
    const sync = await syncClassSessions(db, tenantId, classId, now);
    expect(sync).toEqual({ added: 0, removed: 0 });
    const [moved] = await db.select().from(classSessions).where(eq(classSessions.id, s!.id));
    expect(moved!.custom).toBe(true);
    expect(moved!.originalStartsAt!.getTime()).toBe(s!.startsAt.getTime());
    // a past or recorded session cannot be moved
    expect((await rescheduleSession(db, { sessionId: s!.id, startsAt: new Date(now.getTime() - 1000), endsAt: now, now })).ok).toBe(false);
  });

  it("detects session clashes and creates a makeup that syncing keeps", async () => {
    const [b] = await db.select().from(classSessions).where(eq(classSessions.classGroupId, otherClassId)).orderBy(classSessions.startsAt).limit(1);
    const clash = await sessionConflicts(db, tenantId, { classGroupId: classId, teacherId, startsAt: b!.startsAt, endsAt: b!.endsAt });
    expect(clash[0]?.kind).toBe("teacher");
    const at = new Date(now.getTime() + 20 * 86_400_000 + 3 * 3_600_000 + 17 * 60_000); // off the weekly pattern
    const mk = await createMakeup(db, { tenantId, classGroupId: classId, startsAt: at, endsAt: new Date(at.getTime() + 5_400_000), now });
    expect(mk.ok).toBe(true);
    const again = await createMakeup(db, { tenantId, classGroupId: classId, startsAt: at, endsAt: new Date(at.getTime() + 5_400_000), now });
    expect(again).toEqual({ ok: false, error: "slot_taken" });
    const sync = await syncClassSessions(db, tenantId, classId, now);
    expect(sync.removed).toBe(0);
  });

  it("deleting an extra session removes only that session", async () => {
    const before = await db.select({ id: classSessions.id }).from(classSessions).where(eq(classSessions.tenantId, tenantId));
    const [extra] = await db.select().from(classSessions).where(and(eq(classSessions.tenantId, tenantId), eq(classSessions.custom, true), isNull(classSessions.originalStartsAt)));
    const [regular] = await db.select().from(classSessions).where(and(eq(classSessions.tenantId, tenantId), eq(classSessions.custom, false)));
    expect(await deleteExtraSession(db, { tenantId, sessionId: regular!.id })).toBe(false); // weekly sessions are never deleted here
    expect(await deleteExtraSession(db, { tenantId: "00000000-0000-0000-0000-000000000000", sessionId: extra!.id })).toBe(false); // other tenants neither
    expect(await deleteExtraSession(db, { tenantId, sessionId: extra!.id })).toBe(true);
    const after = await db.select({ id: classSessions.id }).from(classSessions).where(eq(classSessions.tenantId, tenantId));
    expect(after).toHaveLength(before.length - 1); // nothing else went with it
  });
});

afterAll(async () => {
  await closeDb();
});
