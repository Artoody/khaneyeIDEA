import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chatLinks, classGroups, classSessions, closeDb, courses, getDb, groupMentions, messengerAccounts, scheduledAnnouncements, siteSettings, teachers, tenants, userRoles, users } from "@khaneyeidea/db";
import { ingestGroupMessage, remindOpenMentions, saveSessionWork, sendEveNotices, type Messenger } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const silent: Messenger = { channel: "bale", async send() { return "m"; }, async edit() {}, async remove() { return true; } };

describe("group questions, evening notice and report gate", () => {
  const db = getDb();
  let tenantId = "";
  let classId = "";
  let teacherId = "";
  let sessionId = "";

  beforeAll(async () => {
    const [t] = await db.insert(tenants).values({ slug: `gw-${Date.now()}`, name: "gw" }).returning();
    tenantId = t!.id;
    const [user] = await db.insert(users).values({ tenantId, phone: `989${String(Date.now()).slice(-9)}`, username: "coach" }).returning();
    await db.insert(userRoles).values({ userId: user!.id, role: "teacher" });
    await db.insert(messengerAccounts).values({ userId: user!.id, channel: "bale", chatId: "T1" });
    const [course] = await db.insert(courses).values({ tenantId, slug: `c-${Date.now()}`, title: { fa: "دوره", en: "c" } }).returning();
    const [teacher] = await db.insert(teachers).values({ tenantId, userId: user!.id, name: { fa: "استاد راد", en: "Rad" }, meetingUrl: "https://meet.example/rad" }).returning();
    teacherId = teacher!.id;
    const [g] = await db
      .insert(classGroups)
      .values({ tenantId, courseId: course!.id, teacherId, title: "رباتیک", weekday: 0, startTime: "17:00", endTime: "18:30", startsOn: "2026-01-01", onlineUrl: "https://class.example/1" })
      .returning();
    classId = g!.id;
    await db.insert(chatLinks).values({ tenantId, classGroupId: classId, channel: "bale", chatId: "G1" });
    const [s] = await db.insert(classSessions).values({ tenantId, classGroupId: classId, teacherId, startsAt: new Date(), endsAt: new Date(Date.now() + 3600_000) }).returning();
    sessionId = s!.id;
    await db.insert(siteSettings).values({
      tenantId,
      name: { fa: "خ", en: "h" },
      tagline: { fa: "ت", en: "t" },
      reportApprovalRequired: true,
      eveNoticeHour: Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", hour: "2-digit", hourCycle: "h23" }).format(new Date())) % 24,
    });
  });
  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await closeDb();
  });

  it("opens a mention when the teacher is named and closes it when they reply", async () => {
    const tagged = await ingestGroupMessage(db, { channel: "bale", chatId: "G1", messageId: "1", fromId: "parent", text: "استاد راد فردا تکلیف چیست؟" });
    expect(tagged.tagged).toBe(true);
    const answer = await ingestGroupMessage(db, { channel: "bale", chatId: "G1", messageId: "2", fromId: "T1", text: "جواب می‌دهم" });
    expect(answer.tagged).toBe(false);
    const [open] = await db.select().from(groupMentions).where(eq(groupMentions.messageId, "1"));
    expect(open?.answeredAt).toBeTruthy();
  });

  it("does not remind before a day has passed", async () => {
    await db.insert(groupMentions).values({ tenantId, channel: "bale", chatId: "G1", messageId: "9", teacherId, snippet: "سوال", askedAt: new Date() }).onConflictDoNothing();
    const r = await remindOpenMentions(db, { bale: silent }, null, new Date());
    expect(r.reminded).toBe(0);
  });

  it("reminds once a question is a day old", async () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db.insert(groupMentions).values({ tenantId, channel: "bale", chatId: "G1", messageId: "8", teacherId, snippet: "سوال قدیمی", askedAt: old });
    const r = await remindOpenMentions(db, { bale: silent }, null, new Date());
    expect(r.reminded).toBe(1);
    const again = await remindOpenMentions(db, { bale: silent }, null, new Date());
    expect(again.reminded).toBe(0);
  });

  it("holds a report for admin approval when the setting is on", async () => {
    const gate = await saveSessionWork(db, { tenantId, sessionId, userId: null, channel: "web", marks: {}, summary: "مدار بستیم", homework: null });
    expect(gate).toBe("pending");
  });

  it("queues tomorrow's class notice once, and skips it when an admin already wrote one", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [s] = await db.insert(classSessions).values({ tenantId, classGroupId: classId, teacherId, startsAt: tomorrow, endsAt: new Date(tomorrow.getTime() + 3600_000) }).returning();
    const first = await sendEveNotices(db, { bale: silent }, new Date());
    const second = await sendEveNotices(db, { bale: silent }, new Date());
    expect(first.queued).toBeGreaterThanOrEqual(1);
    expect(second.queued).toBe(0);
    await db.insert(scheduledAnnouncements).values({
      tenantId,
      sessionId: s!.id,
      text: "این هفته کلاس نیست",
      sendAt: new Date(),
      targets: { group: true, parents: false, kind: "notice" },
      status: "scheduled",
    });
    const later = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);
    await db.insert(classSessions).values({ tenantId, classGroupId: classId, teacherId, startsAt: later, endsAt: new Date(later.getTime() + 3600_000) });
    const after = await sendEveNotices(db, { bale: silent }, new Date());
    expect(after.queued).toBe(0);
  });
});
