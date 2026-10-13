import { and, avg, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  attendance,
  classGroups,
  classSessions,
  courses,
  enrollments,
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

/** Day the package starts counting: termStartedOn → startedOn → createdAt (ISO date). */
export function effectiveTermStart(e: {
  termStartedOn: string | null;
  startedOn: string | null;
  createdAt: Date;
}): string {
  return e.termStartedOn || e.startedOn || e.createdAt.toISOString().slice(0, 10);
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

  const classIds = [...new Set(rows.map((r) => r.c.id))];
  const stats = new Map<
    string,
    { sessionsHeld: number; present: number; absent: number; avgActivity: number | null; avgHomework: number | null }
  >();

  if (classIds.length) {
    const held = await db
      .select({ classGroupId: classSessions.classGroupId, n: count() })
      .from(classSessions)
      .where(and(inArray(classSessions.classGroupId, classIds), eq(classSessions.status, "held")))
      .groupBy(classSessions.classGroupId);

    const marks = await db
      .select({
        classGroupId: classSessions.classGroupId,
        present: sql<number>`count(*) filter (where ${attendance.status} = 'present')::int`,
        absent: sql<number>`count(*) filter (where ${attendance.status} in ('absent', 'excused'))::int`,
        avgActivity: avg(attendance.activityScore),
        avgHomework: avg(attendance.homeworkScore),
      })
      .from(attendance)
      .innerJoin(classSessions, eq(classSessions.id, attendance.sessionId))
      .where(and(eq(attendance.studentId, p.studentId), inArray(classSessions.classGroupId, classIds)))
      .groupBy(classSessions.classGroupId);

    for (const id of classIds) {
      stats.set(id, { sessionsHeld: 0, present: 0, absent: 0, avgActivity: null, avgHomework: null });
    }
    for (const h of held) {
      const s = stats.get(h.classGroupId)!;
      s.sessionsHeld = Number(h.n);
    }
    for (const m of marks) {
      const s = stats.get(m.classGroupId)!;
      s.present = Number(m.present);
      s.absent = Number(m.absent);
      s.avgActivity = m.avgActivity != null ? Math.round(Number(m.avgActivity) * 10) / 10 : null;
      s.avgHomework = m.avgHomework != null ? Math.round(Number(m.avgHomework) * 10) / 10 : null;
    }
  }

  const items: StudentHistoryItem[] = [];
  for (const r of rows) {
    const s = stats.get(r.c.id) ?? { sessionsHeld: 0, present: 0, absent: 0, avgActivity: null, avgHomework: null };
    const termStart = effectiveTermStart(r.e);
    const planned = r.e.plannedSessions || 7;
    const sessionsUsed = await countTermSessionsUsed(db, {
      classGroupId: r.c.id,
      termStartedOn: termStart,
      endedOn: r.e.endedOn,
    });
    const sessionsRemaining = Math.max(0, planned - sessionsUsed);
    items.push({
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
      sessionsRemaining,
      termComplete: sessionsUsed >= planned,
      ...s,
    });
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

export async function listTerms(db: Db, tenantId: string) {
  return db.select().from(terms).where(eq(terms.tenantId, tenantId)).orderBy(desc(terms.startsOn));
}
