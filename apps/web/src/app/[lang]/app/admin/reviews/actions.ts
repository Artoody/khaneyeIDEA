"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, siteReviews } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, localized, text, type ActionState } from "@/server/admin";

export async function saveReview(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const errors: Record<string, string> = {};
  const authorName = localized(f, "authorName");
  const body = localized(f, "body");
  if (!authorName.fa) errors.authorName = "fa_required";
  if (!body.fa) errors.body = "fa_required";
  const sortOrder = int(f, "sortOrder");
  if (Number.isNaN(sortOrder)) errors.sortOrder = "number";
  const statusRaw = text(f, "status") ?? "pending";
  if (!["pending", "published", "rejected"].includes(statusRaw)) errors.status = "invalid";
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = {
    authorName,
    body,
    status: statusRaw as "pending" | "published" | "rejected",
    featured: bool(f, "featured"),
    sortOrder: sortOrder ?? 0,
  };
  let rowId = id;
  if (id) {
    const res = await db
      .update(siteReviews)
      .set(values)
      .where(and(eq(siteReviews.id, id), eq(siteReviews.tenantId, user.tenantId)))
      .returning({ id: siteReviews.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(siteReviews).values({ ...values, tenantId: user.tenantId }).returning({ id: siteReviews.id });
    rowId = row!.id;
  }
  await audit(user.tenantId, user.userId, id ? "update" : "create", "site_review", rowId, values);
  updateTag(TAGS.reviews);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/reviews/${rowId}`));
  return { ok: true, savedAt: Date.now() };
}

export async function setReviewStatus(form: FormData): Promise<void> {
  const user = await requirePermission("content.edit");
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!id || !["published", "rejected", "pending"].includes(status)) return;
  await getDb()
    .update(siteReviews)
    .set({ status: status as "pending" | "published" | "rejected" })
    .where(and(eq(siteReviews.id, id), eq(siteReviews.tenantId, user.tenantId)));
  await audit(user.tenantId, user.userId, "update", "site_review", id, { status });
  updateTag(TAGS.reviews);
}
