import { and, eq, gte, inArray, isNotNull, notExists, sql } from "drizzle-orm";
import { attendance, classGroups, classSessions, sessionReports, type getDb } from "@khaneyeidea/db";
import { addDays, isFixedHoliday, tehranDay, weekdaySat0, zonedToUtc } from "./booking";

type Db = ReturnType<typeof getDb>;

// Recurring classes -> concrete sessions (Asia/Tehran). Sessions are generated ahead for a fixed horizon and
// regenerated when a class's schedule changes; sessions that already have attendance or a report are never touched.

/** How far ahead sessions exist, when a class has no end date. */
export const SESSION_HORIZON_DAYS = 12 * 7;

export type ClassSchedule = { weekday: number; startTime: string; endTime: string; startsOn: string; endsOn: string | null };

/** Calendar days of a weekly class between from and to (inclusive), skipping fixed solar holidays. */
export function classDays(c: ClassSchedule, from: string, to: string): string[] {
  const start = c.startsOn > from ? c.startsOn : from;
  const end = c.endsOn && c.endsOn < to ? c.endsOn : to;
  const out: string[] = [];
  // jump to the first matching weekday
  let day = start;
  for (let i = 0; i < 7 && weekdaySat0(day) !== c.weekday; i++) day = addDays(day, 1);
  for (; day <= end; day = addDays(day, 7)) if (!isFixedHoliday(day)) out.push(day);
  return out;
}

export function sessionTimes(c: ClassSchedule, day: string) {
  const startsAt = zonedToUtc(day, c.startTime.slice(0, 5));
  let endsAt = zonedToUtc(day, c.endTime.slice(0, 5));
  if (endsAt <= startsAt) endsAt = new Date(startsAt.getTime() + 90 * 60_000);
  return { startsAt, endsAt };
}

/**
 * Brings a class's future sessions in line with its schedule: adds missing ones, and removes future sessions that
 * no longer match (only untouched "scheduled" sessions: no attendance, no report). Returns counts.
 */
export async function syncClassSessions(db: Db, tenantId: string, classGroupId: string, now = new Date()) {
  const [c] = await db.select().from(classGroups).where(and(eq(classGroups.id, classGroupId), eq(classGroups.tenantId, tenantId)));
  if (!c) return { added: 0, removed: 0 };
  const today = tehranDay(now);
  const horizon = addDays(today, SESSION_HORIZON_DAYS);
  const wanted = c.active ? classDays(c, today, horizon).map((d) => sessionTimes(c, d)) : [];
  const wantedKeys = new Set(wanted.map((w) => w.startsAt.getTime()));

  return db.transaction(async (tx) => {
    const future = await tx
      .select({ id: classSessions.id, startsAt: classSessions.startsAt, status: classSessions.status, custom: classSessions.custom, originalStartsAt: classSessions.originalStartsAt })
      .from(classSessions)
      .where(and(eq(classSessions.classGroupId, c.id), gte(classSessions.startsAt, now)));
    // Moved sessions and makeups (custom) are off the weekly pattern: never removed by a schedule change.
    const stale = future.filter((s) => s.status === "scheduled" && !s.custom && !wantedKeys.has(s.startsAt.getTime())).map((s) => s.id);
    let removed = 0;
    if (stale.length) {
      const del = await tx
        .delete(classSessions)
        .where(
          and(
            inArray(classSessions.id, stale),
            notExists(tx.select({ one: sql`1` }).from(attendance).where(eq(attendance.sessionId, classSessions.id))),
            notExists(tx.select({ one: sql`1` }).from(sessionReports).where(eq(sessionReports.sessionId, classSessions.id))),
          ),
        )
        .returning({ id: classSessions.id });
      removed = del.length;
    }
    const have = new Set(future.map((s) => s.startsAt.getTime()));
    // A weekly slot a session was moved away from stays empty.
    const moved = await tx
      .select({ at: classSessions.originalStartsAt })
      .from(classSessions)
      .where(and(eq(classSessions.classGroupId, c.id), isNotNull(classSessions.originalStartsAt)));
    for (const m of moved) if (m.at) have.add(m.at.getTime());
    const toAdd = wanted.filter((w) => w.startsAt >= now && !have.has(w.startsAt.getTime()));
    if (toAdd.length) {
      await tx
        .insert(classSessions)
        .values(toAdd.map((w) => ({ tenantId, classGroupId: c.id, teacherId: c.teacherId, startsAt: w.startsAt, endsAt: w.endsAt })))
        .onConflictDoNothing();
    }
    // A teacher change applies to the class's future sessions.
    await tx
      .update(classSessions)
      .set({ teacherId: c.teacherId })
      .where(and(eq(classSessions.classGroupId, c.id), gte(classSessions.startsAt, now), eq(classSessions.status, "scheduled")));
    return { added: toAdd.length, removed };
  });
}

/** Sessions are "awaiting the teacher" once they have ended without an answer; computed on read. */
export function effectiveStatus(s: { status: (typeof classSessions.$inferSelect)["status"]; endsAt: Date }, now = new Date()) {
  return s.status === "scheduled" && s.endsAt <= now ? "awaiting_teacher" : s.status;
}
