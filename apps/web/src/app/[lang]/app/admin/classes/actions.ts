"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { branches, classGroups, courses, enrollments, getDb, rooms, students, teachers } from "@khaneyeidea/db";
import { classScheduleConflicts, syncClassSessions } from "@khaneyeidea/core";
import { requirePermission } from "@/server/auth";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, text, type ActionState } from "@/server/admin";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type ClassState = ActionState & { synced?: { added: number; removed: number }; conflicts?: { kind: "teacher" | "room"; title: string }[] };

export async function saveClass(_: ActionState, f: FormData): Promise<ClassState> {
  const user = await requirePermission("schedule.manage");
  const db = getDb();
  const tid = user.tenantId;
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const e: Record<string, string> = {};

  const title = text(f, "title");
  if (!title) e["title"] = "required";
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

  const owned = async (table: typeof courses | typeof teachers | typeof branches, rowId: string | null, key: string, required = false) => {
    if (!rowId) {
      if (required) e[key] = "required";
      return;
    }
    const rows = await db.select({ id: table.id }).from(table).where(and(eq(table.id, rowId), eq(table.tenantId, tid)));
    if (!rows.length) e[key] = "invalid";
  };
  await Promise.all([owned(courses, courseId, "courseId", true), owned(teachers, teacherId, "teacherId"), owned(branches, branchId, "branchId")]);
  if (roomId) {
    const r = await db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.tenantId, tid)));
    if (!r.length) e["roomId"] = "invalid";
  }
  if (Object.keys(e).length) return { error: "validation", fieldErrors: e };

  // Same teacher or room at the same hours: warn first; the admin may save anyway.
  if (bool(f, "active") && !bool(f, "force")) {
    const clash = await classScheduleConflicts(db, tid, { id, teacherId, roomId: mode === "online" ? null : roomId, weekday: weekday!, startTime, endTime, startsOn: startsOn!, endsOn });
    if (clash.length) return { error: "conflict", conflicts: clash.map((c) => ({ kind: c.kind, title: c.title })) };
  }

  const values = {
    title: title!.slice(0, 120),
    courseId: courseId!,
    teacherId,
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
  await db
    .insert(enrollments)
    .values({ tenantId: user.tenantId, classGroupId: c.id, studentId, status, startedOn: new Date().toISOString().slice(0, 10) })
    .onConflictDoUpdate({ target: [enrollments.classGroupId, enrollments.studentId], set: { status } });
  await audit(user.tenantId, user.userId, "create", "enrollment", c.id, { studentId, status });
  refresh();
}

export async function setEnrollment(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = z.uuid().parse(f.get("id"));
  const status = z.enum(["active", "waitlist", "dropped"]).parse(f.get("status"));
  const db = getDb();
  const res = await db
    .update(enrollments)
    .set({ status })
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
  let seats = Math.max(0, c.capacity - n);
  for (const s of owned) {
    const status = seats > 0 ? ("active" as const) : ("waitlist" as const);
    if (status === "active") seats--;
    await db
      .insert(enrollments)
      .values({ tenantId: user.tenantId, classGroupId: c.id, studentId: s.id, status, startedOn: new Date().toISOString().slice(0, 10) })
      .onConflictDoUpdate({ target: [enrollments.classGroupId, enrollments.studentId], set: { status } });
  }
  await audit(user.tenantId, user.userId, "create", "enrollment", c.id, { count: owned.length });
  refresh();
}
