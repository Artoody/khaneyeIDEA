"use client";

import { useActionState } from "react";
import { teacherLoginAction, type TeacherLoginState } from "./actions";

const errors: Record<NonNullable<TeacherLoginState["error"]>, string> = {
  invalid: "نام کاربری یا رمز درست نیست.",
  locked: "به خاطر چند تلاش نادرست، ورود برای چند دقیقه بسته است.",
  inactive: "این حساب غیرفعال است.",
  not_teacher: "این ورود فقط برای دبیرهاست.",
};

export function TeacherLoginForm({ lang }: { lang: "fa" | "en" }) {
  const [state, action, pending] = useActionState(teacherLoginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="lang" value={lang} />
      <label className="flex flex-col gap-1.5 text-sm">
        نام کاربری
        <input name="username" dir="ltr" autoComplete="username" required className="h-12 rounded-2xl border border-line bg-surface px-4" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        رمز
        <input name="password" type="password" dir="ltr" autoComplete="current-password" required className="h-12 rounded-2xl border border-line bg-surface px-4" />
      </label>
      {state.error && <p className="text-sm text-red-500">{errors[state.error]}</p>}
      <button disabled={pending} className="h-12 rounded-full bg-accent text-sm font-semibold text-on-accent">
        {pending ? "..." : "ورود"}
      </button>
    </form>
  );
}
