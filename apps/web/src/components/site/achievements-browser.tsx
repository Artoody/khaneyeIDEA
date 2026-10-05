"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Medal, Trophy } from "@phosphor-icons/react";
import type { Dict, Locale } from "@/lib/i18n";
import { num } from "@/lib/i18n";
import { fill } from "@/lib/format";

export type AchievementItem = {
  id: string;
  title: string;
  /** Set when the title is shown in Persian on the English site (not translated yet). */
  titleLang?: "fa";
  competition: string | null;
  rank: string | null;
  scope: "world" | "asia" | "national" | null;
  country: string;
  year: number | null;
};
type Scope = "all" | "world" | "asia" | "national";
type Labels = Dict["achievementsPage"];

const TOP = new Set(["1", "gold"]);

export function AchievementsBrowser({ items, lang, labels }: { items: AchievementItem[]; lang: Locale; labels: Labels }) {
  const [scope, setScope] = useState<Scope>("all");
  const reduce = useReducedMotion();
  const scopes = (["all", "world", "asia", "national"] as const).filter((s) => s === "all" || items.some((i) => i.scope === s));
  const shown = scope === "all" ? items : items.filter((i) => i.scope === scope);
  const years = [...new Set(shown.map((i) => i.year))].sort((a, b) => (b ?? 0) - (a ?? 0));

  return (
    <>
      <div className="sticky top-[68px] z-20 -mx-4 flex items-center gap-2 overflow-x-auto border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl [scrollbar-width:none] sm:-mx-6 sm:px-6">
        {scopes.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scope === s}
            onClick={() => setScope(s)}
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-line px-4 text-sm text-muted transition hover:text-ink active:scale-[0.98] aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
          >
            {labels.scope[s]}
          </button>
        ))}
        <span className="ms-auto shrink-0 ps-4 text-sm text-muted" aria-live="polite">
          {fill(labels.count, { n: num(shown.length, lang) })}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-lg text-muted">{labels.empty}</p>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scope}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {years.map((y) => {
              const group = shown.filter((i) => i.year === y);
              return (
                <section key={y ?? "none"} className="grid gap-6 border-b border-line py-12 last:border-b-0 lg:grid-cols-[12rem_1fr] lg:gap-10">
                  <div className="lg:sticky lg:top-[150px] lg:self-start">
                    <h2 className="font-display text-5xl font-black tracking-tight tabular-nums text-ink/90">{y ? num(String(y), lang) : labels.noYear}</h2>
                    <p className="mt-2 text-sm text-muted">{fill(labels.count, { n: num(group.length, lang) })}</p>
                  </div>
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {group.map((a) => {
                      const top = a.rank ? TOP.has(a.rank) : false;
                      const Ico = a.rank && ["gold", "silver", "bronze"].includes(a.rank) ? Medal : Trophy;
                      return (
                        <li key={a.id} className={`flex gap-4 rounded-[var(--radius-card)] border p-5 ${top ? "border-accent/50 bg-accent/10" : "border-line bg-surface"}`}>
                          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${top ? "bg-accent text-on-accent" : "bg-ink/5 text-ink/70"}`}>
                            <Ico weight={top ? "fill" : "duotone"} className="size-6" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium leading-relaxed" lang={a.titleLang} dir={a.titleLang ? "rtl" : undefined}>
                              {a.title}
                            </p>
                            <p className="mt-1.5 text-sm text-muted">
                              {[a.rank ? labels.rank[a.rank] : null, a.competition, a.country].filter(Boolean).join(lang === "fa" ? "، " : ", ")}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}
