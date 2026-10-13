// Adds the academy's real coaches (safe to run again) and removes sample coaches that no class uses.
//   pnpm --filter @khaneyeidea/db team
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { classGroups, closeDb, getDb, teachers, tenants } from "./index";
import { TEAM } from "./seed/team";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const db = getDb();
const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";
const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
if (!tenant) throw new Error(`tenant ${slug} not found: run pnpm db:migrate && pnpm db:seed first`);

const have = await db.select().from(teachers).where(eq(teachers.tenantId, tenant.id));
let added = 0;
for (const [i, t] of TEAM.entries()) {
  if (have.some((h) => h.name.fa === t.name.fa)) continue;
  await db.insert(teachers).values({ tenantId: tenant.id, name: { ...t.name }, role: { ...t.role }, showOnSite: false, isSample: false, sortOrder: i });
  added++;
}
// Sample coaches no class uses are noise now.
const used = (await db.selectDistinct({ id: classGroups.teacherId }).from(classGroups).where(eq(classGroups.tenantId, tenant.id))).map((r) => r.id).filter((x): x is string => !!x);
const removed = await db
  .delete(teachers)
  .where(and(eq(teachers.tenantId, tenant.id), eq(teachers.isSample, true), used.length ? notInArray(teachers.id, used) : sql`true`))
  .returning({ id: teachers.id });
const all = await db.select().from(teachers).where(eq(teachers.tenantId, tenant.id)).orderBy(asc(teachers.sortOrder));
console.log(`coaches: added ${added}, removed ${removed.length} unused samples. Now: ${all.map((t) => t.name.fa).join("، ")}`);
await closeDb();
