"use server";

import { and, count, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { classGroups, getDb, teachers } from "@khaneyeidea/db";
import { findOrCreateUser, grantRole, normalizeIranMobile, setUserPassword } from "@khaneyeidea/core";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { saveTeacherPhotoFile } from "@/server/teacher-photo";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, json, localized, localizedSchema, optionalLocalized, text, type ActionState } from "@/server/admin";

export async function saveTeacher(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const errors: Record<string, string> = {};

  const name = localized(f, "name");
  if (!name.fa) errors["name"] = "fa_required";
  let specialties: { fa: string; en: string }[] = [];
  try {
    specialties = json(f, "specialties", z.array(localizedSchema).max(20)).filter((s) => s.fa || s.en);
  } catch {
    errors["specialties"] = "invalid";
  }

  let photo: string | null = text(f, "photo") || null;
  if (bool(f, "clearPhoto")) photo = null;
  const file = f.get("photoFile");
  if (file instanceof File && file.size > 0) {
    const saved = await saveTeacherPhotoFile(file);
    if (!saved.ok) errors["photo"] = saved.reason === "type" ? "photo_type" : "photo_size";
    else photo = saved.url;
  } else if (photo && !/^(https:\/\/|\/media\/)/.test(photo)) {
    errors["photo"] = "https_required";
  }

  const meetingUrl = text(f, "meetingUrl");
  if (meetingUrl && !/^https:\/\//.test(meetingUrl)) errors["meetingUrl"] = "https_required";
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = {
    name,
    role: optionalLocalized(f, "role"),
    bio: optionalLocalized(f, "bio"),
    specialties,
    showOnSite: bool(f, "showOnSite"),
    isSample: bool(f, "isSample"),
    photo,
    meetingUrl: meetingUrl || null,
  };
  let rowId = id;
  if (id) {
    const res = await db.update(teachers).set(values).where(and(eq(teachers.id, id), eq(teachers.tenantId, user.tenantId))).returning({ id: teachers.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(teachers).values({ ...values, tenantId: user.tenantId }).returning({ id: teachers.id });
    rowId = row!.id;
  }
  await audit(user.tenantId, user.userId, id ? "update" : "create", "teacher", rowId, values);
  updateTag(TAGS.teachers);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/teachers/${rowId}`));
  return { ok: true, savedAt: Date.now() };
}

/** Removes a coach that teaches no class. (A coach with classes must be replaced in those classes first.) */
export async function deleteTeacher(f: FormData) {
  const user = await requirePermission("content.edit");
  const id = z.uuid().parse(f.get("id"));
  const lang = String(f.get("lang") ?? "fa");
  const db = getDb();
  const used = await db.select({ n: count() }).from(classGroups).where(and(eq(classGroups.teacherId, id), eq(classGroups.tenantId, user.tenantId)));
  if ((used[0]?.n ?? 0) > 0) return;
  const res = await db.delete(teachers).where(and(eq(teachers.id, id), eq(teachers.tenantId, user.tenantId))).returning({ id: teachers.id });
  if (res.length) {
    await audit(user.tenantId, user.userId, "delete", "teacher", id);
    updateTag(TAGS.teachers);
  }
  redirect(href(isLocale(lang) ? lang : "fa", "/app/admin/teachers"));
}

/** Username and first password for the teacher app. The teacher must change the password after signing in. */
export async function setTeacherLogin(_: ActionState, f: FormData): Promise<ActionState> {
  const admin = await requirePermission("content.edit");
  const db = getDb();
  const teacherId = text(f, "teacherId");
  if (!teacherId) return { error: "not_found" };
  const [teacher] = await db.select().from(teachers).where(and(eq(teachers.id, teacherId), eq(teachers.tenantId, admin.tenantId)));
  if (!teacher) return { error: "not_found" };
  let userId = teacher.userId;
  const phone = text(f, "phone") ?? "";
  if (!userId) {
    if (!normalizeIranMobile(phone)) return { error: "validation", fieldErrors: { phone: "invalid_phone" } };
    const account = await findOrCreateUser(db, admin.tenantId, phone, teacher.name.fa);
    if (!account) return { error: "validation", fieldErrors: { phone: "invalid_phone" } };
    userId = account.id;
    await grantRole(db, userId, "teacher", null);
    await db.update(teachers).set({ userId }).where(eq(teachers.id, teacher.id));
  }
  const username = text(f, "username") ?? "";
  const password = text(f, "password") ?? "";
  const result = await setUserPassword(db, { tenantId: admin.tenantId, userId, username, password, mustChange: true });
  if (!result.ok) return { error: "validation", fieldErrors: { username: result.reason } };
  await audit(admin.tenantId, admin.userId, "update", "teacher_login", teacher.id, { username });
  return { ok: true, savedAt: Date.now() };
}
