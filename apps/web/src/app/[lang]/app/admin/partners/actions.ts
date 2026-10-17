"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, partners } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, localized, text, type ActionState } from "@/server/admin";

export async function savePartner(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const errors: Record<string, string> = {};
  const name = localized(f, "name");
  if (!name.fa) errors.name = "fa_required";
  const logoUrl = text(f, "logoUrl") ?? "";
  if (!logoUrl.trim()) errors.logoUrl = "required";
  const sortOrder = int(f, "sortOrder");
  if (Number.isNaN(sortOrder)) errors.sortOrder = "number";
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = {
    name,
    logoUrl: logoUrl.trim(),
    url: text(f, "url"),
    active: bool(f, "active"),
    sortOrder: sortOrder ?? 0,
  };
  let rowId = id;
  if (id) {
    const res = await db
      .update(partners)
      .set(values)
      .where(and(eq(partners.id, id), eq(partners.tenantId, user.tenantId)))
      .returning({ id: partners.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(partners).values({ ...values, tenantId: user.tenantId }).returning({ id: partners.id });
    rowId = row!.id;
  }
  await audit(user.tenantId, user.userId, id ? "update" : "create", "partner", rowId, values);
  updateTag(TAGS.partners);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/partners/${rowId}`));
  return { ok: true, savedAt: Date.now() };
}
