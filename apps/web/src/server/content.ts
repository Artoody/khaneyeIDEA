import "server-only";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import {
  achievements,
  branches,
  courseBranches,
  courses,
  departments,
  getDb,
  pageBlocks,
  siteSettings,
  students,
  teachers,
  tenants,
} from "@khaneyeidea/db";

// Public read model. Everything is cached and tagged; admin mutations call updateTag(...) on the same tags,
// so edits appear on the site immediately while visitors get static-speed pages.
export const TAGS = {
  settings: "content:settings",
  blocks: "content:blocks",
  branches: "content:branches",
  catalog: "content:catalog",
  achievements: "content:achievements",
  teachers: "content:teachers",
  stats: "content:stats",
} as const;

export async function tenantId(): Promise<string> {
  "use cache";
  cacheLife("max");
  const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";
  const [t] = await getDb().select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug));
  if (!t) throw new Error(`Tenant "${slug}" not found. Run: pnpm db:migrate && pnpm db:seed`);
  return t.id;
}

export async function getSettings() {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("days");
  const [s] = await getDb().select().from(siteSettings).where(eq(siteSettings.tenantId, await tenantId()));
  if (!s) throw new Error("site_settings missing for tenant");
  return s;
}

export async function getBlocks() {
  "use cache";
  cacheTag(TAGS.blocks);
  cacheLife("days");
  const rows = await getDb().select().from(pageBlocks).where(eq(pageBlocks.tenantId, await tenantId()));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getBranches() {
  "use cache";
  cacheTag(TAGS.branches);
  cacheLife("days");
  return getDb()
    .select()
    .from(branches)
    .where(and(eq(branches.tenantId, await tenantId()), eq(branches.active, true)))
    .orderBy(asc(branches.sortOrder));
}

export async function getDepartmentsWithCounts() {
  "use cache";
  cacheTag(TAGS.catalog);
  cacheLife("days");
  const db = getDb();
  const tid = await tenantId();
  const depts = await db
    .select()
    .from(departments)
    .where(and(eq(departments.tenantId, tid), eq(departments.active, true)))
    .orderBy(asc(departments.sortOrder));
  const counts = await db
    .select({ departmentId: courses.departmentId, n: count() })
    .from(courses)
    .where(and(eq(courses.tenantId, tid), eq(courses.status, "published")))
    .groupBy(courses.departmentId);
  const byDept = new Map(counts.map((c) => [c.departmentId, c.n]));
  const published = await db
    .select({ id: courses.id, slug: courses.slug, title: courses.title, departmentId: courses.departmentId })
    .from(courses)
    .where(and(eq(courses.tenantId, tid), eq(courses.status, "published")))
    .orderBy(asc(courses.sortOrder));
  return depts.map((d) => ({
    ...d,
    courseCount: byDept.get(d.id) ?? 0,
    courses: published.filter((c) => c.departmentId === d.id),
  }));
}

export async function getFeaturedAchievements(limit = 12) {
  "use cache";
  cacheTag(TAGS.achievements);
  cacheLife("days");
  return getDb()
    .select()
    .from(achievements)
    .where(and(eq(achievements.tenantId, await tenantId()), eq(achievements.featured, true)))
    .orderBy(asc(achievements.sortOrder))
    .limit(limit);
}

/** Every number shown on the site is computed here from real rows (rule: no fake numbers). */
export async function getStats() {
  "use cache";
  cacheTag(TAGS.stats, TAGS.achievements, TAGS.branches, TAGS.settings);
  cacheLife("hours");
  const db = getDb();
  const tid = await tenantId();
  const [all] = await db.select({ n: count() }).from(achievements).where(eq(achievements.tenantId, tid));
  const [world] = await db
    .select({ n: count() })
    .from(achievements)
    .where(and(eq(achievements.tenantId, tid), eq(achievements.scope, "world"), inArray(achievements.rank, ["1", "gold"])));
  const [br] = await db
    .select({ n: count() })
    .from(branches)
    .where(and(eq(branches.tenantId, tid), eq(branches.active, true)));
  const [st] = await db.select({ n: count() }).from(students).where(eq(students.tenantId, tid));
  const settings = await getSettings();
  return {
    achievements: all?.n ?? 0,
    worldFirsts: world?.n ?? 0,
    branches: br?.n ?? 0,
    students: st?.n ?? 0,
    yearsActive: settings.stats.yearsActive ?? null,
  };
}

export async function getTeachers() {
  "use cache";
  cacheTag(TAGS.teachers);
  cacheLife("days");
  const rows = await getDb()
    .select()
    .from(teachers)
    .where(and(eq(teachers.tenantId, await tenantId()), eq(teachers.showOnSite, true)))
    .orderBy(asc(teachers.sortOrder));
  // Sample profiles never reach the production site.
  return process.env.NODE_ENV === "production" ? rows.filter((t) => !t.isSample) : rows;
}

/** Published courses with their department, for the catalog page. */
export async function getCatalog() {
  "use cache";
  cacheTag(TAGS.catalog);
  cacheLife("days");
  const db = getDb();
  const tid = await tenantId();
  const [rows, depts] = await Promise.all([
    db
      .select()
      .from(courses)
      .where(and(eq(courses.tenantId, tid), eq(courses.status, "published")))
      .orderBy(asc(courses.sortOrder)),
    db
      .select()
      .from(departments)
      .where(and(eq(departments.tenantId, tid), eq(departments.active, true)))
      .orderBy(asc(departments.sortOrder)),
  ]);
  const active = new Set(depts.map((d) => d.id));
  return {
    // A course in an inactive department is hidden with its department.
    courses: rows.filter((c) => !c.departmentId || active.has(c.departmentId)),
    departments: depts,
  };
}

export async function getPublishedCourseSlugs() {
  "use cache";
  cacheTag(TAGS.catalog);
  cacheLife("days");
  const rows = await getDb()
    .select({ slug: courses.slug })
    .from(courses)
    .where(and(eq(courses.tenantId, await tenantId()), eq(courses.status, "published")));
  return rows.map((r) => r.slug);
}

/** One published course with its department, the active branches that offer it and sibling courses. */
export async function getCourse(slug: string) {
  "use cache";
  cacheTag(TAGS.catalog, TAGS.branches);
  cacheLife("days");
  const db = getDb();
  const tid = await tenantId();
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.tenantId, tid), eq(courses.slug, slug), eq(courses.status, "published")));
  if (!course) return null;
  const [dept] = course.departmentId
    ? await db.select().from(departments).where(and(eq(departments.id, course.departmentId), eq(departments.active, true)))
    : [];
  if (course.departmentId && !dept) return null;
  const [offered, siblings] = await Promise.all([
    db
      .select({ b: branches })
      .from(courseBranches)
      .innerJoin(branches, eq(branches.id, courseBranches.branchId))
      .where(and(eq(courseBranches.courseId, course.id), eq(branches.active, true)))
      .orderBy(asc(branches.sortOrder)),
    course.departmentId
      ? db
          .select({ slug: courses.slug, title: courses.title, ageMin: courses.ageMin, ageMax: courses.ageMax })
          .from(courses)
          .where(and(eq(courses.tenantId, tid), eq(courses.departmentId, course.departmentId), eq(courses.status, "published"), ne(courses.id, course.id)))
          .orderBy(asc(courses.sortOrder))
      : Promise.resolve([]),
  ]);
  return { course, department: dept ?? null, branches: offered.map((o) => o.b), siblings };
}

export async function getAllAchievements() {
  "use cache";
  cacheTag(TAGS.achievements);
  cacheLife("days");
  return getDb()
    .select()
    .from(achievements)
    .where(eq(achievements.tenantId, await tenantId()))
    .orderBy(desc(achievements.year), desc(achievements.featured), asc(achievements.sortOrder));
}
