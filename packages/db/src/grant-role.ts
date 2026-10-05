// Bootstrap or manage staff roles from the command line (the first owner has no panel to do it from).
// Usage: pnpm --filter @khaneyeidea/db grant-role <mobile> <owner|admin|content_manager|teacher> [fullName]
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb, roleEnum, tenants, userRoles, users } from "./index";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const [rawPhone, role, ...nameParts] = process.argv.slice(2);
const local = (rawPhone ?? "").replace(/\D/g, "").replace(/^0098|^98|^0/, "");
if (!/^9\d{9}$/.test(local) || !role || !(roleEnum.enumValues as readonly string[]).includes(role)) {
  console.error("usage: grant-role <mobile> <" + roleEnum.enumValues.join("|") + "> [fullName]");
  process.exit(1);
}
const phone = `98${local}`;
const db = getDb();
const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";
const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
if (!tenant) throw new Error(`tenant ${slug} not found`);

let [user] = await db.select().from(users).where(and(eq(users.tenantId, tenant.id), eq(users.phone, phone)));
if (!user) [user] = await db.insert(users).values({ tenantId: tenant.id, phone, fullName: nameParts.join(" ") || null }).returning();
const r = role as (typeof roleEnum.enumValues)[number];
const existing = await db.select().from(userRoles).where(and(eq(userRoles.userId, user!.id), eq(userRoles.role, r)));
if (existing.length === 0) await db.insert(userRoles).values({ userId: user!.id, role: r, branchId: null });
console.log(`granted ${role} to ${phone}`);
await closeDb();
