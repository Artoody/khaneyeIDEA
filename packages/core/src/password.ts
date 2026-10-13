import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { authSessions, userRoles, users, type getDb } from "@khaneyeidea/db";
import { SESSION_TTL_MS } from "./auth";
import type { Role } from "./permissions";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function scrypt(password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key as Buffer)));
  });
}

type Db = ReturnType<typeof getDb>;
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export const PASSWORD = { minLength: 8, maxFails: 8, lockMs: 15 * 60 * 1000 } as const;
const USERNAME = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  return USERNAME.test(u) ? u : null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, KEYLEN, { N, r: R, p: P })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [kind, n, r, p, saltB64, hashB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const actual = (await scrypt(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) })) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function openSession(db: Db, userId: string, now: Date, meta: { userAgent?: string | null; ip?: string | null }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(authSessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip ?? null,
    createdAt: now,
  });
  return { token, expiresAt };
}

export type PasswordLogin =
  | { ok: true; userId: string; token: string; expiresAt: Date; mustChangePassword: boolean }
  | { ok: false; reason: "invalid" | "locked" | "inactive" | "not_teacher" };

/** Username and password for the teacher app. Only accounts with the teacher role may enter. */
export async function loginWithPassword(
  db: Db,
  p: { tenantId: string; username: string; password: string; userAgent?: string | null; ip?: string | null; now?: Date },
): Promise<PasswordLogin> {
  const now = p.now ?? new Date();
  const username = normalizeUsername(p.username);
  if (!username || p.password.length < 1) return { ok: false, reason: "invalid" };
  const [user] = await db.select().from(users).where(and(eq(users.tenantId, p.tenantId), sql`lower(${users.username}) = ${username}`));
  if (!user?.passwordHash) return { ok: false, reason: "invalid" };
  if (!user.active) return { ok: false, reason: "inactive" };
  if (user.passwordLockedUntil && user.passwordLockedUntil > now) return { ok: false, reason: "locked" };

  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
  if (!roles.some((r) => r.role === ("teacher" satisfies Role))) return { ok: false, reason: "not_teacher" };

  if (!(await verifyPassword(p.password, user.passwordHash))) {
    const fails = user.passwordFailedCount + 1;
    await db
      .update(users)
      .set({
        passwordFailedCount: fails,
        passwordLockedUntil: fails >= PASSWORD.maxFails ? new Date(now.getTime() + PASSWORD.lockMs) : null,
      })
      .where(eq(users.id, user.id));
    return { ok: false, reason: fails >= PASSWORD.maxFails ? "locked" : "invalid" };
  }

  await db.update(users).set({ passwordFailedCount: 0, passwordLockedUntil: null, lastLoginAt: now }).where(eq(users.id, user.id));
  const session = await openSession(db, user.id, now, p);
  return { ok: true, userId: user.id, mustChangePassword: user.mustChangePassword, ...session };
}

/** Admin sets the username and a first password. The teacher must replace it on the next login. */
export async function setUserPassword(
  db: Db,
  p: { tenantId: string; userId: string; username: string; password: string; mustChange?: boolean; now?: Date },
): Promise<{ ok: true } | { ok: false; reason: "username" | "short" | "taken" | "missing" }> {
  const username = normalizeUsername(p.username);
  if (!username) return { ok: false, reason: "username" };
  if (p.password.length < PASSWORD.minLength) return { ok: false, reason: "short" };
  const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, p.userId), eq(users.tenantId, p.tenantId)));
  if (!user) return { ok: false, reason: "missing" };
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, p.tenantId), sql`lower(${users.username}) = ${username}`));
  if (clash && clash.id !== p.userId) return { ok: false, reason: "taken" };
  await db
    .update(users)
    .set({
      username,
      passwordHash: await hashPassword(p.password),
      mustChangePassword: p.mustChange ?? true,
      passwordUpdatedAt: p.now ?? new Date(),
      passwordFailedCount: 0,
      passwordLockedUntil: null,
    })
    .where(eq(users.id, p.userId));
  return { ok: true };
}

export async function changeOwnPassword(
  db: Db,
  p: { userId: string; current: string | null; next: string; now?: Date },
): Promise<{ ok: true } | { ok: false; reason: "short" | "wrong" | "missing" }> {
  if (p.next.length < PASSWORD.minLength) return { ok: false, reason: "short" };
  const [user] = await db.select().from(users).where(eq(users.id, p.userId));
  if (!user?.passwordHash) return { ok: false, reason: "missing" };
  if (!user.mustChangePassword && !(await verifyPassword(p.current ?? "", user.passwordHash))) return { ok: false, reason: "wrong" };
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(p.next),
      mustChangePassword: false,
      passwordUpdatedAt: p.now ?? new Date(),
      passwordFailedCount: 0,
      passwordLockedUntil: null,
    })
    .where(eq(users.id, p.userId));
  return { ok: true };
}
