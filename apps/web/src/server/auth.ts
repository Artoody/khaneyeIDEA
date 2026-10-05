import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@khaneyeidea/db";
import {
  can,
  ForbiddenError,
  getSessionUser,
  type AuthDeps,
  type OtpSender,
  type Permission,
  type SessionUser,
} from "@khaneyeidea/core";
import { href, type Locale } from "@/lib/i18n";
import { tenantId } from "./content";

// Data access layer for authentication. Every protected page and every server action
// goes through getUser / requireUser / requirePermission. Never trust UI-only checks.

export const SESSION_COOKIE = "kh_session";

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32 || s.startsWith("change-me")) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set to a long random value");
    return "dev-only-insecure-secret-do-not-use-in-production";
  }
  return s;
}

function otpSender(): OtpSender {
  const provider = process.env.OTP_PROVIDER ?? "console";
  if (provider === "console") {
    if (process.env.NODE_ENV === "production") throw new Error("OTP_PROVIDER=console is not allowed in production");
    return { send: async (phone, code) => console.info(`[otp] ${phone}: ${code}`) };
  }
  // bale (OTP gateway) and kavenegar adapters are added with the messaging work.
  throw new Error(`OTP provider "${provider}" is not configured yet`);
}

export async function authDeps(): Promise<AuthDeps> {
  return { db: getDb(), tenantId: await tenantId(), secret: sessionSecret(), sender: otpSender() };
}

export async function clientMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

/** Current user or null. Deduplicated per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(getDb(), token);
});

export async function requireUser(lang: Locale): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(href(lang, "/login"));
  return user;
}

/** For pages: users without the permission get a 404 (the page's existence is not revealed). */
export async function requirePermissionPage(lang: Locale, perm: Permission, scope?: { branchId?: string | null }) {
  const user = await requireUser(lang);
  if (!can(user, perm, scope)) notFound();
  return user;
}

/** For server actions: throws, so a forged request can never run the mutation. */
export async function requirePermission(perm: Permission, scope?: { branchId?: string | null }) {
  const user = await getUser();
  if (!user || !can(user, perm, scope)) throw new ForbiddenError(perm);
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
