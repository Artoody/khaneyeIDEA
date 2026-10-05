"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { branches, courseBranches, courses, departments, getDb } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { href, isLocale } from "@/lib/i18n";
import { audit, int, json, localized, localizedSchema, optionalLocalized, slugSchema, text, type ActionState } from "@/server/admin";

const MODES = ["in_person", "online", "hybrid"] as const;

export async function saveCourse(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const errors: Record<string, string> = {};

  const title = localized(f, "title");
  if (!title.fa) errors["title"] = "fa_required";
  const slug = (text(f, "slug") ?? "").toLowerCase();
  if (!slugSchema.safeParse(slug).success) errors["slug"] = "slug";

  const nums = { ageMin: int(f, "ageMin"), ageMax: int(f, "ageMax"), sessionsCount: int(f, "sessionsCount"), durationWeeks: int(f, "durationWeeks"), price: int(f, "price"), sortOrder: int(f, "sortOrder") };
  for (const [k, v] of Object.entries(nums)) if (Number.isNaN(v) || (v !== null && v < 0)) errors[k] = "number";
  if (nums.ageMin !== null && nums.ageMax !== null && nums.ageMin > nums.ageMax) errors["ageMax"] = "number";

  const modes = f.getAll("modes").filter((m): m is (typeof MODES)[number] => (MODES as readonly string[]).includes(String(m)));
  const priceVisibility = z.enum(["show", "hide", "contact"]).catch("contact").parse(f.get("priceVisibility"));
  const status = z.enum(["draft", "published"]).catch("draft").parse(f.get("status"));
  let syllabus: { fa: string; en: string }[] = [];
  try {
    syllabus = json(f, "syllabus", z.array(localizedSchema).max(80)).filter((s) => s.fa || s.en);
  } catch {
    errors["syllabus"] = "invalid";
  }

  // Referenced rows must belong to this tenant.
  const departmentId = text(f, "departmentId");
  if (departmentId) {
    const ok = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, departmentId), eq(departments.tenantId, user.tenantId)));
    if (!ok.length) errors["departmentId"] = "invalid";
  }
  const branchIds = f.getAll("branchIds").map(String);
  if (branchIds.length) {
    const ok = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.tenantId, user.tenantId), inArray(branches.id, branchIds)));
    if (ok.length !== branchIds.length) errors["branchIds"] = "invalid";
  }
  if (!errors["slug"]) {
    const clash = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.tenantId, user.tenantId), eq(courses.slug, slug), id ? ne(courses.id, id) : undefined));
    if (clash.length) errors["slug"] = "slug_taken";
  }
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = {
    slug,
    title,
    departmentId,
    summary: optionalLocalized(f, "summary"),
    body: optionalLocalized(f, "body"),
    prerequisites: optionalLocalized(f, "prerequisites"),
    level: text(f, "level"),
    ageMin: nums.ageMin,
    ageMax: nums.ageMax,
    sessionsCount: nums.sessionsCount,
    durationWeeks: nums.durationWeeks,
    price: nums.price,
    priceVisibility,
    modes,
    syllabus,
    status,
    sortOrder: nums.sortOrder ?? 0,
    seo: { title: localized(f, "seoTitle"), description: localized(f, "seoDescription") },
  };

  const courseId = await db.transaction(async (tx) => {
    let cid = id;
    if (cid) {
      const res = await tx.update(courses).set(values).where(and(eq(courses.id, cid), eq(courses.tenantId, user.tenantId))).returning({ id: courses.id });
      if (!res.length) return null;
    } else {
      const [row] = await tx.insert(courses).values({ ...values, tenantId: user.tenantId }).returning({ id: courses.id });
      cid = row!.id;
    }
    await tx.delete(courseBranches).where(eq(courseBranches.courseId, cid));
    if (branchIds.length) await tx.insert(courseBranches).values(branchIds.map((branchId) => ({ courseId: cid!, branchId })));
    return cid;
  });
  if (!courseId) return { error: "not_found" };
  await audit(user.tenantId, user.userId, id ? "update" : "create", "course", courseId, { ...values, branchIds });
  updateTag(TAGS.catalog);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/courses/${courseId}`));
  return { ok: true, savedAt: Date.now() };
}
