"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attendance, branches, classGroups, classSessions, courses, enrollments, getDb, guardians, rooms, students, teachers, terms } from "@khaneyeidea/db";
import { classScheduleConflicts, findOrCreateUser, grantRole, normalizeIranMobile, syncClassSessions } from "@khaneyeidea/core";
import { requirePermission } from "@/server/auth";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, text, type ActionState } from "@/server/admin";
import { WEEKDAYS, tehranIso } from "@/lib/jalali";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_STATUSES = ["active", "waitlist", "paused"] as const;
const todayIso = () => tehranIso(new Date());

function parsePackage(f: FormData): { plannedSessions: 6 | 7; termStartedOn: string } {
  const n = int(f, "plannedSessions");
  const plannedSessions = n === 6 ? 6 : 7;
  const raw = text(f, "termStartedOn");
  const termStartedOn = raw && ISO.test(raw) ? raw : todayIso();
  return { plannedSessions, termStartedOn };
}

/** Insert or revive an open enrollment (history rows for finished/dropped stay untouched). */
async function upsertOpenEnrollment(
  db: ReturnType<typeof getDb>,
  p: {
    tenantId: string;
    classGroupId: string;
    studentId: string;
    status: "active" | "waitlist";
    plannedSessions?: 6 | 7;
    termStartedOn?: string;
  },
) {
  const plannedSessions = p.plannedSessions ?? 7;
  const termStartedOn = p.termStartedOn ?? todayIso();
  const [open] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.classGroupId, p.classGroupId),
        eq(enrollments.studentId, p.studentId),
        inArray(enrollments.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1);
  if (open) {
    await db
      .update(enrollments)
      .set({ status: p.status, endedOn: null, plannedSessions, termStartedOn, startedOn: termStartedOn })
      .where(eq(enrollments.id, open.id));
    return;
  }
  await db.insert(enrollments).values({
    tenantId: p.tenantId,
    classGroupId: p.classGroupId,
    studentId: p.studentId,
    status: p.status,
    startedOn: termStartedOn,
    termStartedOn,
    plannedSessions,
    endedOn: null,
  });
}

export type ClassState = ActionState & { synced?: { added: number; removed: number }; conflicts?: { kind: "teacher" | "room"; title: string }[] };

export async function saveClass(_: ActionState, f: FormData): Promise<ClassState> {
  const user = await requirePermission("schedule.manage");
  const db = getDb();
  const tid = user.tenantId;
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const e: Record<string, string> = {};

  let title = text(f, "title");
  const courseId = text(f, "courseId");
  const teacherId = text(f, "teacherId");
  const branchId = text(f, "branchId");
  const weekday = int(f, "weekday");
  if (weekday === null || Number.isNaN(weekday) || weekday < 0 || weekday > 6) e["weekday"] = "required";
  const startTime = text(f, "startTime") ?? "";
  const endTime = text(f, "endTime") ?? "";
  if (!HHMM.test(startTime)) e["startTime"] = "time";
  if (!HHMM.test(endTime)) e["endTime"] = "time";
  if (!e["startTime"] && !e["endTime"] && endTime <= startTime) e["endTime"] = "time_order";
  const capacity = int(f, "capacity");
  if (capacity === null || Number.isNaN(capacity) || capacity < 1 || capacity > 200) e["capacity"] = "number";
  const startsOn = text(f, "startsOn");
  const endsOn = text(f, "endsOn");
  if (!startsOn || !ISO.test(startsOn)) e["startsOn"] = "required";
  if (endsOn && (!ISO.test(endsOn) || (startsOn && endsOn < startsOn))) e["endsOn"] = "range";
  const mode = z.enum(["in_person", "online", "hybrid"]).catch("in_person").parse(f.get("mode"));
  const onlineUrl = text(f, "onlineUrl");
  if (onlineUrl && !/^https:\/\//.test(onlineUrl)) e["onlineUrl"] = "https_required";
  const baleInviteUrl = text(f, "baleInviteUrl");
  if (baleInviteUrl && !/^https:\/\//.test(baleInviteUrl)) e["baleInviteUrl"] = "https_required";
  const telegramInviteUrl = text(f, "telegramInviteUrl");
  if (telegramInviteUrl && !/^https:\/\//.test(telegramInviteUrl)) e["telegramInviteUrl"] = "https_required";
  const roomId = text(f, "roomId");
  const termId = text(f, "termId");

  const owned = async (table: typeof courses | typeof teachers | typeof branches | typeof terms, rowId: string | null, key: string, required = false) => {
    if (!rowId) {
      if (required) e[key] = "required";
      return;
    }
    const rows = await db.select({ id: table.id }).from(table).where(and(eq(table.id, rowId), eq(table.tenantId, tid)));
    if (!rows.length) e[key] = "invalid";
  };
  await Promise.all([
    owned(courses, courseId, "courseId", true),
    owned(teachers, teacherId, "teacherId"),
    owned(branches, branchId, "branchId"),
    owned(terms, termId, "termId"),
  ]);
  if (roomId) {
    const r = await db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.tenantId, tid)));
    if (!r.length) e["roomId"] = "invalid";
  }
  if (Object.keys(e).length) return { error: "validation", fieldErrors: e };
  if (!title) {
    // No name typed: "<course>، <weekday>‌ها", the same text the form shows as a placeholder.
    const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId!));
    title = `${course?.title.fa ?? ""}، ${WEEKDAYS.fa[weekday!]}`;
  }

  // Same teacher or room at the same hours: warn first; the admin may save anyway.
  if (bool(f, "active") && !bool(f, "force")) {
    const clash = await classScheduleConflicts(db, tid, { id, teacherId, roomId: mode === "online" ? null : roomId, weekday: weekday!, startTime, endTime, startsOn: startsOn!, endsOn });
    if (clash.length) return { error: "conflict", conflicts: clash.map((c) => ({ kind: c.kind, title: c.title })) };
  }

  const values = {
    title: title.slice(0, 120),
    courseId: courseId!,
    teacherId,
    termId,
    branchId: mode === "online" ? null : branchId,
    roomId: mode === "online" ? null : roomId,
    weekday: weekday!,
    startTime,
    endTime,
    capacity: capacity!,
    startsOn: startsOn!,
    endsOn,
    mode,
    onlineUrl,
    baleInviteUrl,
    telegramInviteUrl,
    active: bool(f, "active"),
  };
  let rowId = id;
  if (id) {
    const res = await db.update(classGroups).set(values).where(and(eq(classGroups.id, id), eq(classGroups.tenantId, tid))).returning({ id: classGroups.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(classGroups).values({ ...values, tenantId: tid }).returning({ id: classGroups.id });
    rowId = row!.id;
  }
  const synced = await syncClassSessions(db, tid, rowId!);
  await audit(tid, user.userId, id ? "update" : "create", "class_group", rowId, { ...values, synced });
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/classes/${rowId}`));
  refresh();
  return { ok: true, savedAt: Date.now(), synced };
}

/** Adds a student to a class; when the class is full they go on the waitlist. */
export async function enrollStudent(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const classGroupId = z.uuid().parse(f.get("classGroupId"));
  const studentId = z.uuid().parse(f.get("studentId"));
  const db = getDb();
  const [c] = await db.select().from(classGroups).where(and(eq(classGroups.id, classGroupId), eq(classGroups.tenantId, user.tenantId)));
  const [s] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, studentId), eq(students.tenantId, user.tenantId)));
  if (!c || !s) return;
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(enrollments)
    .where(and(eq(enrollments.classGroupId, c.id), eq(enrollments.status, "active")));
  const status = n >= c.capacity ? ("waitlist" as const) : ("active" as const);
  const pack = parsePackage(f);
  await upsertOpenEnrollment(db, { tenantId: user.tenantId, classGroupId: c.id, studentId, status, ...pack });
  await audit(user.tenantId, user.userId, "create", "enrollment", c.id, { studentId, status, ...pack });
  refresh();
}

/** Edit the student's session package (6 or 7) and when counting starts. */
export async function updateEnrollmentTerm(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = z.uuid().parse(f.get("id"));
  const pack = parsePackage(f);
  const db = getDb();
  const res = await db
    .update(enrollments)
    .set({ plannedSessions: pack.plannedSessions, termStartedOn: pack.termStartedOn })
    .where(and(eq(enrollments.id, id), eq(enrollments.tenantId, user.tenantId)))
    .returning({ id: enrollments.id });
  if (res.length) await audit(user.tenantId, user.userId, "update", "enrollment", id, pack);
  refresh();
}

export async function setEnrollment(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = z.uuid().parse(f.get("id"));
  const status = z.enum(["active", "waitlist", "paused", "dropped", "finished"]).parse(f.get("status"));
  const db = getDb();
  const closed = status === "dropped" || status === "finished";
  const res = await db
    .update(enrollments)
    .set({ status, endedOn: closed ? todayIso() : null })
    .where(and(eq(enrollments.id, id), eq(enrollments.tenantId, user.tenantId)))
    .returning({ classGroupId: enrollments.classGroupId });
  if (res.length) await audit(user.tenantId, user.userId, "update", "enrollment", id, { status });
  refresh();
}

/** Adds several students at once (the picker on the class page). Students beyond the capacity go to the waitlist. */
export async function enrollStudents(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const classGroupId = z.uuid().parse(f.get("classGroupId"));
  const ids = [...new Set(f.getAll("studentId").map((v) => String(v)))].filter((v) => z.uuid().safeParse(v).success).slice(0, 60);
  if (!ids.length) return;
  const db = getDb();
  const [c] = await db.select().from(classGroups).where(and(eq(classGroups.id, classGroupId), eq(classGroups.tenantId, user.tenantId)));
  if (!c) return;
  const owned = await db.select({ id: students.id }).from(students).where(and(eq(students.tenantId, user.tenantId), inArray(students.id, ids)));
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(enrollments).where(and(eq(enrollments.classGroupId, c.id), eq(enrollments.status, "active")));
  const pack = parsePackage(f);
  let seats = Math.max(0, c.capacity - n);
  for (const s of owned) {
    const status = seats > 0 ? ("active" as const) : ("waitlist" as const);
    if (status === "active") seats--;
    await upsertOpenEnrollment(db, { tenantId: user.tenantId, classGroupId: c.id, studentId: s.id, status, ...pack });
  }
  await audit(user.tenantId, user.userId, "create", "enrollment", c.id, { count: owned.length, ...pack });
  refresh();
}

/** A brand-new student (with one parent) created from the class page and put in this class right away. */
export async function addNewStudentToClass(_: ActionState, f: FormData): Promise<ActionState & { name?: string }> {
  const user = await requirePermission("schedule.manage");
  await requirePermission("students.manage");
  const db = getDb();
  const classGroupId = z.uuid().parse(f.get("classGroupId"));
  const e: Record<string, string> = {};
  const firstName = text(f, "firstName");
  if (!firstName) e["firstName"] = "required";
  const birthYear = int(f, "birthYear");
  if (Number.isNaN(birthYear) || (birthYear !== null && (birthYear < 1370 || birthYear > 1420))) e["birthYear"] = "number";
  const phone = text(f, "guardianPhone");
  if (!phone || !normalizeIranMobile(phone)) e["guardianPhone"] = "phone";
  const [c] = await db.select().from(classGroups).where(and(eq(classGroups.id, classGroupId), eq(classGroups.tenantId, user.tenantId)));
  if (!c) return { error: "not_found" };
  if (Object.keys(e).length) return { error: "validation", fieldErrors: e };

  const sid = await db.transaction(async (tx) => {
    const [kid] = await tx
      .insert(students)
      .values({ tenantId: user.tenantId, firstName: firstName!.slice(0, 40), lastName: (text(f, "lastName") ?? "").slice(0, 60), birthYear })
      .returning({ id: students.id });
    const parent = (await findOrCreateUser(tx, user.tenantId, phone!, text(f, "guardianName")))!;
    await grantRole(tx, parent.id, "parent", null);
    await tx.insert(guardians).values({ studentId: kid!.id, userId: parent.id, relation: "other", mediaConsent: false });
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(enrollments).where(and(eq(enrollments.classGroupId, c.id), eq(enrollments.status, "active")));
    const pack = parsePackage(f);
    await tx.insert(enrollments).values({
      tenantId: user.tenantId,
      classGroupId: c.id,
      studentId: kid!.id,
      status: n >= c.capacity ? "waitlist" : "active",
      startedOn: pack.termStartedOn,
      termStartedOn: pack.termStartedOn,
      plannedSessions: pack.plannedSessions,
      endedOn: null,
    });
    return kid!.id;
  });
  await audit(user.tenantId, user.userId, "create", "student", sid, { firstName, classGroupId });
  refresh();
  return { ok: true, savedAt: Date.now(), name: firstName! };
}

/** Deletes a class that nothing has been recorded for (no attendance, no report). Otherwise deactivate it instead. */
export async function deleteClass(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = z.uuid().parse(f.get("id"));
  const lang = String(f.get("lang") ?? "fa");
  const db = getDb();
  const [c] = await db.select({ id: classGroups.id }).from(classGroups).where(and(eq(classGroups.id, id), eq(classGroups.tenantId, user.tenantId)));
  if (!c) return;
  const recorded = await db
    .select({ n: count() })
    .from(classSessions)
    .where(and(eq(classSessions.classGroupId, id), inArray(classSessions.status, ["held", "held_incomplete", "not_held", "needs_makeup"])));
  const hasAttendance = await db.select({ n: count() }).from(attendance).innerJoin(classSessions, eq(classSessions.id, attendance.sessionId)).where(eq(classSessions.classGroupId, id));
  if ((recorded[0]?.n ?? 0) > 0 || (hasAttendance[0]?.n ?? 0) > 0) return; // history exists: the admin should deactivate it
  await db.delete(classGroups).where(eq(classGroups.id, id));
  await audit(user.tenantId, user.userId, "delete", "class_group", id);
  redirect(href(isLocale(lang) ? lang : "fa", "/app/admin/classes"));
}
