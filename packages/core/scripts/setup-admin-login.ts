/**
 * One-shot: username/password for the local Dev Local owner so /admin/login works.
 * Run: pnpm --filter @khaneyeidea/core exec tsx scripts/setup-admin-login.ts
 * Sign in: admin / admin12 → /app/admin
 *
 * Note: admin12 is 7 chars (below PASSWORD.minLength used for panel resets).
 * This bootstrap writes the hash directly for the agreed demo credentials.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { closeDb, getDb, users } from "@khaneyeidea/db";
import { hashPassword, normalizeUsername } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const db = getDb();
const phone = "989123456789";
const [u] = await db.select().from(users).where(eq(users.phone, phone));
if (!u) {
  console.error("Dev Local owner missing (09123456789). Sign in once with OTP first, or create the user.");
  process.exit(1);
}

const username = normalizeUsername("admin");
if (!username) {
  console.error("invalid username");
  process.exit(1);
}

const now = new Date();
await db
  .update(users)
  .set({
    username,
    passwordHash: await hashPassword("admin12"),
    mustChangePassword: false,
    passwordUpdatedAt: now,
    passwordFailedCount: 0,
    passwordLockedUntil: null,
  })
  .where(eq(users.id, u.id));

console.log(`OK: ${u.fullName ?? u.phone} → admin / admin12 (mustChange=false)`);
await closeDb();
