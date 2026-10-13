"use client";

import { useActionState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { changePasswordAction } from "./actions";

export function PasswordForm({ lang, forced }: { lang: string; forced: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, { error: undefined });
  const fa = lang === "fa";
  const input = "h-12 w-full rounded-2xl border border-line bg-bg px-4 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="lang" value={lang} />
      {!forced && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current" className="text-sm font-medium">
            {fa ? "رمز فعلی" : "Current password"}
          </label>
          <input id="current" name="current" type="password" dir="ltr" autoComplete="current-password" required className={input} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="next" className="text-sm font-medium">
          {fa ? "رمز جدید" : "New password"}
        </label>
        <input id="next" name="next" type="password" dir="ltr" autoComplete="new-password" required minLength={8} className={input} />
        <p className="text-xs text-muted">{fa ? "حداقل ۸ حرف." : "At least 8 characters."}</p>
      </div>
      {state.error && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300" role="alert">
          {state.error === "short" ? (fa ? "رمز باید حداقل ۸ حرف باشد." : "The password must be at least 8 characters.") : fa ? "رمز فعلی درست نیست." : "The current password is wrong."}
        </p>
      )}
      <button disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-base font-bold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-70">
        {pending && <CircleNotch className="size-5 animate-spin" />}
        {fa ? "ذخیره" : "Save"}
      </button>
    </form>
  );
}
