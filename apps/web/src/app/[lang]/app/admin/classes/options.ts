import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { branches, courses, getDb, rooms, teachers, terms } from "@khaneyeidea/db";
import { pick, type Locale } from "@/lib/i18n";

export async function classOptions(tenantId: string, lang: Locale) {
  const db = getDb();
  const [cs, ts, bs, rs, tms] = await Promise.all([
    db.select().from(courses).where(eq(courses.tenantId, tenantId)).orderBy(asc(courses.sortOrder)),
    db.select().from(teachers).where(eq(teachers.tenantId, tenantId)).orderBy(asc(teachers.sortOrder)),
    db.select().from(branches).where(eq(branches.tenantId, tenantId)).orderBy(asc(branches.sortOrder)),
    db.select().from(rooms).where(and(eq(rooms.tenantId, tenantId), eq(rooms.active, true))).orderBy(asc(rooms.name)),
    db.select().from(terms).where(eq(terms.tenantId, tenantId)).orderBy(desc(terms.startsOn)),
  ]);
  return {
    // published courses first, drafts (marked *) after
    courses: [...cs].sort((a, b) => Number(a.status === "draft") - Number(b.status === "draft")).map((c) => ({ id: c.id, label: `${pick(c.title, lang)}${c.status === "draft" ? " *" : ""}` })),
    teachers: ts.map((x) => ({ id: x.id, label: pick(x.name, lang) })),
    branches: bs.map((b) => ({ id: b.id, label: pick(b.name, lang) })),
    rooms: rs.map((r) => ({ id: r.id, label: r.name, branchId: r.branchId })),
    terms: tms.map((t) => ({ id: t.id, label: pick(t.name, lang) })),
  };
}
