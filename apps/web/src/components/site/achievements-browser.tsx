"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, Medal, Trophy } from "@phosphor-icons/react";
import type { Dict, Locale } from "@/lib/i18n";
import { num } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { PillTabs } from "./pill-tabs";

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

function Item({ a, lang, labels }: { a: AchievementItem; lang: Locale; labels: Labels }) {
  const top = a.rank ? TOP.has(a.rank) : false;
  const Ico = a.rank && ["gold", "silver", "bronze"].includes(a.rank) ? Medal : Trophy;
  return (
    <li className={`flex gap-4 rounded-2xl border p-4 ${top ? "border-accent/50 bg-accent/10" : "border-line bg-bg/60"}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${top ? "bg-accent text-on-accent" : "bg-ink/5 text-ink/70"}`}>
        <Ico weight={top ? "fill" : "duotone"} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-medium leading-relaxed" lang={a.titleLang} dir={a.titleLang ? "rtl" : undefined}>
          {a.title}
        </p>
        <p className="mt-1 text-sm text-muted">{[a.rank ? labels.rank[a.rank] : null, a.competition, a.country].filter(Boolean).join(lang === "fa" ? "، " : ", ")}</p>
      </div>
    </li>
  );
}

export function AchievementsBrowser({ items, lang, labels }: { items: AchievementItem[]; lang: Locale; labels: Labels }) {
  const [scope, setScope] = useState<Scope>("all");
  const reduce = useReducedMotion();
  const shown = scope === "all" ? items : items.filter((i) => i.scope === scope);
  const years = [...new Set(shown.map((i) => i.year))].sort((a, b) => (b ?? 0) - (a ?? 0));
  // Newest year starts open; the rest are one tap away.
  const [open, setOpen] = useState<Set<number | null>>(() => new Set(years.slice(0, 1)));
  const allOpen = years.every((y) => open.has(y));
  const toggle = (y: number | null) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  const scopes = (["all", "world", "asia", "national"] as const).filter((s) => s === "all" || items.some((i) => i.scope === s));
  const sep = lang === "fa" ? "، " : ", ";

  return (
    <>
      <div className="sticky top-[68px] z-20 -mx-4 flex items-center gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <PillTabs
          group="scope"
          label={labels.scope.all}
          value={scope}
          onChange={setScope}
          className="isolate overflow-x-auto [scrollbar-width:none]"
          items={scopes.map((s) => ({ value: s, label: labels.scope[s] }))}
        />
        <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(years))} className="ms-auto shrink-0 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {allOpen ? labels.collapseAll : labels.expandAll}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-lg text-muted">{labels.empty}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {years.map((y) => {
            const group = shown.filter((i) => i.year === y);
            const tops = group.filter((a) => a.rank && TOP.has(a.rank)).length;
            const countries = [...new Set(group.map((a) => a.country).filter(Boolean))];
            const isOpen = open.has(y);
            const id = `year-${y ?? "none"}`;
            return (
              <section key={y ?? "none"} className="glass overflow-hidden rounded-[var(--radius-card)] border border-line">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => toggle(y)}
                  className="flex w-full items-center gap-5 px-5 py-4 text-start transition hover:bg-ink/[0.03] sm:px-7 sm:py-5"
                >
                  <span className="font-display text-3xl font-black tabular-nums tracking-tight sm:text-4xl">{y ? num(String(y), lang) : labels.noYear}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {fill(labels.count, { n: num(group.length, lang) })}
                      {tops > 0 && (
                        <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-text">
                          <Trophy weight="fill" className="size-3.5" />
                          {fill(labels.tops, { n: num(tops, lang) })}
                        </span>
                      )}
                    </span>
                    {countries.length > 0 && <span className="mt-1 block truncate text-sm text-muted">{countries.join(sep)}</span>}
                  </span>
                  <CaretDown weight="bold" className={`size-5 shrink-0 text-muted transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={id}
                      key="body"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <ul className="grid grid-cols-1 gap-2.5 px-5 pb-5 sm:px-7 sm:pb-7 md:grid-cols-2">
                        {group.map((a) => (
                          <Item key={a.id} a={a} lang={lang} labels={labels} />
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
