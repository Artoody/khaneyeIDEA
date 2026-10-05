"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { attendance, cancellationRequests, classSessions, enrollments, getDb, homework, scheduledAnnouncements, sessionReports } from "@khaneyeidea/db";
import { can, ForbiddenError } from "@khaneyeidea/core";
import { audit, bool, text, type ActionState } from "@/server/admin";
import { morningOf, sessionAccess } from "@/server/sessions";

// Session work shared by the admin board and the teacher panel. Access is checked per session on the server:
// schedulers may act on any session of the tenant, a teacher only on their own sessions.

const MARK = z.enum(["present", "absent", "excused"]);

export async function saveSessionWork(_: ActionState, f: FormData): Promise<ActionState> {
  const sessionId = z.uuid().parse(f.get("sessionId"));
  const { user, session } = await sessionAccess(sessionId);
  if (session.status === "cancel_planned") return { error: "canceled" };
  if (session.startsAt > new Date()) return { error: "future" };
  const db = getDb();
  const roster = await db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.classGroupId, session.classGroupId), eq(enrollments.status, "active")));
  const summary = text(f, "summary")?.slice(0, 4000) ?? null;
  const hwText = bool(f, "noHomework") ? null : (text(f, "homework")?.slice(0, 4000) ?? null);
  await db.transaction(async (tx) => {
    for (const { id } of roster) {
      const status = MARK.catch("present").parse(f.get(`att.${id}`));
      await tx
        .insert(attendance)
        .values({ sessionId, studentId: id, status })
        .onConflictDoUpdate({ target: [attendance.sessionId, attendance.studentId], set: { status } });
    }
    if (summary) {
      await tx
        .insert(sessionReports)
        .values({ sessionId, summary, submittedByUserId: user.userId, channel: "web" })
        .onConflictDoUpdate({ target: sessionReports.sessionId, set: { summary, submittedByUserId: user.userId, channel: "web", submittedAt: new Date() } });
    }
    await tx.delete(homework).where(eq(homework.sessionId, sessionId));
    if (hwText) await tx.insert(homework).values({ sessionId, text: hwText });
    // Held once a report exists; attendance alone leaves it incomplete.
    await tx.update(classSessions).set({ status: summary ? "held" : "held_incomplete", notHeldReason: null, needsMakeup: false }).where(eq(classSessions.id, sessionId));
  });
  // Audit without children's names: counts only.
  await audit(user.tenantId, user.userId, "update", "class_session", sessionId, { held: true, students: roster.length, report: !!summary, homework: !!hwText });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function markNotHeld(_: ActionState, f: FormData): Promise<ActionState> {
  const sessionId = z.uuid().parse(f.get("sessionId"));
  const { user, session } = await sessionAccess(sessionId);
  if (session.startsAt > new Date()) return { error: "future" };
  const reason = z.enum(["teacher", "holiday", "no_students", "place", "other"]).catch("other").parse(f.get("reason"));
  const other = text(f, "otherReason")?.slice(0, 300);
  const needsMakeup = bool(f, "needsMakeup");
  await getDb()
    .update(classSessions)
    .set({ status: needsMakeup ? "needs_makeup" : "not_held", notHeldReason: reason === "other" && other ? other : reason, needsMakeup })
    .where(eq(classSessions.id, sessionId));
  await audit(user.tenantId, user.userId, "update", "class_session", sessionId, { notHeld: reason, needsMakeup });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

/**
 * Cancel ahead. Schedulers cancel directly and queue the class-group notice (morning of the day, or now); teachers
 * file a request that the admin approves. No message is sent without a person approving its text.
 */
export async function cancelSession(_: ActionState, f: FormData): Promise<ActionState> {
  const sessionId = z.uuid().parse(f.get("sessionId"));
  const { user, session, asTeacher } = await sessionAccess(sessionId);
  if (session.startsAt <= new Date()) return { error: "past" };
  const reason = text(f, "reason")?.slice(0, 300) ?? null;
  const db = getDb();
  if (asTeacher) {
    await db.insert(cancellationRequests).values({ tenantId: user.tenantId, sessionId, requestedByUserId: user.userId, reason });
    await audit(user.tenantId, user.userId, "create", "cancellation_request", sessionId, { reason });
    refresh();
    return { ok: true, savedAt: Date.now() };
  }
  const message = text(f, "message")?.slice(0, 1000);
  if (!message) return { error: "validation", fieldErrors: { message: "required" } };
  const when = f.get("sendAt") === "now" ? new Date() : morningOf(session.startsAt);
  await db.transaction(async (tx) => {
    await tx.update(classSessions).set({ status: "cancel_planned", notHeldReason: reason }).where(eq(classSessions.id, sessionId));
    await tx.update(scheduledAnnouncements).set({ status: "canceled" }).where(and(eq(scheduledAnnouncements.sessionId, sessionId), inArray(scheduledAnnouncements.status, ["draft", "scheduled"])));
    await tx.insert(scheduledAnnouncements).values({
      tenantId: user.tenantId,
      sessionId,
      text: message,
      sendAt: when,
      targets: { group: true, parents: bool(f, "toParents") },
      status: "scheduled",
      approvedByUserId: user.userId,
    });
    await tx
      .update(cancellationRequests)
      .set({ status: "approved", decidedByUserId: user.userId, decidedAt: new Date() })
      .where(and(eq(cancellationRequests.sessionId, sessionId), eq(cancellationRequests.status, "pending")));
  });
  await audit(user.tenantId, user.userId, "update", "class_session", sessionId, { canceled: true, reason, sendAt: when });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function restoreSession(f: FormData) {
  const sessionId = z.uuid().parse(f.get("sessionId"));
  const { user, session, asTeacher } = await sessionAccess(sessionId);
  if (asTeacher || !can(user, "schedule.manage")) throw new ForbiddenError("schedule.manage");
  if (session.status !== "cancel_planned") return;
  const db = getDb();
  await db.update(classSessions).set({ status: "scheduled", notHeldReason: null }).where(eq(classSessions.id, sessionId));
  await db
    .update(scheduledAnnouncements)
    .set({ status: "canceled" })
    .where(and(eq(scheduledAnnouncements.sessionId, sessionId), inArray(scheduledAnnouncements.status, ["draft", "scheduled"])));
  await audit(user.tenantId, user.userId, "update", "class_session", sessionId, { restored: true });
  refresh();
}
