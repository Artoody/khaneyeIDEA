import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { authSessions, otpCodes, userRoles, users, type getDb } from "@khaneyeidea/db";
import { normalizeIranMobile } from "./phone";
import type { Principal, Role } from "./permissions";

type Db = ReturnType<typeof getDb>;

export const OTP = {
  length: 5,
  ttlMs: 2 * 60 * 1000,
  maxAttempts: 5,
  perPhoneWindowMs: 10 * 60 * 1000,
  perPhoneMax: 3,
  perIpWindowMs: 60 * 60 * 1000,
  perIpMax: 15,
} as const;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

export type AuthDeps = { db: Db; tenantId: string; secret: string; sender: OtpSender; now?: () => Date };

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");
function safeEqualHex(a: string, b: string) {
  const ba = Buffer.from(a, "hex"),
    bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export type RequestOtpResult =
  | { ok: true; phone: string; expiresInSec: number }
  | { ok: false; reason: "invalid_phone" | "rate_limited" };

export async function requestOtp(deps: AuthDeps, rawPhone: string, ip: string | null): Promise<RequestOtpResult> {
  const { db, tenantId, secret, sender } = deps;
  const now = deps.now?.() ?? new Date();
  const phone = normalizeIranMobile(rawPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  const [byPhone] = await db
    .select({ n: count() })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.tenantId, tenantId),
        eq(otpCodes.phone, phone),
        gt(otpCodes.createdAt, new Date(now.getTime() - OTP.perPhoneWindowMs)),
      ),
    );
  if ((byPhone?.n ?? 0) >= OTP.perPhoneMax) return { ok: false, reason: "rate_limited" };
  if (ip) {
    const [byIp] = await db
      .select({ n: count() })
      .from(otpCodes)
      .where(and(eq(otpCodes.ip, ip), gt(otpCodes.createdAt, new Date(now.getTime() - OTP.perIpWindowMs))));
    if ((byIp?.n ?? 0) >= OTP.perIpMax) return { ok: false, reason: "rate_limited" };
  }

  const code = String(randomInt(0, 10 ** OTP.length)).padStart(OTP.length, "0");
  await db.insert(otpCodes).values({
    tenantId,
    phone,
    ip,
    codeHash: hmac(secret, `${tenantId}:${phone}:${code}`),
    expiresAt: new Date(now.getTime() + OTP.ttlMs),
    createdAt: now,
  });
  await sender.send(phone, code);
  return { ok: true, phone, expiresInSec: OTP.ttlMs / 1000 };
}

export type VerifyOtpResult =
  | { ok: true; userId: string; token: string; expiresAt: Date; isNewUser: boolean }
  | { ok: false; reason: "invalid_phone" | "invalid_code" | "expired" | "too_many_attempts" };

/**
 * Verifies the latest code for the phone. On success creates the user (as a parent) if new,
 * and a server-side session. Staff roles are only ever granted by an admin, never by login.
 */
export async function verifyOtp(
  deps: AuthDeps,
  rawPhone: string,
  rawCode: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<VerifyOtpResult> {
  const { db, tenantId, secret } = deps;
  const now = deps.now?.() ?? new Date();
  const phone = normalizeIranMobile(rawPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };
  const code = rawCode.replace(/[^\d۰-۹]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

  return db.transaction(async (tx) => {
    const [otp] = await tx
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.tenantId, tenantId), eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1)
      .for("update");
    if (!otp) return { ok: false as const, reason: "invalid_code" as const };
    if (otp.expiresAt <= now) return { ok: false as const, reason: "expired" as const };
    if (otp.attempts >= OTP.maxAttempts) return { ok: false as const, reason: "too_many_attempts" as const };

    if (!safeEqualHex(otp.codeHash, hmac(secret, `${tenantId}:${phone}:${code}`))) {
      await tx.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
      return { ok: false as const, reason: "invalid_code" as const };
    }
    await tx.update(otpCodes).set({ consumedAt: now }).where(eq(otpCodes.id, otp.id));

    let [user] = await tx.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.phone, phone)));
    const isNewUser = !user;
    if (!user) {
      [user] = await tx.insert(users).values({ tenantId, phone }).returning();
      await tx.insert(userRoles).values({ userId: user!.id, role: "parent", branchId: null });
    }
    if (!user!.active) return { ok: false as const, reason: "invalid_code" as const };
    await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, user!.id));

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await tx.insert(authSessions).values({
      tokenHash: sha256(token),
      userId: user!.id,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
      createdAt: now,
    });
    return { ok: true as const, userId: user!.id, token, expiresAt, isNewUser };
  });
}

export type SessionUser = Principal & { phone: string; fullName: string | null; locale: string; sessionId: string };

export async function getSessionUser(db: Db, token: string | undefined | null, now = new Date()): Promise<SessionUser | null> {
  if (!token || token.length < 20) return null;
  const [row] = await db
    .select({ sessionId: authSessions.id, expiresAt: authSessions.expiresAt, user: users })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.tokenHash, sha256(token)));
  if (!row || row.expiresAt <= now || !row.user.active) return null;
  const roles = await db
    .select({ role: userRoles.role, branchId: userRoles.branchId })
    .from(userRoles)
    .where(eq(userRoles.userId, row.user.id));
  return {
    sessionId: row.sessionId,
    userId: row.user.id,
    tenantId: row.user.tenantId,
    phone: row.user.phone,
    fullName: row.user.fullName,
    locale: row.user.locale,
    roles: roles.map((r) => ({ role: r.role as Role, branchId: r.branchId })),
  };
}

export async function revokeSession(db: Db, token: string) {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
}
