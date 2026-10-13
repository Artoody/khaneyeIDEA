import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  attendance,
  classGroups,
  classSessions,
  closeDb,
  courses,
  enrollments,
  getDb,
  homework,
  sessionReports,
  students,
  tenants,
} from "@khaneyeidea/db";
import { countTermSessionsUsed, effectiveTermStart, getEnrollmentTermDetail, getStudentHistory, sessionTimes } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

describe("enrollment session packages", () => {
  let tenantId: string;
  let classId: string;
  let studentId: string;
  let enrollmentId: string;

  beforeAll(async () => {
    const db = getDb();
    const [t] = await db.insert(tenants).values({ slug: `test-pkg-${Date.now()}`, name: "pkg" }).returning();
    tenantId = t!.id;
    const [course] = await db.insert(courses).values({ tenantId, slug: "c", title: { fa: "دوره", en: "c" } }).returning();
    const [g] = await db
      .insert(classGroups)
      .values({
        tenantId,
        courseId: course!.id,
        title: "پکیج تست",
        weekday: 0,
        startTime: "17:00",
        endTime: "18:00",
        startsOn: "2026-09-01",
        endsOn: "2026-12-01",
      })
      .returning();
    classId = g!.id;
    const [kid] = await db.insert(students).values({ tenantId, firstName: "آوا", lastName: "تست" }).returning();
    studentId = kid!.id;

    // three Saturdays as held; one before term start should not count
    for (const day of ["2026-09-26", "2026-10-03", "2026-10-10", "2026-10-17"]) {
      const t = sessionTimes({ weekday: 0, startTime: "17:00:00", endTime: "18:00:00", startsOn: "2026-09-01", endsOn: null }, day);
      await db.insert(classSessions).values({
        tenantId,
        classGroupId: classId,
        startsAt: t.startsAt,
        endsAt: t.endsAt,
        status: "held",
      });
    }

    const [e] = await db
      .insert(enrollments)
      .values({
        tenantId,
        classGroupId: classId,
        studentId,
        status: "active",
        startedOn: "2026-10-01",
        termStartedOn: "2026-10-01",
        plannedSessions: 6,
        endedOn: null,
      })
      .returning();
    enrollmentId = e!.id;
  });

  afterAll(async () => {
    await getDb().delete(tenants).where(eq(tenants.id, tenantId));
    await closeDb();
  });

  it("effectiveTermStart prefers termStartedOn then startedOn", () => {
    expect(effectiveTermStart({ termStartedOn: "2026-10-05", startedOn: "2026-09-01", createdAt: new Date("2026-08-01") })).toBe("2026-10-05");
    expect(effectiveTermStart({ termStartedOn: null, startedOn: "2026-09-01", createdAt: new Date("2026-08-01") })).toBe("2026-09-01");
  });

  it("counts held sessions from term start (absence still burns a slot)", async () => {
    const used = await countTermSessionsUsed(getDb(), { classGroupId: classId, termStartedOn: "2026-10-01" });
    // Oct 3, 10, 17 — not Sep 26
    expect(used).toBe(3);
  });

  it("respects endedOn upper bound", async () => {
    const used = await countTermSessionsUsed(getDb(), {
      classGroupId: classId,
      termStartedOn: "2026-10-01",
      endedOn: "2026-10-10",
    });
    expect(used).toBe(2);
  });

  it("getStudentHistory exposes package progress and termComplete", async () => {
    const h = await getStudentHistory(getDb(), { tenantId, studentId });
    expect(h.current).toHaveLength(1);
    const cur = h.current[0]!;
    expect(cur.enrollmentId).toBe(enrollmentId);
    expect(cur.plannedSessions).toBe(6);
    expect(cur.sessionsUsed).toBe(3);
    expect(cur.sessionsRemaining).toBe(3);
    expect(cur.termComplete).toBe(false);

    await getDb().update(enrollments).set({ plannedSessions: 3 }).where(eq(enrollments.id, enrollmentId));
    const done = await getStudentHistory(getDb(), { tenantId, studentId });
    expect(done.current[0]!.termComplete).toBe(true);
    expect(done.current[0]!.sessionsRemaining).toBe(0);
  });

  it("getEnrollmentTermDetail lists package-window sessions with attendance and report", async () => {
    const db = getDb();
    const sess = await db.select().from(classSessions).where(eq(classSessions.classGroupId, classId));
    const inTerm = sess.filter((s) => s.startsAt >= new Date("2026-10-01T00:00:00+03:30"));
    expect(inTerm.length).toBeGreaterThanOrEqual(2);
    const present = inTerm[0]!;
    const absent = inTerm[1]!;
    await db.insert(attendance).values([
      { sessionId: present.id, studentId, status: "present", activityScore: 4, homeworkScore: 2, note: "خوب کار کرد" },
      { sessionId: absent.id, studentId, status: "absent" },
    ]);
    await db.insert(sessionReports).values({
      sessionId: present.id,
      summary: "کار با سنسورها",
      status: "published",
    });
    await db.insert(homework).values({ sessionId: present.id, text: "تمرین سنسور در خانه" });

    const detail = await getEnrollmentTermDetail(db, { tenantId, studentId, enrollmentId });
    expect(detail).not.toBeNull();
    // Sep 26 is before term start — only Oct sessions
    expect(detail!.sessions.every((s) => s.startsAt >= new Date("2026-10-01T00:00:00+03:30"))).toBe(true);
    expect(detail!.item.present).toBe(1);
    expect(detail!.item.absent).toBe(1);
    expect(detail!.item.avgActivity).toBe(4);

    const row = detail!.sessions.find((s) => s.sessionId === present.id)!;
    expect(row.attendanceStatus).toBe("present");
    expect(row.activityScore).toBe(4);
    expect(row.note).toBe("خوب کار کرد");
    expect(row.reportSummary).toBe("کار با سنسورها");
    expect(row.homeworkText).toBe("تمرین سنسور در خانه");
  });
});
