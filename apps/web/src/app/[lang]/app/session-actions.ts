"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { cancellationRequests, chatLinks, classGroups, classSessions, enrollments, getDb, scheduledAnnouncements } from "@khaneyeidea/db";
import {
  can,
  cancelPlanned,
  createLinkCode,
  createMakeup,
  deleteExtraSession,
  ForbiddenError,
  recordHeld,
  recordNotHeld,
  rejectCancellation,
  rescheduleSession,
  restorePlanned,
  sessionConflicts,
  zonedToUtc,
  type Mark,
} from "@khaneyeidea/core";
import { requirePermission, getUser } from "@/server/auth";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import { fill } from "@/lib/format";
import { getOpsDict } from "@/lib/ops-i18n";
import { audit, bool, text, type ActionState } from "@/server/admin";
import { morningOf, sessionAccess } from "@/server/sessions";

// Session work shared by the admin board and the teacher panel. Access is checked per session on the server:
// schedulers may act on any session of the tenant, a teacher only on their own sessions. Every export here is a
// public endpoint: each one checks who is calling.

const MARK = z.enum(["present", "absent", "excused"]);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type SessionState = ActionState & { conflicts?: { kind: "teacher" | "room"; title: string }[]; code?: string };

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
  const marks: Record<string, Mark> = {};
  for (const { id } of roster) marks[id] = MARK.catch("present").parse(f.get(`att.${id}`));
  const summary = text(f, "summary")?.slice(0, 4000) ?? null;
  const homework = bool(f, "noHomework") ? null : (text(f, "homework")?.slice(0, 4000) ?? null);
  const r = await recordHeld(db, { sessionId, userId: user.userId, channel: "web", marks, summary, homework });
  // Audit without children's names: counts only.
  await audit(user.tenantId, user.userId, "update", "class_session", sessionId, { held: true, ...r });
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
  await recordNotHeld(getDb(), { sessionId, reason: reason === "other" && other ? other : reason, needsMakeup });
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
    const pending = await db
      .select({ id: cancellationRequests.id })
      .from(cancellationRequests)
      .where(and(eq(cancellationRequests.sessionId, sessionId), eq(cancellationRequests.status, "pending")));
    if (!pending.length) await db.insert(cancellationRequests).values({ tenantId: user.tenantId, sessionId, requestedByUserId: user.userId, reason });
    await audit(user.tenantId, user.userId, "create", "cancellation_request", sessionId, { reason });
    refresh();
    return { ok: true, savedAt: Date.now() };
  }
  const message = text(f, "message")?.slice(0, 1000);
  if (!message) return { error: "validation", fieldErrors: { message: "required" } };
  const when = f.get("sendAt") === "now" ? new Date() : morningOf(session.startsAt);
  await cancelPlanned(db, { tenantId: user.tenantId, sessionId, userId: user.userId, reason, message, sendAt: when, toParents: bool(f, "toParents") });
  await audit(user.tenantId, user.userId, "update", "class_session", sessionId, { canceled: true, reason, sendAt: when });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function restoreSession(f: FormData) {
  const sessionId = z.uuid().parse(f.get("sessionId"));
  const { user, session, asTeacher } = await sessionAccess(sessionId);
  if (asTeacher || !can(user, "schedule.manage")) throw new ForbiddenError("schedule.manage");
  if (session.status !== "cancel_planned") return;
  await restorePlanned(getDb(), sessionId);
  await audit(user.tenantId, user.userId, "update", "class_session", sessionId, { restored: true });
  refresh();
}

/** The admin decides a teacher's cancellation request: approve (with the notice text they can edit) or decline. */
export async function decideRequest(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const requestId = z.uuid().parse(f.get("requestId"));
  const db = getDb();
  const [req] = await db
    .select()
    .from(cancellationRequests)
    .where(and(eq(cancellationRequests.id, requestId), eq(cancellationRequests.tenantId, user.tenantId), eq(cancellationRequests.status, "pending")));
  if (!req) return;
  if (f.get("decision") === "reject") {
    await rejectCancellation(db, { requestId, tenantId: user.tenantId, userId: user.userId });
    await audit(user.tenantId, user.userId, "update", "cancellation_request", requestId, { decision: "rejected" });
    refresh();
    return;
  }
  const [s] = await db.select().from(classSessions).where(and(eq(classSessions.id, req.sessionId), eq(classSessions.tenantId, user.tenantId)));
  if (!s) return;
  const message = text(f, "message")?.slice(0, 1000);
  if (!message || s.startsAt <= new Date()) return;
  await cancelPlanned(db, { tenantId: user.tenantId, sessionId: s.id, userId: user.userId, reason: req.reason, message, sendAt: f.get("sendAt") === "now" ? new Date() : morningOf(s.startsAt), toParents: false });
  await audit(user.tenantId, user.userId, "update", "cancellation_request", requestId, { decision: "approved" });
  refresh();
}

const timeOk = (v: string | null) => !!v && HHMM.test(v);

/** Moves one future session to another day/time (checks teacher and room clashes first), optionally telling the group. */
export async function moveSession(_: SessionState, f: FormData): Promise<SessionState> {
  const user = await requirePermission("schedule.manage");
  const sessionId = z.uuid().parse(f.get("sessionId"));
  const day = text(f, "day");
  const from = text(f, "from");
  const to = text(f, "to");
  if (!day || !ISO.test(day) || !timeOk(from) || !timeOk(to) || to! <= from!) return { error: "bad_time" };
  const db = getDb();
  const [s] = await db.select().from(classSessions).where(and(eq(classSessions.id, sessionId), eq(classSessions.tenantId, user.tenantId)));
  if (!s) return { error: "not_found" };
  const startsAt = zonedToUtc(day, from!);
  const endsAt = zonedToUtc(day, to!);
  if (!bool(f, "force")) {
    const conflicts = await sessionConflicts(db, user.tenantId, { classGroupId: s.classGroupId, teacherId: s.teacherId, startsAt, endsAt, excludeSessionId: s.id });
    if (conflicts.length) return { error: "conflict", conflicts: conflicts.map((c) => ({ kind: c.kind, title: c.title })) };
  }
  const [cls] = await db.select({ title: classGroups.title }).from(classGroups).where(eq(classGroups.id, s.classGroupId));
  const when = (d: Date) => `${dayLabel(tehranIso(d), "fa")} ${timeLabel(d, "fa")}`;
  // Class notices go to parents, so the default is Persian. The admin may write their own text.
  const message = bool(f, "notify")
    ? (text(f, "message")?.slice(0, 1000) ?? fill(getOpsDict("fa").move.messageDefault, { class: cls?.title ?? "", from: when(s.startsAt), to: when(startsAt) }))
    : null;
  const res = await rescheduleSession(db, { sessionId, startsAt, endsAt });
  if (!res.ok) return { error: res.error };
  if (message) {
    await db.insert(scheduledAnnouncements).values({
      tenantId: user.tenantId,
      sessionId,
      text: message,
      sendAt: new Date(),
      targets: { group: true, parents: false },
      status: "scheduled",
      approvedByUserId: user.userId,
    });
  }
  await audit(user.tenantId, user.userId, "update", "class_session", sessionId, { moved: { day, from, to }, notified: !!message });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

/** A one-off extra or makeup session for a class. */
export async function addMakeup(_: SessionState, f: FormData): Promise<SessionState> {
  const user = await requirePermission("schedule.manage");
  const classGroupId = z.uuid().parse(f.get("classGroupId"));
  const ofRaw = text(f, "ofSessionId");
  const day = text(f, "day");
  const from = text(f, "from");
  const to = text(f, "to");
  if (!day || !ISO.test(day) || !timeOk(from) || !timeOk(to) || to! <= from!) return { error: "bad_time" };
  const db = getDb();
  const [c] = await db.select().from(classGroups).where(and(eq(classGroups.id, classGroupId), eq(classGroups.tenantId, user.tenantId)));
  if (!c) return { error: "not_found" };
  const startsAt = zonedToUtc(day, from!);
  const endsAt = zonedToUtc(day, to!);
  if (!bool(f, "force")) {
    const conflicts = await sessionConflicts(db, user.tenantId, { classGroupId, teacherId: c.teacherId, startsAt, endsAt });
    if (conflicts.length) return { error: "conflict", conflicts: conflicts.map((x) => ({ kind: x.kind, title: x.title })) };
  }
  const res = await createMakeup(db, { tenantId: user.tenantId, classGroupId, ofSessionId: ofRaw && z.uuid().safeParse(ofRaw).success ? ofRaw : null, startsAt, endsAt });
  if (!res.ok) return { error: res.error };
  await audit(user.tenantId, user.userId, "create", "class_session", res.id, { makeup: true, day, from, to });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

/** A code the admin posts as /link CODE in the class's Bale or Telegram group. */
export async function createClassCode(_: SessionState, f: FormData): Promise<SessionState> {
  const user = await requirePermission("schedule.manage");
  const classGroupId = z.uuid().parse(f.get("classGroupId"));
  const [c] = await getDb().select({ id: classGroups.id }).from(classGroups).where(and(eq(classGroups.id, classGroupId), eq(classGroups.tenantId, user.tenantId)));
  if (!c) return { error: "not_found" };
  const { code } = await createLinkCode(getDb(), user.tenantId, "class", c.id);
  return { ok: true, code, savedAt: Date.now() };
}

export async function unlinkClassGroup(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const classGroupId = z.uuid().parse(f.get("classGroupId"));
  const channel = z.enum(["bale", "telegram"]).parse(f.get("channel"));
  await getDb().delete(chatLinks).where(and(eq(chatLinks.classGroupId, classGroupId), eq(chatLinks.channel, channel), eq(chatLinks.tenantId, user.tenantId)));
  refresh();
}

/** A code a signed-in teacher, parent or admin sends to the bot as /start CODE to connect their own chat. */
export async function createMyCode(): Promise<SessionState> {
  const user = await getUser();
  if (!user) throw new ForbiddenError("self.view");
  const { code } = await createLinkCode(getDb(), user.tenantId, "user", user.userId);
  return { ok: true, code, savedAt: Date.now() };
}

/** Removes an extra session added by mistake (only extras with nothing recorded). */
export async function removeExtraSession(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const sessionId = z.uuid().parse(f.get("sessionId"));
  if (await deleteExtraSession(getDb(), { tenantId: user.tenantId, sessionId })) await audit(user.tenantId, user.userId, "delete", "class_session", sessionId);
  refresh();
}
