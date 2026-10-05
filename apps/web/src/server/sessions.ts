import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import {
  appointmentTypes,
  appointments,
  attendance,
  branches,
  cancellationRequests,
  classGroups,
  classSessions,
  enrollments,
  getDb,
  homework,
  scheduledAnnouncements,
  sessionReports,
  students,
  teachers,
  users,
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
  const [roster, marks, report, hw, announcement, request] = await Promise.all([
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
    db.select().from(cancellationRequests).where(and(eq(cancellationRequests.sessionId, sessionId), eq(cancellationRequests.status, "pending"))),
  ]);
  return {
    ...row,
    roster,
    marks,
    report: report[0] ?? null,
    homework: hw[0] ?? null,
    announcement: announcement.find((a) => a.status !== "canceled") ?? null,
    request: request[0] ?? null,
  };
}

/** 08:00 Tehran on the session's day (when the cancellation notice goes to the class group). */
export const morningOf = (startsAt: Date) => zonedToUtc(tehranDay(startsAt), "08:00");

// ---- dashboard and navigation summaries -----------------------------------------------------------------------

/** Sessions of one calendar day (Tehran), earliest first. */
export async function loadDay(tenantId: string, day: string) {
  const db = getDb();
  const rows = await db
    .select({ s: classSessions, c: classGroups, teacher: teachers.name, branch: branches.name })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .leftJoin(branches, eq(branches.id, classGroups.branchId))
    .where(and(eq(classSessions.tenantId, tenantId), gte(classSessions.startsAt, zonedToUtc(day, "00:00")), lt(classSessions.startsAt, zonedToUtc(addDays(day, 1), "00:00"))))
    .orderBy(asc(classSessions.startsAt));
  return rows;
}

/** Past sessions nobody has answered yet (the last two weeks). */
export async function loadUnanswered(tenantId: string, limit = 8) {
  const now = new Date();
  return getDb()
    .select({ s: classSessions, c: classGroups, teacher: teachers.name })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .where(and(eq(classSessions.tenantId, tenantId), eq(classSessions.status, "scheduled"), lte(classSessions.endsAt, now), gte(classSessions.endsAt, new Date(now.getTime() - 14 * 86_400_000))))
    .orderBy(desc(classSessions.startsAt))
    .limit(limit);
}

/** Teachers' cancellation requests waiting for an admin, for sessions that are still ahead. */
export async function loadPendingRequests(tenantId: string) {
  return getDb()
    .select({ r: cancellationRequests, s: classSessions, c: classGroups, teacher: teachers.name, who: users.fullName })
    .from(cancellationRequests)
    .innerJoin(classSessions, eq(classSessions.id, cancellationRequests.sessionId))
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .leftJoin(users, eq(users.id, cancellationRequests.requestedByUserId))
    .where(and(eq(cancellationRequests.tenantId, tenantId), eq(cancellationRequests.status, "pending"), gte(classSessions.startsAt, new Date())))
    .orderBy(asc(classSessions.startsAt));
}

export async function loadUpcomingBookings(tenantId: string, limit = 5) {
  return getDb()
    .select({ a: appointments, type: appointmentTypes.title })
    .from(appointments)
    .innerJoin(appointmentTypes, eq(appointmentTypes.id, appointments.appointmentTypeId))
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "booked"), gte(appointments.startsAt, new Date())))
    .orderBy(asc(appointments.startsAt))
    .limit(limit);
}

/** Numbers shown as badges in the admin navigation. */
export async function navCounts(tenantId: string) {
  const [requests, waiting] = await Promise.all([loadPendingRequests(tenantId), loadUnanswered(tenantId, 50)]);
  return { requests: requests.length, waiting: waiting.length };
}
