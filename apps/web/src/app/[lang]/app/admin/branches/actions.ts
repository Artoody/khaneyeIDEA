"use server";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { branches, getDb } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, localized, optionalLocalized, slugSchema, text, type ActionState } from "@/server/admin";

export async function saveBranch(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const errors: Record<string, string> = {};

  const name = localized(f, "name");
  if (!name.fa) errors["name"] = "fa_required";
  const slug = (text(f, "slug") ?? "").toLowerCase();
  if (!slugSchema.safeParse(slug).success) errors["slug"] = "slug";
  const mapUrl = text(f, "mapUrl");
  if (mapUrl && !/^https:\/\//.test(mapUrl)) errors["mapUrl"] = "https_required";
  const sortOrder = int(f, "sortOrder") ?? 0;
  if (Number.isNaN(sortOrder)) errors["sortOrder"] = "number";

  const db = getDb();
  if (!errors["slug"]) {
    const clash = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.tenantId, user.tenantId), eq(branches.slug, slug), id ? ne(branches.id, id) : undefined));
    if (clash.length) errors["slug"] = "slug_taken";
  }
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = {
    slug,
    name,
    district: optionalLocalized(f, "district"),
    address: optionalLocalized(f, "address"),
    hours: optionalLocalized(f, "hours"),
    phone: text(f, "phone"),
    mapUrl,
    appointmentOnly: bool(f, "appointmentOnly"),
    active: bool(f, "active"),
    sortOrder,
  };

  if (id) {
    const res = await db
      .update(branches)
      .set(values)
      .where(and(eq(branches.id, id), eq(branches.tenantId, user.tenantId)))
      .returning({ id: branches.id });
    if (!res.length) return { error: "not_found" };
    await audit(user.tenantId, user.userId, "update", "branch", id, values);
  } else {
    const [row] = await db.insert(branches).values({ ...values, tenantId: user.tenantId }).returning({ id: branches.id });
    await audit(user.tenantId, user.userId, "create", "branch", row!.id, values);
  }
  updateTag(TAGS.branches);
  updateTag(TAGS.stats);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", "/app/admin/branches"));
  return { ok: true, savedAt: Date.now() };
}
