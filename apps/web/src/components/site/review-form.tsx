"use client";

import { useActionState, useState } from "react";
import { CheckCircle, CircleNotch, PaperPlaneTilt } from "@phosphor-icons/react";
import { submitSiteReview, type ReviewSubmitState } from "@/app/[lang]/reviews/actions";
import { fill } from "@/lib/format";
import { num, type Locale } from "@/lib/i18n";

export type ReviewLabels = {
  name: string;
  body: string;
  submit: string;
  thanks: string;
  chars: string;
  errors: { name: string; body: string; unknown: string };
};

const initial: ReviewSubmitState = {};
const MAX = 1200;
const field = "w-full rounded-2xl border border-line bg-bg px-4 text-base outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-red-500";

export function ReviewForm({ labels, lang }: { labels: ReviewLabels; lang: Locale }) {
  const [state, action, pending] = useActionState(submitSiteReview, initial);
  const [len, setLen] = useState(0);
  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center" role="status">
        <CheckCircle weight="fill" className="size-14 text-accent" />
        <p className="max-w-[34ch] text-lg leading-relaxed">{labels.thanks}</p>
      </div>
    );
  }
  const nameErr = state.error === "name";
  const bodyErr = state.error === "body";
  const otherErr = state.error && !nameErr && !bodyErr;
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="rv-name" className="text-sm font-semibold">
          {labels.name}
        </label>
        <input id="rv-name" name="name" required maxLength={80} autoComplete="name" aria-invalid={nameErr} className={`${field} h-13`} />
        {nameErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {labels.errors.name}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="rv-body" className="text-sm font-semibold">
          {labels.body}
        </label>
        <textarea id="rv-body" name="body" required minLength={20} maxLength={MAX} rows={5} aria-invalid={bodyErr} onChange={(e) => setLen(e.target.value.length)} className={`${field} resize-y py-3 leading-relaxed`} />
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-red-600 dark:text-red-400" role={bodyErr ? "alert" : undefined}>
            {bodyErr ? labels.errors.body : ""}
          </p>
          <span className="shrink-0 text-xs tabular-nums text-muted">{fill(labels.chars, { n: num(len, lang), max: num(MAX, lang) })}</span>
        </div>
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {otherErr && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {labels.errors.unknown}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-13 items-center justify-center gap-2.5 self-start rounded-full bg-accent px-8 text-base font-bold text-on-accent shadow-[0_10px_30px_-12px_rgb(255_179_71/0.7)] transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? <CircleNotch className="size-5 animate-spin" /> : <PaperPlaneTilt weight="fill" className="size-5 rtl:-scale-x-100" />}
        {labels.submit}
      </button>
    </form>
  );
}
