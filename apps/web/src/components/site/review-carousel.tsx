"use client";

import { useEffect, useState } from "react";
import { CaretLeft, CaretRight, Quotes } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { fill } from "@/lib/format";
import { num, type Locale } from "@/lib/i18n";

export type ReviewItem = { id: string; body: string; author: string };
const EVERY = 9000;

/**
 * One quote at a time, large. All quotes sit in the same grid cell so the card never changes height; the others
 * fade out. It turns by itself every nine seconds (paused on hover and focus, off for reduced motion) and the
 * author chips under it show where you are.
 */
export function ReviewCarousel({ items, lang, labels }: { items: ReviewItem[]; lang: Locale; labels: { prev: string; next: string; count: string } }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const reduce = useReducedMotion();
  const n = items.length;
  useEffect(() => {
    if (reduce || hold || n < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), EVERY);
    return () => clearTimeout(t);
  }, [i, hold, reduce, n]);
  const go = (to: number) => setI(((to % n) + n) % n);
  const arrow = "grid size-12 place-items-center rounded-full border border-line bg-surface transition hover:border-ink/30 active:scale-95";

  return (
    <div onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)} data-testid="review-carousel">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[0_24px_60px_-40px_rgb(0_0_0/0.35)] sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -end-20 -top-20 size-64 rounded-full bg-accent/15 blur-3xl" />
        <span className="relative grid size-14 place-items-center rounded-2xl bg-accent text-on-accent">
          <Quotes weight="fill" className="size-7" />
        </span>
        <div className="relative mt-6 grid">
          {items.map((r, idx) => {
            const on = idx === i;
            return (
              <figure
                key={r.id}
                aria-hidden={!on}
                className={`[grid-area:1/1] transition-[opacity,transform] duration-500 ease-out ${on ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
              >
                <blockquote className={`font-display font-semibold text-balance ${r.body.length > 260 ? "text-lg leading-[2] sm:text-xl" : "text-xl leading-[1.95] sm:text-[1.7rem]"}`}>{r.body}</blockquote>
                <figcaption className="mt-7 flex items-center gap-3">
                  <span aria-hidden className="h-0.5 w-9 rounded-full bg-accent" />
                  <span className="text-base font-bold">{r.author}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>

      {n > 1 && (
        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={() => go(i - 1)} aria-label={labels.prev} className={arrow}>
            <CaretRight className="size-5 ltr:rotate-180" />
          </button>
          <button type="button" onClick={() => go(i + 1)} aria-label={labels.next} className={arrow}>
            <CaretLeft className="size-5 ltr:rotate-180" />
          </button>
          <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]" role="tablist">
            {items.map((r, idx) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={idx === i}
                onClick={() => go(idx)}
                className="relative shrink-0 overflow-hidden rounded-full px-4 py-2 text-sm text-muted transition hover:text-ink aria-selected:bg-ink/[0.06] aria-selected:font-semibold aria-selected:text-ink"
              >
                {r.author}
                {idx === i && !reduce && (
                  <span
                    key={`${i}-${hold}`}
                    aria-hidden
                    className="absolute inset-x-3 bottom-0 h-0.5 origin-[left_center] rounded-full bg-accent rtl:origin-[right_center]"
                    style={{ animation: `rv-progress ${EVERY}ms linear both`, animationPlayState: hold ? "paused" : "running" }}
                  />
                )}
              </button>
            ))}
          </div>
          <span className="hidden shrink-0 text-sm tabular-nums text-muted sm:block">{fill(labels.count, { n: num(i + 1, lang), total: num(n, lang) })}</span>
        </div>
      )}
    </div>
  );
}
