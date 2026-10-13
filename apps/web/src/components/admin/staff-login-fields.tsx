"use client";

import { useActionState } from "react";
import { setStaffLogin } from "@/app/[lang]/app/admin/staff/actions";
import type { OpsDict } from "@/lib/ops-i18n";
import { inputCls } from "./fields";

export function StaffLoginFields({
  userId,
  username,
  t,
}: {
  userId: string;
  username: string | null;
  t: OpsDict["staff"];
}) {
  const [state, action, pending] = useActionState(setStaffLogin, {});
  return (
    <form action={action} className="mt-3 flex w-full flex-col gap-3 rounded-2xl border border-line bg-bg/60 p-3 sm:max-w-md">
      <p className="text-sm font-medium">{t.loginTitle}</p>
      <p className="text-xs text-muted">{t.loginHelp}</p>
      {username && (
        <p className="text-xs text-muted" dir="ltr">
          {t.hasUsername}: <span className="font-mono text-ink">{username}</span>
        </p>
      )}
      <input type="hidden" name="userId" value={userId} />
      <label className="flex flex-col gap-1 text-sm">
        {t.username}
        <input name="username" dir="ltr" required autoComplete="off" defaultValue={username ?? ""} className={inputCls} placeholder="admin" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t.password}
        <input name="password" type="text" dir="ltr" required minLength={8} autoComplete="new-password" className={inputCls} />
      </label>
      {state.fieldErrors?.username && <p className="text-sm text-red-500">{state.fieldErrors.username}</p>}
      {state.ok && <p className="text-sm text-accent-text">{t.loginSaved}</p>}
      <button disabled={pending} className="h-10 self-start rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-60">
        {pending ? "…" : t.saveLogin}
      </button>
    </form>
  );
}
