import "server-only";
import { asc, eq } from "drizzle-orm";
import { branches, courses, getDb, teachers } from "@khaneyeidea/db";
import { pick, type Locale } from "@/lib/i18n";

export async function classOptions(tenantId: string, lang: Locale) {
  const db = getDb();
  const [cs, ts, bs] = await Promise.all([
    db.select().from(courses).where(eq(courses.tenantId, tenantId)).orderBy(asc(courses.sortOrder)),
    db.select().from(teachers).where(eq(teachers.tenantId, tenantId)).orderBy(asc(teachers.sortOrder)),
    db.select().from(branches).where(eq(branches.tenantId, tenantId)).orderBy(asc(branches.sortOrder)),
  ]);
  return {
    courses: cs.map((c) => ({ id: c.id, label: `${pick(c.title, lang)}${c.status === "draft" ? " *" : ""}` })),
    teachers: ts.map((x) => ({ id: x.id, label: pick(x.name, lang) })),
    branches: bs.map((b) => ({ id: b.id, label: pick(b.name, lang) })),
  };
}
