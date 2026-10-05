import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, notExists, or, sql } from "drizzle-orm";
import {
  attendance,
  cancellationRequests,
  classGroups,
  classSessions,
  enrollments,
  homework,
  scheduledAnnouncements,
  sessionReports,
  type getDb,
} from "@khaneyeidea/db";

type Db = ReturnType<typeof getDb>;
export type Mark = "present" | "absent" | "excused";
export type Channel = "bale" | "telegram" | "sms" | "web";

// What happens to a session. The admin board, the teacher panel and the bots all go through these functions so a
// session ends up in the same state whichever door the teacher used (SESSION-LIFECYCLE.md).

/**
 * The teacher says the session was held: attendance for every active student (default present), the report and
 * the homework. Held once a report exists; attendance alone leaves it incomplete.
 */
export async function recordHeld(
  db: Db,
  p: { sessionId: string; userId: string | null; channel: Channel; marks: Record<string, Mark>; summary: string | null; homework: string | null },
) {
  const [s] = await db.select().from(classSessions).where(eq(classSessions.id, p.sessionId));
  if (!s) throw new Error("session not found");
  const roster = await db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.classGroupId, s.classGroupId), eq(enrollments.status, "active")));
  await db.transaction(async (tx) => {
    for (const { id } of roster) {
      const status = p.marks[id] ?? "present";
      await tx
        .insert(attendance)
        .values({ sessionId: p.sessionId, studentId: id, status })
        .onConflictDoUpdate({ target: [attendance.sessionId, attendance.studentId], set: { status } });
    }
    if (p.summary) {
      await tx
        .insert(sessionReports)
        .values({ sessionId: p.sessionId, summary: p.summary, submittedByUserId: p.userId, channel: p.channel })
        .onConflictDoUpdate({
          target: sessionReports.sessionId,
          set: { summary: p.summary, submittedByUserId: p.userId, channel: p.channel, submittedAt: new Date() },
        });
    }
    await tx.delete(homework).where(eq(homework.sessionId, p.sessionId));
    if (p.homework) await tx.insert(homework).values({ sessionId: p.sessionId, text: p.homework });
    await tx
      .update(classSessions)
      .set({ status: p.summary ? "held" : "held_incomplete", notHeldReason: null, needsMakeup: false })
      .where(eq(classSessions.id, p.sessionId));
  });
  return { students: roster.length, report: !!p.summary, homework: !!p.homework };
}

export const NOT_HELD_REASONS = ["teacher", "holiday", "no_students", "place", "other"] as const;

export async function recordNotHeld(db: Db, p: { sessionId: string; reason: string; needsMakeup: boolean }) {
  await db
    .update(classSessions)
    .set({ status: p.needsMakeup ? "needs_makeup" : "not_held", notHeldReason: p.reason, needsMakeup: p.needsMakeup })
    .where(eq(classSessions.id, p.sessionId));
}

/** Cancel a future session and queue the notice for the class group (a person approved its text). */
export async function cancelPlanned(
  db: Db,
  p: { tenantId: string; sessionId: string; userId: string; reason: string | null; message: string; sendAt: Date; toParents: boolean },
) {
  await db.transaction(async (tx) => {
    await tx.update(classSessions).set({ status: "cancel_planned", notHeldReason: p.reason }).where(eq(classSessions.id, p.sessionId));
    await tx
      .update(scheduledAnnouncements)
      .set({ status: "canceled" })
      .where(and(eq(scheduledAnnouncements.sessionId, p.sessionId), inArray(scheduledAnnouncements.status, ["draft", "scheduled"])));
    await tx.insert(scheduledAnnouncements).values({
      tenantId: p.tenantId,
      sessionId: p.sessionId,
      text: p.message,
      sendAt: p.sendAt,
      targets: { group: true, parents: p.toParents },
      status: "scheduled",
      approvedByUserId: p.userId,
    });
    await tx
      .update(cancellationRequests)
      .set({ status: "approved", decidedByUserId: p.userId, decidedAt: new Date() })
      .where(and(eq(cancellationRequests.sessionId, p.sessionId), eq(cancellationRequests.status, "pending")));
  });
}

export async function restorePlanned(db: Db, sessionId: string) {
  await db.update(classSessions).set({ status: "scheduled", notHeldReason: null }).where(and(eq(classSessions.id, sessionId), eq(classSessions.status, "cancel_planned")));
  await db
    .update(scheduledAnnouncements)
    .set({ status: "canceled" })
    .where(and(eq(scheduledAnnouncements.sessionId, sessionId), inArray(scheduledAnnouncements.status, ["draft", "scheduled"])));
}

export async function rejectCancellation(db: Db, p: { requestId: string; tenantId: string; userId: string }) {
  const res = await db
    .update(cancellationRequests)
    .set({ status: "rejected", decidedByUserId: p.userId, decidedAt: new Date() })
    .where(and(eq(cancellationRequests.id, p.requestId), eq(cancellationRequests.tenantId, p.tenantId), eq(cancellationRequests.status, "pending")))
    .returning({ id: cancellationRequests.id });
  return res.length > 0;
}

/** drizzle wraps driver errors: the Postgres code sits on `cause`. */
const isUniqueViolation = (e: unknown) => [e, (e as { cause?: unknown })?.cause].some((x) => (x as { code?: string } | undefined)?.code === "23505");

export type Conflict = { kind: "teacher" | "room"; id: string; title: string; startsAt?: Date };

/** Weekly-schedule clash check for the class form: same teacher or same room, same weekday, overlapping hours and dates. */
export async function classScheduleConflicts(
  db: Db,
  tenantId: string,
  c: { id?: string | null; teacherId: string | null; roomId: string | null; weekday: number; startTime: string; endTime: string; startsOn: string; endsOn: string | null },
): Promise<Conflict[]> {
  if (!c.teacherId && !c.roomId) return [];
  const start = c.startTime.slice(0, 5);
  const end = c.endTime.slice(0, 5);
  const rows = await db
    .select()
    .from(classGroups)
    .where(
      and(
        eq(classGroups.tenantId, tenantId),
        eq(classGroups.active, true),
        eq(classGroups.weekday, c.weekday),
        c.id ? ne(classGroups.id, c.id) : undefined,
        or(c.teacherId ? eq(classGroups.teacherId, c.teacherId) : undefined, c.roomId ? eq(classGroups.roomId, c.roomId) : undefined),
      ),
    );
  const out: Conflict[] = [];
  for (const o of rows) {
    const overlapHours = o.startTime.slice(0, 5) < end && o.endTime.slice(0, 5) > start;
    const overlapDates = (!o.endsOn || o.endsOn >= c.startsOn) && (!c.endsOn || c.endsOn >= o.startsOn);
    if (!overlapHours || !overlapDates) continue;
    if (c.teacherId && o.teacherId === c.teacherId) out.push({ kind: "teacher", id: o.id, title: o.title });
    if (c.roomId && o.roomId === c.roomId) out.push({ kind: "room", id: o.id, title: o.title });
  }
  return out;
}

/** Concrete-session clash check for moving a session or adding a makeup. */
export async function sessionConflicts(
  db: Db,
  tenantId: string,
  p: { classGroupId: string; teacherId: string | null; startsAt: Date; endsAt: Date; excludeSessionId?: string },
): Promise<Conflict[]> {
  const [cls] = await db.select({ roomId: classGroups.roomId }).from(classGroups).where(eq(classGroups.id, p.classGroupId));
  const roomId = cls?.roomId ?? null;
  if (!p.teacherId && !roomId) return [];
  const rows = await db
    .select({ s: classSessions, c: classGroups })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .where(
      and(
        eq(classSessions.tenantId, tenantId),
        lt(classSessions.startsAt, p.endsAt),
        gt(classSessions.endsAt, p.startsAt),
        ne(classSessions.status, "cancel_planned"),
        p.excludeSessionId ? ne(classSessions.id, p.excludeSessionId) : undefined,
        or(p.teacherId ? eq(classSessions.teacherId, p.teacherId) : undefined, roomId ? eq(classGroups.roomId, roomId) : undefined),
      ),
    );
  const out: Conflict[] = [];
  for (const r of rows) {
    if (p.teacherId && r.s.teacherId === p.teacherId) out.push({ kind: "teacher", id: r.s.id, title: r.c.title, startsAt: r.s.startsAt });
    if (roomId && r.c.roomId === roomId) out.push({ kind: "room", id: r.s.id, title: r.c.title, startsAt: r.s.startsAt });
  }
  return out;
}

/** Move one untouched future session to another time. The weekly slot it left is remembered so syncing does not re-create it. */
export async function rescheduleSession(db: Db, p: { sessionId: string; startsAt: Date; endsAt: Date; now?: Date }) {
  const now = p.now ?? new Date();
  const [s] = await db.select().from(classSessions).where(eq(classSessions.id, p.sessionId));
  if (!s) return { ok: false as const, error: "not_found" as const };
  if (s.startsAt <= now || s.status !== "scheduled") return { ok: false as const, error: "not_movable" as const };
  if (p.endsAt <= p.startsAt || p.startsAt <= now) return { ok: false as const, error: "bad_time" as const };
  try {
    await db
      .update(classSessions)
      .set({ startsAt: p.startsAt, endsAt: p.endsAt, custom: true, originalStartsAt: s.originalStartsAt ?? s.startsAt })
      .where(
        and(
          eq(classSessions.id, p.sessionId),
          notExists(db.select({ one: sql`1` }).from(attendance).where(eq(attendance.sessionId, classSessions.id))),
        ),
      );
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false as const, error: "slot_taken" as const };
    throw e;
  }
  return { ok: true as const };
}

/** An extra session for a class (a makeup for a missed one, or a one-off). Off the weekly pattern, so syncing keeps it. */
export async function createMakeup(
  db: Db,
  p: { tenantId: string; classGroupId: string; ofSessionId?: string | null; startsAt: Date; endsAt: Date; now?: Date },
) {
  const now = p.now ?? new Date();
  if (p.endsAt <= p.startsAt || p.startsAt <= now) return { ok: false as const, error: "bad_time" as const };
  const [c] = await db.select().from(classGroups).where(and(eq(classGroups.id, p.classGroupId), eq(classGroups.tenantId, p.tenantId)));
  if (!c) return { ok: false as const, error: "not_found" as const };
  try {
    const [row] = await db
      .insert(classSessions)
      .values({
        tenantId: p.tenantId,
        classGroupId: c.id,
        teacherId: c.teacherId,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        custom: true,
        makeupOfSessionId: p.ofSessionId ?? null,
      })
      .returning({ id: classSessions.id });
    if (p.ofSessionId) {
      await db
        .update(classSessions)
        .set({ status: "not_held", needsMakeup: false })
        .where(and(eq(classSessions.id, p.ofSessionId), eq(classSessions.status, "needs_makeup")));
    }
    return { ok: true as const, id: row!.id };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false as const, error: "slot_taken" as const };
    throw e;
  }
}

/** Removes an extra (makeup) session that nothing has been recorded for. Regular weekly sessions are never deleted here. */
export async function deleteExtraSession(db: Db, p: { tenantId: string; sessionId: string }) {
  const res = await db
    .delete(classSessions)
    .where(
      and(
        eq(classSessions.id, p.sessionId),
        eq(classSessions.tenantId, p.tenantId),
        eq(classSessions.custom, true),
        or(isNotNull(classSessions.makeupOfSessionId), isNull(classSessions.originalStartsAt)),
        eq(classSessions.status, "scheduled"),
        notExists(db.select({ one: sql`1` }).from(attendance).where(eq(attendance.sessionId, classSessions.id))),
        notExists(db.select({ one: sql`1` }).from(sessionReports).where(eq(sessionReports.sessionId, classSessions.id))),
      ),
    )
    .returning({ id: classSessions.id });
  return res.length > 0;
}
