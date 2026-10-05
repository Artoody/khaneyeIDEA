import "server-only";
import { asc, eq } from "drizzle-orm";
import { branches, departments, getDb } from "@khaneyeidea/db";
import { pick, type Locale } from "@/lib/i18n";

/** Department and branch choices for the course form, tenant-scoped. */
export async function courseOptions(tenantId: string, lang: Locale) {
  const db = getDb();
  const [deps, brs] = await Promise.all([
    db.select({ id: departments.id, title: departments.title }).from(departments).where(eq(departments.tenantId, tenantId)).orderBy(asc(departments.sortOrder)),
    db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.tenantId, tenantId)).orderBy(asc(branches.sortOrder)),
  ]);
  return {
    departments: deps.map((d) => ({ id: d.id, label: pick(d.title, lang) })),
    branches: brs.map((b) => ({ id: b.id, label: pick(b.name, lang) })),
  };
}
