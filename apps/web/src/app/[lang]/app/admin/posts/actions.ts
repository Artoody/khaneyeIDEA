"use server";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, posts } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { href, isLocale } from "@/lib/i18n";
import { audit, localized, optionalLocalized, slugSchema, text, type ActionState } from "@/server/admin";

export async function savePost(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const e: Record<string, string> = {};

  const title = localized(f, "title");
  if (!title.fa) e["title"] = "fa_required";
  const body = localized(f, "body");
  if (!body.fa) e["body"] = "fa_required";
  if (body.fa.length > 200_000 || body.en.length > 200_000) e["body"] = "too_long";
  const slug = (text(f, "slug") ?? "").toLowerCase();
  if (!slugSchema.safeParse(slug).success) e["slug"] = "slug";
  const cover = text(f, "coverImage");
  if (cover && !/^(https:\/\/|\/media\/)/.test(cover)) e["coverImage"] = "https_required";
  const date = text(f, "publishedAt");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) e["publishedAt"] = "invalid";
  if (!e["slug"]) {
    const clash = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.tenantId, user.tenantId), eq(posts.slug, slug), id ? ne(posts.id, id) : undefined));
    if (clash.length) e["slug"] = "slug_taken";
  }
  if (Object.keys(e).length) return { error: "validation", fieldErrors: e };

  const status = z.enum(["draft", "published"]).catch("draft").parse(f.get("status"));
  const values = {
    slug,
    title,
    excerpt: optionalLocalized(f, "excerpt"),
    body,
    coverImage: cover,
    status,
    // A published article without a date gets today's.
    publishedAt: date ? new Date(`${date}T08:30:00Z`) : status === "published" ? new Date() : null,
    seo: { title: localized(f, "seoTitle"), description: localized(f, "seoDescription") },
  };
  let rowId = id;
  if (id) {
    const res = await db.update(posts).set(values).where(and(eq(posts.id, id), eq(posts.tenantId, user.tenantId))).returning({ id: posts.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(posts).values({ ...values, tenantId: user.tenantId }).returning({ id: posts.id });
    rowId = row!.id;
  }
  await audit(user.tenantId, user.userId, id ? "update" : "create", "post", rowId, { ...values, body: `${values.body.fa.length} chars` });
  updateTag(TAGS.posts);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/posts/${rowId}`));
  return { ok: true, savedAt: Date.now() };
}
