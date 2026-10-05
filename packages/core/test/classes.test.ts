import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attendance, classGroups, classSessions, closeDb, courses, getDb, students, tenants } from "@khaneyeidea/db";
import { classDays, effectiveStatus, sessionTimes, syncClassSessions, zonedToUtc } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

describe("classDays", () => {
  const c = { weekday: 0, startTime: "17:00:00", endTime: "18:30:00", startsOn: "2026-10-01", endsOn: null };
  it("lists the class weekday (Saturday = 0) in range", () => {
    expect(classDays(c, "2026-10-01", "2026-10-20")).toEqual(["2026-10-03", "2026-10-10", "2026-10-17"]);
  });
  it("respects start and end dates", () => {
    expect(classDays({ ...c, startsOn: "2026-10-05", endsOn: "2026-10-12" }, "2026-10-01", "2026-10-31")).toEqual(["2026-10-10"]);
  });
  it("skips fixed holidays", () => {
    // 2026-03-21 (1 Farvardin) is a Saturday
    expect(classDays({ ...c, startsOn: "2026-03-14" }, "2026-03-14", "2026-03-28")).toEqual(["2026-03-14", "2026-03-28"]);
  });
  it("converts to Tehran times", () => {
    const t = sessionTimes(c, "2026-10-03");
    expect(t.startsAt.toISOString()).toBe("2026-10-03T13:30:00.000Z");
    expect(t.endsAt.getTime() - t.startsAt.getTime()).toBe(90 * 60_000);
  });
});

describe("effectiveStatus", () => {
  it("a past scheduled session awaits the teacher", () => {
    const now = new Date("2026-10-03T16:00:00Z");
    expect(effectiveStatus({ status: "scheduled", endsAt: new Date("2026-10-03T15:00:00Z") }, now)).toBe("awaiting_teacher");
    expect(effectiveStatus({ status: "scheduled", endsAt: new Date("2026-10-03T17:00:00Z") }, now)).toBe("scheduled");
    expect(effectiveStatus({ status: "held", endsAt: new Date("2026-10-03T15:00:00Z") }, now)).toBe("held");
  });
});

describe("syncClassSessions", () => {
  let tenantId: string;
  let classId: string;
  const now = new Date("2026-10-01T05:00:00Z");
  beforeAll(async () => {
    const db = getDb();
    const [t] = await db.insert(tenants).values({ slug: `test-cls-${Date.now()}`, name: "t" }).returning();
    tenantId = t!.id;
    const [course] = await db.insert(courses).values({ tenantId, slug: "c", title: { fa: "دوره", en: "c" } }).returning();
    const [g] = await db
      .insert(classGroups)
      .values({ tenantId, courseId: course!.id, title: "رباتیک ۲", weekday: 0, startTime: "17:00", endTime: "18:30", startsOn: "2026-10-01", endsOn: "2026-11-30" })
      .returning();
    classId = g!.id;
  });
  afterAll(async () => {
    await getDb().delete(tenants).where(eq(tenants.id, tenantId));
    await closeDb();
  });

  it("creates the weekly sessions up to the end date", async () => {
    const r = await syncClassSessions(getDb(), tenantId, classId, now);
    expect(r.added).toBe(9); // Saturdays Oct 3 .. Nov 28
    expect((await syncClassSessions(getDb(), tenantId, classId, now)).added).toBe(0); // idempotent
  });

  it("moves untouched sessions when the schedule changes, keeps ones with attendance", async () => {
    const db = getDb();
    const first = zonedToUtc("2026-10-03", "17:00");
    const [s] = await db.select().from(classSessions).where(eq(classSessions.startsAt, first));
    const [kid] = await db.insert(students).values({ tenantId, firstName: "آوا", lastName: "-" }).returning();
    await db.insert(attendance).values({ sessionId: s!.id, studentId: kid!.id, status: "present" });
    await db.update(classGroups).set({ weekday: 2, startTime: "16:00", endTime: "17:30" }).where(eq(classGroups.id, classId));
    const r = await syncClassSessions(db, tenantId, classId, now);
    expect(r.removed).toBe(8); // all Saturdays except the one with attendance
    expect(r.added).toBe(9); // Mondays Oct 5 .. Nov 30
    const kept = await db.select().from(classSessions).where(eq(classSessions.id, s!.id));
    expect(kept).toHaveLength(1);
  });

  it("an inactive class has no future sessions", async () => {
    const db = getDb();
    await db.update(classGroups).set({ active: false }).where(eq(classGroups.id, classId));
    await syncClassSessions(db, tenantId, classId, now);
    const left = await db.select().from(classSessions).where(eq(classSessions.classGroupId, classId));
    expect(left).toHaveLength(1); // only the one with attendance
  });
});
