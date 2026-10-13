"use server";

import { redirect } from "next/navigation";
import { getDb } from "@khaneyeidea/db";
import { changeOwnPassword, homeFor, loginWithPassword } from "@khaneyeidea/core";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { clientMeta, getUser, setSessionCookie } from "@/server/auth";
import { tenantId } from "@/server/content";

export type StaffLoginState = { error?: "invalid" | "locked" | "inactive" | "not_staff" };

export async function loginStaffAction(_prev: StaffLoginState, form: FormData): Promise<StaffLoginState> {
  const lang = String(form.get("lang") ?? "fa");
  const locale: Locale = isLocale(lang) ? lang : "fa";
  try {
    const meta = await clientMeta();
    const result = await loginWithPassword(getDb(), {
      tenantId: await tenantId(),
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      audience: "staff",
      ...meta,
    });
    if (!result.ok) return { error: result.reason };
    await setSessionCookie(result.token);
    redirect(href(locale, result.mustChangePassword ? "/admin/password" : "/app/admin"));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[staff-login]", e);
    return { error: "invalid" };
  }
}

export async function changeStaffPasswordAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const lang = String(form.get("lang") ?? "fa");
  const locale: Locale = isLocale(lang) ? lang : "fa";
  const user = await getUser();
  if (!user) redirect(href(locale, "/admin/login"));
  const result = await changeOwnPassword(getDb(), {
    userId: user.userId,
    current: String(form.get("current") ?? ""),
    next: String(form.get("next") ?? ""),
  });
  if (!result.ok) return { error: result.reason };
  redirect(href(locale, homeFor(user)));
}
