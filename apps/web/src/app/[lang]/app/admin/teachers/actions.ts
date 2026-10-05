"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, teachers } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, json, localized, localizedSchema, optionalLocalized, text, type ActionState } from "@/server/admin";

export async function saveTeacher(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const errors: Record<string, string> = {};

  const name = localized(f, "name");
  if (!name.fa) errors["name"] = "fa_required";
  const sortOrder = int(f, "sortOrder");
  if (Number.isNaN(sortOrder)) errors["sortOrder"] = "number";
  let specialties: { fa: string; en: string }[] = [];
  try {
    specialties = json(f, "specialties", z.array(localizedSchema).max(20)).filter((s) => s.fa || s.en);
  } catch {
    errors["specialties"] = "invalid";
  }
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = {
    name,
    role: optionalLocalized(f, "role"),
    bio: optionalLocalized(f, "bio"),
    specialties,
    showOnSite: bool(f, "showOnSite"),
    isSample: bool(f, "isSample"),
    sortOrder: sortOrder ?? 0,
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
