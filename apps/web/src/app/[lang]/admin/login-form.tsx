"use client";

import { useActionState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { loginStaffAction } from "./actions";

const input = "h-12 w-full rounded-2xl border border-line bg-bg px-4 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";

export function StaffLoginForm({ lang, t }: { lang: "fa" | "en"; t: OpsDict["staffLogin"] }) {
  const [state, action, pending] = useActionState(loginStaffAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="lang" value={lang} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          {t.username}
        </label>
        <input id="username" name="username" dir="ltr" autoComplete="username" autoCapitalize="none" required className={input} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          {t.password}
        </label>
        <input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required className={input} />
      </div>
      {state.error && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300" role="alert">
          {t[state.error]}
        </p>
      )}
      <button disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-base font-bold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-70">
        {pending && <CircleNotch className="size-5 animate-spin" />}
        {t.submit}
      </button>
    </form>
  );
}
