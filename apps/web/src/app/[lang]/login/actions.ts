"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@khaneyeidea/db";
import { getSessionUser, homeFor, requestOtp, revokeSession, verifyOtp } from "@khaneyeidea/core";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { authDeps, clientMeta, SESSION_COOKIE, setSessionCookie } from "@/server/auth";

export type LoginState =
  | { step: "phone"; error?: "invalid_phone" | "rate_limited" | "unknown"; phone?: string }
  | { step: "code"; phone: string; expiresInSec: number; error?: "invalid_code" | "expired" | "too_many_attempts" | "unknown" };

const localeOf = (v: FormDataEntryValue | null): Locale => (typeof v === "string" && isLocale(v) ? v : "fa");

export async function requestCodeAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = String(form.get("phone") ?? "");
  try {
    const { ip } = await clientMeta();
    const r = await requestOtp(await authDeps(), phone, ip);
    if (!r.ok) return { step: "phone", error: r.reason, phone };
    return { step: "code", phone: r.phone, expiresInSec: r.expiresInSec };
  } catch (e) {
    console.error("[login] request failed", e);
    return { step: "phone", error: "unknown", phone };
  }
}

export async function verifyCodeAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const lang = localeOf(form.get("lang"));
  const phone = String(form.get("phone") ?? "");
  const code = String(form.get("code") ?? "");
  let token: string, expiresAt: Date;
  try {
    const r = await verifyOtp(await authDeps(), phone, code, await clientMeta());
    if (!r.ok) {
      if (r.reason === "invalid_phone") return { step: "phone", error: "invalid_phone" };
      return { step: "code", phone, expiresInSec: prev.step === "code" ? prev.expiresInSec : 120, error: r.reason };
    }
    token = r.token;
    expiresAt = r.expiresAt;
  } catch (e) {
    console.error("[login] verify failed", e);
    return { step: "code", phone, expiresInSec: 120, error: "unknown" };
  }
  await setSessionCookie(token, expiresAt);
  const user = await getSessionUser(getDb(), token);
  redirect(href(lang, user ? homeFor(user) : "/app"));
}

export async function logoutAction(form: FormData) {
  const lang = localeOf(form.get("lang"));
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(getDb(), token);
  jar.delete(SESSION_COOKIE);
  redirect(href(lang, "/"));
}
