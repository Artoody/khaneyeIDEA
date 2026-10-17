"use client";

import { useActionState } from "react";
import { submitSiteReview, type ReviewSubmitState } from "@/app/[lang]/reviews/actions";

type Labels = {
  name: string;
  body: string;
  submit: string;
  thanks: string;
  errors: { name: string; body: string; unknown: string };
};

const initial: ReviewSubmitState = {};

export function ReviewForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState(submitSiteReview, initial);
  if (state.ok) {
    return (
      <p className="rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 text-sm leading-relaxed text-ink" role="status">
        {labels.thanks}
      </p>
    );
  }
  const err =
    state.error === "name" ? labels.errors.name : state.error === "body" ? labels.errors.body : state.error ? labels.errors.unknown : null;
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{labels.name}</span>
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          className="h-12 rounded-2xl border border-line bg-bg px-4 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{labels.body}</span>
        <textarea
          name="body"
          required
          minLength={20}
          maxLength={1200}
          rows={4}
          className="resize-y rounded-2xl border border-line bg-bg px-4 py-3 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {err && (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center self-start rounded-full bg-accent px-6 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
