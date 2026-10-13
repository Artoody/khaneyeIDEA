"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleNotch } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { updateTeacherProfile } from "./actions";

const input = "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";

export function ProfileForm({ lang, photo, meetingUrl, passwordHref, saved, t }: { lang: string; photo: string; meetingUrl: string; passwordHref: string; saved?: boolean; t: OpsDict["tp"]["profile"] }) {
  const [state, action, pending] = useActionState(updateTeacherProfile, {});
  const errors = { photo: t.errPhoto, meetingUrl: t.errMeeting, missing: t.errMissing };
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="lang" value={lang} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="photo" className="text-sm font-medium">
          {t.photo}
        </label>
        <input id="photo" name="photo" dir="ltr" defaultValue={photo} placeholder="https://" className={input} />
        <p className="text-xs text-muted">{t.photoHelp}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="meetingUrl" className="text-sm font-medium">
          {t.meeting}
        </label>
        <input id="meetingUrl" name="meetingUrl" dir="ltr" defaultValue={meetingUrl} placeholder="https://" className={input} />
        <p className="text-xs text-muted">{t.meetingHelp}</p>
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errors[state.error]}
        </p>
      )}
      {(saved || state.ok) && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {t.saved}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-sm font-bold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-70">
          {pending && <CircleNotch className="size-4 animate-spin" />}
          {t.save}
        </button>
        <Link href={passwordHref} className="inline-flex h-12 items-center rounded-full border border-line px-5 text-sm transition hover:border-ink/30">
          {t.password}
        </Link>
      </div>
    </form>
  );
}
