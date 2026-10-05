import "server-only";
import { and, asc, count, eq, gte, inArray, lt } from "drizzle-orm";
import {
  attendance,
  branches,
  classGroups,
  classSessions,
  enrollments,
  getDb,
  homework,
  scheduledAnnouncements,
  sessionReports,
  students,
  teachers,
} from "@khaneyeidea/db";
import { addDays, can, ForbiddenError, tehranDay, weekdaySat0, zonedToUtc, type SessionUser } from "@khaneyeidea/core";
import { getUser } from "./auth";

// Session board and session detail: shared by the admin board and the teacher panel.

/** Saturday (Iranian week start) of the week containing `day`. */
export const weekStart = (day: string) => addDays(day, -weekdaySat0(day));

export type BoardFilters = { teacherId?: string | null; branchId?: string | null };

export async function loadWeek(tenantId: string, start: string, f: BoardFilters = {}, onlyTeacherId?: string) {
  const db = getDb();
  const from = zonedToUtc(start, "00:00");
  const to = zonedToUtc(addDays(start, 7), "00:00");
  const teacherFilter = onlyTeacherId ?? f.teacherId ?? null;
  const rows = await db
    .select({ s: classSessions, c: classGroups, teacher: teachers.name, branch: branches.name })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .leftJoin(branches, eq(branches.id, classGroups.branchId))
    .where(
      and(
        eq(classSessions.tenantId, tenantId),
        gte(classSessions.startsAt, from),
        lt(classSessions.startsAt, to),
        teacherFilter ? eq(classSessions.teacherId, teacherFilter) : undefined,
        f.branchId ? eq(classGroups.branchId, f.branchId) : undefined,
      ),
    )
    .orderBy(asc(classSessions.startsAt));
  const classIds = [...new Set(rows.map((r) => r.c.id))];
  const counts = classIds.length
    ? await db
        .select({ id: enrollments.classGroupId, n: count() })
        .from(enrollments)
        .where(and(inArray(enrollments.classGroupId, classIds), eq(enrollments.status, "active")))
        .groupBy(enrollments.classGroupId)
    : [];
  const n = new Map(counts.map((c) => [c.id, c.n]));
  return rows.map((r) => ({ ...r, students: n.get(r.c.id) ?? 0, day: tehranDay(r.s.startsAt) }));
}

/** The signed-in user may work on this session: schedulers, or the teacher who teaches it. */
export async function sessionAccess(sessionId: string): Promise<{ user: SessionUser; session: typeof classSessions.$inferSelect; asTeacher: boolean }> {
  const user = await getUser();
  if (!user) throw new ForbiddenError("session.report_own");
  const [row] = await getDb()
    .select({ s: classSessions, teacherUser: teachers.userId })
    .from(classSessions)
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .where(and(eq(classSessions.id, sessionId), eq(classSessions.tenantId, user.tenantId)));
  if (!row) throw new ForbiddenError("session.report_own");
  if (can(user, "schedule.manage")) return { user, session: row.s, asTeacher: false };
  if (can(user, "session.report_own") && row.teacherUser === user.userId) return { user, session: row.s, asTeacher: true };
  throw new ForbiddenError("session.report_own");
}

export async function loadSessionDetail(sessionId: string) {
  const db = getDb();
  const [row] = await db
    .select({ s: classSessions, c: classGroups, teacher: teachers.name, branch: branches.name })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .leftJoin(branches, eq(branches.id, classGroups.branchId))
    .where(eq(classSessions.id, sessionId));
  if (!row) return null;
  const [roster, marks, report, hw, announcement] = await Promise.all([
    db
      .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .where(and(eq(enrollments.classGroupId, row.c.id), eq(enrollments.status, "active")))
      .orderBy(asc(students.firstName)),
    db.select().from(attendance).where(eq(attendance.sessionId, sessionId)),
    db.select().from(sessionReports).where(eq(sessionReports.sessionId, sessionId)),
    db.select().from(homework).where(eq(homework.sessionId, sessionId)),
    db.select().from(scheduledAnnouncements).where(eq(scheduledAnnouncements.sessionId, sessionId)),
  ]);
  return { ...row, roster, marks, report: report[0] ?? null, homework: hw[0] ?? null, announcement: announcement.find((a) => a.status !== "canceled") ?? null };
}

/** 08:00 Tehran on the session's day (when the cancellation notice goes to the class group). */
export const morningOf = (startsAt: Date) => zonedToUtc(tehranDay(startsAt), "08:00");
