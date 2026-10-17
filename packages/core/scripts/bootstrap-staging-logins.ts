/**
 * Staging logins for Railway. Point DATABASE_URL at the remote DB, then:
 *   pnpm --filter @khaneyeidea/core exec tsx scripts/bootstrap-staging-logins.ts
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { closeDb, getDb, teachers, tenants, users } from "@khaneyeidea/db";
import { findOrCreateUser, grantRole, hashPassword, normalizeUsername } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const db = getDb();
const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";
const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
if (!tenant) throw new Error("tenant missing — seed first");

const tid = tenant.id;
const now = new Date();

async function upsertPassword(userId: string, username: string, password: string, mustChange = false) {
  const un = normalizeUsername(username);
  if (!un) throw new Error(`bad username ${username}`);
  await db
    .update(users)
    .set({
      username: un,
      passwordHash: await hashPassword(password),
      mustChangePassword: mustChange,
      passwordUpdatedAt: now,
      passwordFailedCount: 0,
      passwordLockedUntil: null,
    })
    .where(eq(users.id, userId));
}

const owner = await findOrCreateUser(db, tid, "09123456789", "مالک تست");
if (!owner) throw new Error("owner create failed");
await grantRole(db, owner.id, "owner", null);
await upsertPassword(owner.id, "admin", "admin12", false);
console.log("owner: 09123456789 OTP 1234 | admin / admin12 → /admin/login");

const coachPhones = [
  ["09120000101", "alireza", "teacher12", "علیرضا علیزاده‌راد", "Alireza Alizadeh Rad"],
  ["09120000102", "milad", "teacher12", "میلاد مرادی", "Milad Moradi"],
  ["09120000103", "bidhendi", "teacher12", "بیدهندی", "Bidhendi"],
  ["09120000104", "amir", "teacher12", "امیرحسین پورقاسم", "Amirhossein Pourghasem"],
] as const;

for (const [phone, user, pass, fa, en] of coachPhones) {
  const u = await findOrCreateUser(db, tid, phone, fa);
  if (!u) throw new Error(`user ${phone}`);
  await grantRole(db, u.id, "teacher", null);
  await upsertPassword(u.id, user, pass, false);
  const have = await db.select().from(teachers).where(eq(teachers.tenantId, tid));
  if (!have.some((h) => h.name?.fa === fa)) {
    await db.insert(teachers).values({
      tenantId: tid,
      userId: u.id,
      name: { fa, en },
      showOnSite: false,
    });
  } else {
    const t = have.find((h) => h.name?.fa === fa);
    if (t && !t.userId) await db.update(teachers).set({ userId: u.id }).where(eq(teachers.id, t.id));
  }
  console.log(`teacher: ${phone} OTP 1234 | ${user} / ${pass} → /teacher/login`);
}

const parent = await findOrCreateUser(db, tid, "09350000001", "والد نمونه");
if (!parent) throw new Error("parent");
await grantRole(db, parent.id, "parent", null);
console.log("parent: 09350000001 OTP 1234 → /login");

await closeDb();
console.log("done");
