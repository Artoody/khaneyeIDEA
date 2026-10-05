"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { achievements, getDb } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, localized, optionalLocalized, text, type ActionState } from "@/server/admin";

export async function saveAchievement(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const errors: Record<string, string> = {};

  const title = localized(f, "title");
  if (!title.fa) errors["title"] = "fa_required";
  const year = int(f, "year");
  if (Number.isNaN(year) || (year !== null && (year < 1990 || year > 2100))) errors["year"] = "number";
  const sortOrder = int(f, "sortOrder");
  if (Number.isNaN(sortOrder)) errors["sortOrder"] = "number";
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = {
    title,
    competition: text(f, "competition"),
    year,
    country: optionalLocalized(f, "country"),
    rank: text(f, "rank"),
    scope: z.enum(["world", "asia", "national"]).nullable().catch(null).parse(text(f, "scope")),
    featured: bool(f, "featured"),
    sortOrder: sortOrder ?? 0,
  };
  let rowId = id;
  if (id) {
    const res = await db.update(achievements).set(values).where(and(eq(achievements.id, id), eq(achievements.tenantId, user.tenantId))).returning({ id: achievements.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(achievements).values({ ...values, tenantId: user.tenantId }).returning({ id: achievements.id });
    rowId = row!.id;
  }
  await audit(user.tenantId, user.userId, id ? "update" : "create", "achievement", rowId, values);
  updateTag(TAGS.achievements);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/achievements/${rowId}`));
  return { ok: true, savedAt: Date.now() };
}
