import "server-only";
import { asc, eq } from "drizzle-orm";
import { appointmentTypes, branches, courses, departments, getDb } from "@khaneyeidea/db";
import { pick, type Locale } from "@/lib/i18n";
import { toJalali, tehranIso } from "@/lib/jalali";

export async function templateOptions(tenantId: string, lang: Locale) {
  const db = getDb();
  const [types, brs, deps, crs] = await Promise.all([
    db.select().from(appointmentTypes).where(eq(appointmentTypes.tenantId, tenantId)).orderBy(asc(appointmentTypes.sortOrder)),
    db.select().from(branches).where(eq(branches.tenantId, tenantId)).orderBy(asc(branches.sortOrder)),
    db.select().from(departments).where(eq(departments.tenantId, tenantId)).orderBy(asc(departments.sortOrder)),
    db.select().from(courses).where(eq(courses.tenantId, tenantId)).orderBy(asc(courses.sortOrder)),
  ]);
  return {
    types: types.map((t) => ({ id: t.id, label: pick(t.title, lang) })),
    branches: brs.map((b) => ({ id: b.id, label: pick(b.name, lang) })),
    departments: deps.map((d) => ({ id: d.id, label: pick(d.title, lang) })),
    courses: crs.map((c) => ({ id: c.id, label: pick(c.title, lang) })),
  };
}

/** This Jalali year and the next two, for date pickers. */
export function jalaliYears() {
  const y = toJalali(tehranIso(new Date())).y;
  return [y, y + 1, y + 2];
}
