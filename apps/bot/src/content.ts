import { and, asc, eq } from "drizzle-orm";
import { branches, courses, departments, getDb, siteSettings, tenants } from "@khaneyeidea/db";

// Read-only views of the same content the site shows (edited in the admin panel). Cached for a minute.
const TTL = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function tenantId() {
  return cached("tenant", async () => {
    const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";
    const [t] = await getDb().select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug));
    if (!t) throw new Error(`tenant "${slug}" not found; run pnpm db:migrate && pnpm db:seed`);
    return t.id;
  });
}

export const getSettings = () =>
  cached("settings", async () => (await getDb().select().from(siteSettings).where(eq(siteSettings.tenantId, await tenantId())))[0]!);

export const getBranches = () =>
  cached("branches", async () =>
    getDb()
      .select()
      .from(branches)
      .where(and(eq(branches.tenantId, await tenantId()), eq(branches.active, true)))
      .orderBy(asc(branches.sortOrder)),
  );

export const getCourses = () =>
  cached("courses", async () =>
    getDb()
      .select({ slug: courses.slug, title: courses.title, ageMin: courses.ageMin, ageMax: courses.ageMax, dept: departments.title, deptOrder: departments.sortOrder })
      .from(courses)
      .leftJoin(departments, eq(departments.id, courses.departmentId))
      .where(and(eq(courses.tenantId, await tenantId()), eq(courses.status, "published")))
      .orderBy(asc(departments.sortOrder), asc(courses.sortOrder)),
  );
