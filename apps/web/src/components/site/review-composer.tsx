"use client";

import { useRef } from "react";
import { PencilSimpleLine, X } from "@phosphor-icons/react";
import type { Locale } from "@/lib/i18n";
import { ReviewForm, type ReviewLabels } from "./review-form";

/** The "write your review" button and the dialog with the form: one clear place to leave an opinion. */
export function ReviewComposer({ title, hint, closeLabel, labels, lang, variant = "primary" }: { title: string; hint: string; closeLabel: string; labels: ReviewLabels; lang: Locale; variant?: "primary" | "quiet" }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        data-testid="review-open"
        className={
          variant === "primary"
            ? "inline-flex h-13 items-center justify-center gap-2.5 rounded-full bg-accent px-7 text-base font-bold text-on-accent shadow-[0_10px_30px_-12px_rgb(255_179_71/0.7)] transition hover:bg-accent-strong active:scale-[0.98]"
            : "inline-flex h-12 items-center justify-center gap-2.5 rounded-full border border-line px-6 text-base font-semibold transition hover:border-ink/30 active:scale-[0.98]"
        }
      >
        <PencilSimpleLine weight="duotone" className="size-5" />
        {title}
      </button>
      <dialog
        ref={ref}
        data-testid="review-dialog"
        aria-label={title}
        className="dialog-card w-[min(32rem,calc(100vw-2rem))]"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="relative rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-2xl sm:p-8">
          <button type="button" onClick={() => ref.current?.close()} aria-label={closeLabel} className="absolute end-4 top-4 grid size-10 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink">
            <X className="size-5" />
          </button>
          <h3 className="pe-10 font-display text-2xl font-extrabold tracking-tight">{title}</h3>
          <p className="mb-6 mt-2 max-w-[44ch] text-sm leading-relaxed text-muted">{hint}</p>
          <ReviewForm labels={labels} lang={lang} />
        </div>
      </dialog>
    </>
  );
}
