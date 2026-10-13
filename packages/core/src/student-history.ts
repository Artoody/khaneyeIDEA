import { and, asc, avg, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  attendance,
  classGroups,
  classSessions,
  courses,
  enrollments,
  homework,
  sessionReports,
  teachers,
  terms,
  type getDb,
} from "@khaneyeidea/db";
import type { Localized } from "@khaneyeidea/db/schema";

type Db = ReturnType<typeof getDb>;

const OPEN = ["active", "waitlist", "paused"] as const;
const PAST = ["finished", "dropped"] as const;

export type StudentHistoryItem = {
  enrollmentId: string;
  status: (typeof enrollments.$inferSelect)["status"];
  startedOn: string | null;
  endedOn: string | null;
  classGroupId: string;
  classTitle: string;
  courseTitle: Localized | null;
  teacherName: Localized | null;
  termId: string | null;
  termName: Localized | null;
  sessionsHeld: number;
  present: number;
  absent: number;
  avgActivity: number | null;
  avgHomework: number | null;
  plannedSessions: number;
  termStartedOn: string | null;
  sessionsUsed: number;
  sessionsRemaining: number;
  termComplete: boolean;
};

export type StudentHistory = {
  current: StudentHistoryItem[];
  past: StudentHistoryItem[];
  termsSummary: { termId: string; termName: Localized; finishedEnrollments: number }[];
};

export type TermSessionRow = {
  sessionId: string;
  startsAt: Date;
  endsAt: Date;
  sessionStatus: (typeof classSessions.$inferSelect)["status"];
  attendanceStatus: "present" | "absent" | "excused" | null;
  activityScore: number | null;
  homeworkScore: number | null;
  note: string | null;
  reportSummary: string | null;
  homeworkText: string | null;
};

export type EnrollmentTermDetail = {
  item: StudentHistoryItem;
  sessions: TermSessionRow[];
};

/** Day the package starts counting: termStartedOn → startedOn → createdAt (ISO date). */
export function effectiveTermStart(e: {
  termStartedOn: string | null;
  startedOn: string | null;
  createdAt: Date;
}): string {
  return e.termStartedOn || e.startedOn || e.createdAt.toISOString().slice(0, 10);
}

export function packageWindow(e: {
  termStartedOn: string | null;
  startedOn: string | null;
  createdAt: Date;
  endedOn?: string | null;
}): { start: Date; end: Date | null; termStart: string } {
  const termStart = effectiveTermStart(e);
  return {
    termStart,
    start: new Date(`${termStart}T00:00:00+03:30`),
    end: e.endedOn ? new Date(`${e.endedOn}T23:59:59+03:30`) : null,
  };
}

function inPackageWindow(startsAt: Date, start: Date, end: Date | null) {
  if (startsAt < start) return false;
  if (end && startsAt > end) return false;
  return true;
}

/**
 * Held class sessions that burn one slot of the student's package.
 * Window: from effective term start through endedOn (inclusive), or open-ended if still enrolled.
 */
export async function countTermSessionsUsed(
  db: Db,
  p: { classGroupId: string; termStartedOn: string; endedOn?: string | null },
): Promise<number> {
  const start = new Date(`${p.termStartedOn}T00:00:00+03:30`);
  const conds = [
    eq(classSessions.classGroupId, p.classGroupId),
    eq(classSessions.status, "held"),
    gte(classSessions.startsAt, start),
  ];
  if (p.endedOn) {
    conds.push(lte(classSessions.startsAt, new Date(`${p.endedOn}T23:59:59+03:30`)));
  }
  const [row] = await db.select({ n: count() }).from(classSessions).where(and(...conds));
  return Number(row?.n ?? 0);
}

type MarkStats = { sessionsHeld: number; present: number; absent: number; avgActivity: number | null; avgHomework: number | null };

/** Attendance + held counts for one student inside a package date window. */
async function packageMarkStats(
  db: Db,
  p: { studentId: string; classGroupId: string; start: Date; end: Date | null },
): Promise<MarkStats> {
  const sessionConds = [eq(classSessions.classGroupId, p.classGroupId), gte(classSessions.startsAt, p.start)];
  if (p.end) sessionConds.push(lte(classSessions.startsAt, p.end));

  const [held] = await db
    .select({ n: count() })
    .from(classSessions)
    .where(and(...sessionConds, eq(classSessions.status, "held")));

  const markConds = [
    eq(attendance.studentId, p.studentId),
    eq(classSessions.classGroupId, p.classGroupId),
    gte(classSessions.startsAt, p.start),
  ];
  if (p.end) markConds.push(lte(classSessions.startsAt, p.end));

  const [marks] = await db
    .select({
      present: sql<number>`count(*) filter (where ${attendance.status} = 'present')::int`,
      absent: sql<number>`count(*) filter (where ${attendance.status} in ('absent', 'excused'))::int`,
      avgActivity: avg(attendance.activityScore),
      avgHomework: avg(attendance.homeworkScore),
    })
    .from(attendance)
    .innerJoin(classSessions, eq(classSessions.id, attendance.sessionId))
    .where(and(...markConds));

  return {
    sessionsHeld: Number(held?.n ?? 0),
    present: Number(marks?.present ?? 0),
    absent: Number(marks?.absent ?? 0),
    avgActivity: marks?.avgActivity != null ? Math.round(Number(marks.avgActivity) * 10) / 10 : null,
    avgHomework: marks?.avgHomework != null ? Math.round(Number(marks.avgHomework) * 10) / 10 : null,
  };
}

async function buildHistoryItem(
  db: Db,
  r: {
    e: typeof enrollments.$inferSelect;
    c: typeof classGroups.$inferSelect;
    courseTitle: Localized | null;
    teacherName: Localized | null;
    termId: string | null;
    termName: Localized | null;
  },
): Promise<StudentHistoryItem> {
  const { termStart, start, end } = packageWindow(r.e);
  const planned = r.e.plannedSessions || 7;
  const [sessionsUsed, marks] = await Promise.all([
    countTermSessionsUsed(db, { classGroupId: r.c.id, termStartedOn: termStart, endedOn: r.e.endedOn }),
    packageMarkStats(db, { studentId: r.e.studentId, classGroupId: r.c.id, start, end }),
  ]);
  return {
    enrollmentId: r.e.id,
    status: r.e.status,
    startedOn: r.e.startedOn,
    endedOn: r.e.endedOn,
    classGroupId: r.c.id,
    classTitle: r.c.title,
    courseTitle: r.courseTitle,
    teacherName: r.teacherName,
    termId: r.termId,
    termName: r.termName,
    plannedSessions: planned,
    termStartedOn: r.e.termStartedOn ?? r.e.startedOn,
    sessionsUsed,
    sessionsRemaining: Math.max(0, planned - sessionsUsed),
    termComplete: sessionsUsed >= planned,
    ...marks,
  };
}

/** Full academic history for one student: open enrollments, past ones, and package progress. */
export async function getStudentHistory(db: Db, p: { tenantId: string; studentId: string }): Promise<StudentHistory> {
  const rows = await db
    .select({
      e: enrollments,
      c: classGroups,
      courseTitle: courses.title,
      teacherName: teachers.name,
      termId: terms.id,
      termName: terms.name,
    })
    .from(enrollments)
    .innerJoin(classGroups, eq(classGroups.id, enrollments.classGroupId))
    .leftJoin(courses, eq(courses.id, classGroups.courseId))
    .leftJoin(teachers, eq(teachers.id, classGroups.teacherId))
    .leftJoin(terms, eq(terms.id, classGroups.termId))
    .where(and(eq(enrollments.studentId, p.studentId), eq(enrollments.tenantId, p.tenantId)))
    .orderBy(desc(enrollments.startedOn), desc(enrollments.createdAt));

  const items: StudentHistoryItem[] = [];
  for (const r of rows) {
    items.push(await buildHistoryItem(db, r));
  }

  const current = items.filter((i) => (OPEN as readonly string[]).includes(i.status));
  const past = items.filter((i) => (PAST as readonly string[]).includes(i.status));

  const termMap = new Map<string, { termId: string; termName: Localized; finishedEnrollments: number }>();
  for (const item of past) {
    if (item.status !== "finished" || !item.termId || !item.termName) continue;
    const cur = termMap.get(item.termId) ?? { termId: item.termId, termName: item.termName, finishedEnrollments: 0 };
    cur.finishedEnrollments++;
    termMap.set(item.termId, cur);
  }

  return {
    current,
    past,
    termsSummary: [...termMap.values()].sort((a, b) => a.termName.fa.localeCompare(b.termName.fa, "fa")),
  };
}

const REPORT_OK = new Set(["published", "approved", "pending_approval"]);

/**
 * One enrollment (6/7 package) opened fully: summary + every session in the package window
 * with attendance, scores, class report and homework.
 */
export async function getEnrollmentTermDetail(
  db: Db,
  p: { tenantId: string; studentId: string; enrollmentId: string },
): Promise<EnrollmentTermDetail | null> {
  const [row] = await db
    .select({
      e: enrollments,
      c: classGroups,
      courseTitle: courses.title,
      teacherName: teachers.name,
      termId: terms.id,
      termName: terms.name,
    })
    .from(enrollments)
    .innerJoin(classGroups, eq(classGroups.id, enrollments.classGroupId))
    .leftJoin(courses, eq(courses.id, classGroups.courseId))
    .leftJoin(teachers, eq(teachers.id, classGroups.teacherId))
    .leftJoin(terms, eq(terms.id, classGroups.termId))
    .where(
      and(
        eq(enrollments.id, p.enrollmentId),
        eq(enrollments.studentId, p.studentId),
        eq(enrollments.tenantId, p.tenantId),
      ),
    );
  if (!row) return null;

  const item = await buildHistoryItem(db, row);
  const { start, end } = packageWindow(row.e);

  const sessionConds = [eq(classSessions.classGroupId, row.c.id), gte(classSessions.startsAt, start)];
  if (end) sessionConds.push(lte(classSessions.startsAt, end));

  const sess = await db
    .select()
    .from(classSessions)
    .where(and(...sessionConds))
    .orderBy(asc(classSessions.startsAt));

  const sessionIds = sess.map((s) => s.id);
  if (!sessionIds.length) return { item, sessions: [] };

  const [marks, reports, homeworks] = await Promise.all([
    db.select().from(attendance).where(and(eq(attendance.studentId, p.studentId), inArray(attendance.sessionId, sessionIds))),
    db.select().from(sessionReports).where(inArray(sessionReports.sessionId, sessionIds)),
    db.select().from(homework).where(inArray(homework.sessionId, sessionIds)).orderBy(asc(homework.createdAt)),
  ]);

  const markOf = new Map(marks.map((m) => [m.sessionId, m]));
  const reportOf = new Map(reports.map((r) => [r.sessionId, r]));
  const hwOf = new Map<string, string>();
  for (const h of homeworks) {
    if (!hwOf.has(h.sessionId) && h.text?.trim()) hwOf.set(h.sessionId, h.text.trim());
  }

  return {
    item,
    sessions: sess
      .filter((s) => inPackageWindow(s.startsAt, start, end))
      .map((s) => {
        const att = markOf.get(s.id);
        const report = reportOf.get(s.id);
        return {
          sessionId: s.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          sessionStatus: s.status,
          attendanceStatus: (att?.status as TermSessionRow["attendanceStatus"]) ?? null,
          activityScore: att?.activityScore ?? null,
          homeworkScore: att?.homeworkScore ?? null,
          note: att?.note?.trim() || null,
          reportSummary: report && REPORT_OK.has(report.status) && report.summary?.trim() ? report.summary.trim() : null,
          homeworkText: hwOf.get(s.id) ?? null,
        } satisfies TermSessionRow;
      }),
  };
}

export async function listTerms(db: Db, tenantId: string) {
  return db.select().from(terms).where(eq(terms.tenantId, tenantId)).orderBy(desc(terms.startsOn));
}
