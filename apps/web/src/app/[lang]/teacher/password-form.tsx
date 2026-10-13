"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";

export function PasswordForm({ lang, forced }: { lang: string; forced: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, { error: undefined });
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="lang" value={lang} />
      {!forced && (
        <label className="flex flex-col gap-1.5 text-sm">
          رمز فعلی
          <input name="current" type="password" dir="ltr" required className="h-12 rounded-2xl border border-line bg-surface px-4" />
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-sm">
        رمز جدید
        <input name="next" type="password" dir="ltr" required minLength={8} className="h-12 rounded-2xl border border-line bg-surface px-4" />
      </label>
      {state.error && <p className="text-sm text-red-500">{state.error === "short" ? "رمز باید حداقل ۸ حرف باشد." : "رمز فعلی درست نیست."}</p>}
      <button disabled={pending} className="h-12 rounded-full bg-accent text-sm font-semibold text-on-accent">
        ذخیره
      </button>
    </form>
  );
}
