import { and, eq, isNull } from "drizzle-orm";
import { userRoles, users, type getDb } from "@khaneyeidea/db";
import { normalizeIranMobile } from "./phone";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The account for a mobile number in this tenant, created if needed (no login happens here). A name is only set
 * when the account has none, so an admin typing a parent's name never overwrites what the parent entered.
 */
export async function findOrCreateUser(db: Db | Tx, tenantId: string, rawPhone: string, name?: string | null) {
  const phone = normalizeIranMobile(rawPhone);
  if (!phone) return null;
  const [existing] = await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.phone, phone)));
  if (existing) {
    if (name?.trim() && !existing.fullName) await db.update(users).set({ fullName: name.trim() }).where(and(eq(users.id, existing.id), isNull(users.fullName)));
    return existing;
  }
  const [created] = await db
    .insert(users)
    .values({ tenantId, phone, fullName: name?.trim() || null })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.phone, phone))))[0]!;
}

/** Adds a role unless the user already holds that exact role and branch scope. */
export async function grantRole(db: Db | Tx, userId: string, role: (typeof userRoles.$inferInsert)["role"], branchId: string | null) {
  const have = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  if (have.some((r) => r.role === role && r.branchId === branchId)) return false;
  await db.insert(userRoles).values({ userId, role, branchId });
  return true;
}
