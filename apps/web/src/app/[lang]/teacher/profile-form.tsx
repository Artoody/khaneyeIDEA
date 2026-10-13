"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateTeacherProfile, type TeacherProfileState } from "./actions";

const errors: Record<NonNullable<TeacherProfileState["error"]>, string> = {
  photo: "آدرس عکس باید با https:// یا /media/ شروع شود.",
  meetingUrl: "لینک کلاس باید با https:// شروع شود.",
  missing: "پروفایل دبیر پیدا نشد.",
};

export function ProfileForm({
  lang,
  photo,
  meetingUrl,
  passwordHref,
  saved,
}: {
  lang: string;
  photo: string;
  meetingUrl: string;
  passwordHref: string;
  saved?: boolean;
}) {
  const [state, action, pending] = useActionState(updateTeacherProfile, {});
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="lang" value={lang} />
      {photo ? <img src={photo} alt="" className="mx-auto size-28 rounded-full object-cover ring-2 ring-line" /> : <div className="mx-auto grid size-28 place-items-center rounded-full bg-ink/5 text-sm text-muted">بدون عکس</div>}
      <label className="flex flex-col gap-1.5 text-sm">
        آدرس عکس
        <input
          name="photo"
          dir="ltr"
          defaultValue={photo}
          placeholder="https://… یا /media/…"
          className="h-12 rounded-2xl border border-line bg-surface px-4"
        />
        <span className="text-xs text-muted">با https:// یا /media/ شروع شود.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        لینک پیش‌فرض کلاس آنلاین
        <input name="meetingUrl" dir="ltr" defaultValue={meetingUrl} placeholder="https://" className="h-12 rounded-2xl border border-line bg-surface px-4" />
        <span className="text-xs text-muted">اگر کلاس لینک جدا نداشته باشد، این لینک نشان داده می‌شود.</span>
      </label>
      {state.error && <p className="text-sm text-red-500">{errors[state.error]}</p>}
      {(saved || state.ok) && <p className="text-sm text-accent-text">ذخیره شد.</p>}
      <button disabled={pending} className="h-12 rounded-full bg-accent text-sm font-semibold text-on-accent">
        {pending ? "..." : "ذخیره پروفایل"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href={passwordHref} className="underline">
          تغییر رمز ورود
        </Link>
      </p>
    </form>
  );
}
