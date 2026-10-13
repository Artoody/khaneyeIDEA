"use client";

import { useActionState } from "react";
import { setTeacherLogin } from "@/app/[lang]/app/admin/teachers/actions";
import { inputCls } from "./fields";

export function TeacherLoginFields({ teacherId, lang, hasAccount }: { teacherId: string; lang: string; hasAccount: boolean }) {
  const [state, action, pending] = useActionState(setTeacherLogin, {});
  return (
    <form action={action} className="mt-8 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-extrabold">رمز و نام کاربری پنل دبیر</h2>
      <p className="text-sm text-muted">اینجا حساب ورود اپ دبیر را می‌سازید یا رمز را ریست می‌کنید. دبیر بعد از ورود اول، رمز را عوض می‌کند.</p>
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="lang" value={lang} />
      {!hasAccount && (
        <label className="flex flex-col gap-1.5 text-sm">
          موبایل
          <input name="phone" dir="ltr" required className={inputCls} placeholder="0912..." />
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-sm">
        نام کاربری
        <input name="username" dir="ltr" required autoComplete="off" className={inputCls} placeholder="alireza" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        رمز اولیه
        <input name="password" type="text" dir="ltr" required minLength={8} autoComplete="new-password" className={inputCls} />
      </label>
      {state.fieldErrors?.username && <p className="text-sm text-red-500">{state.fieldErrors.username}</p>}
      {state.fieldErrors?.phone && <p className="text-sm text-red-500">شماره موبایل درست نیست.</p>}
      {state.ok && <p className="text-sm text-accent-text">ذخیره شد.</p>}
      <button disabled={pending} className="h-11 self-start rounded-full bg-accent px-6 text-sm font-semibold text-on-accent">
        {pending ? "..." : "ذخیره ورود"}
      </button>
    </form>
  );
}
