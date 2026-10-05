"use server";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { departments, getDb } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { href, isLocale } from "@/lib/i18n";
import { DEPT_ICON_KEYS } from "@/lib/dept-icons";
import { audit, bool, int, localized, optionalLocalized, slugSchema, text, type ActionState } from "@/server/admin";

export async function saveDepartment(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const errors: Record<string, string> = {};

  const title = localized(f, "title");
  if (!title.fa) errors["title"] = "fa_required";
  const slug = (text(f, "slug") ?? "").toLowerCase();
  if (!slugSchema.safeParse(slug).success) errors["slug"] = "slug";
  const sortOrder = int(f, "sortOrder");
  if (Number.isNaN(sortOrder)) errors["sortOrder"] = "number";
  const icon = text(f, "icon");
  const safeIcon = icon && (DEPT_ICON_KEYS as readonly string[]).includes(icon) ? icon : null;
  if (!errors["slug"]) {
    const clash = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.tenantId, user.tenantId), eq(departments.slug, slug), id ? ne(departments.id, id) : undefined));
    if (clash.length) errors["slug"] = "slug_taken";
  }
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = { slug, title, description: optionalLocalized(f, "description"), icon: safeIcon, active: bool(f, "active"), sortOrder: sortOrder ?? 0 };
  let rowId = id;
  if (id) {
    const res = await db.update(departments).set(values).where(and(eq(departments.id, id), eq(departments.tenantId, user.tenantId))).returning({ id: departments.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(departments).values({ ...values, tenantId: user.tenantId }).returning({ id: departments.id });
    rowId = row!.id;
  }
  await audit(user.tenantId, user.userId, id ? "update" : "create", "department", rowId, values);
  updateTag(TAGS.catalog);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/departments/${rowId}`));
  return { ok: true, savedAt: Date.now() };
}
