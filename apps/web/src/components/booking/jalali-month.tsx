"use client";

import { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { num, type Locale } from "@/lib/i18n";
import { FA_MONTHS, fromJalali, jalaliMonthDays, toJalali, weekdaySat0Iso, WEEKDAYS } from "@/lib/jalali";

export type DayInfo = {
  /** the small figure under the day number, e.g. how many times are free */
  badge?: string;
  tone?: "open" | "full" | "closed" | "busy";
};

type Anchor = { y: number; m: number };

const tonal: Record<NonNullable<DayInfo["tone"]>, string> = {
  open: "bg-accent/12 text-ink",
  busy: "bg-accent/25 text-ink",
  full: "bg-ink/[0.06] text-muted",
  closed: "bg-red-500/10 text-red-700 dark:text-red-300",
};

/** The first day of the month (YYYY-MM-DD) for an anchor, in the calendar the language uses. */
function monthStart(lang: Locale, a: Anchor) {
  return lang === "fa" ? fromJalali(a.y, a.m, 1) : `${a.y}-${String(a.m).padStart(2, "0")}-01`;
}
function daysIn(lang: Locale, a: Anchor) {
  return lang === "fa" ? jalaliMonthDays(a.y, a.m) : new Date(Date.UTC(a.y, a.m, 0)).getUTCDate();
}
function anchorOf(lang: Locale, iso: string): Anchor {
  if (lang === "fa") {
    const j = toJalali(iso);
    return { y: j.y, m: j.m };
  }
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) };
}
function shift(a: Anchor, by: number): Anchor {
  const idx = a.y * 12 + (a.m - 1) + by;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}
const dayIso = (lang: Locale, a: Anchor, d: number) => (lang === "fa" ? fromJalali(a.y, a.m, d) : `${a.y}-${String(a.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);

/**
 * A month calendar for choosing a day. Persian screens get the Jalali calendar, English screens the Gregorian one;
 * the week starts on Saturday in both. Days are "YYYY-MM-DD" strings in Tehran. `info` colours days and adds the
 * small badge; a day without info is not selectable unless `selectable` says so.
 */
export function JalaliMonth({
  lang,
  value,
  onSelect,
  info,
  today,
  min,
  max,
  selectable,
  initial,
}: {
  lang: Locale;
  value: string | null;
  onSelect: (iso: string) => void;
  info: Record<string, DayInfo>;
  today: string;
  /** the first and last day the user may page to */
  min?: string;
  max?: string;
  selectable?: (iso: string) => boolean;
  initial?: string;
}) {
  const reduce = useReducedMotion();
  const [anchor, setAnchor] = useState<Anchor>(() => anchorOf(lang, value ?? initial ?? today));
  const [dir, setDir] = useState(1);
  const cells = useMemo(() => {
    const first = monthStart(lang, anchor);
    const lead = weekdaySat0Iso(first);
    const n = daysIn(lang, anchor);
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: n }, (_, i) => dayIso(lang, anchor, i + 1))] as (string | null)[];
  }, [lang, anchor]);
  const title = lang === "fa" ? `${FA_MONTHS[anchor.m - 1]} ${num(String(anchor.y), lang)}` : new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(anchor.y, anchor.m - 1, 1)));
  const lo = min ? anchorOf(lang, min) : null;
  const hi = max ? anchorOf(lang, max) : null;
  const canPrev = !lo || lo.y * 12 + lo.m < anchor.y * 12 + anchor.m;
  const canNext = !hi || hi.y * 12 + hi.m > anchor.y * 12 + anchor.m;
  const move = (by: number) => {
    setDir(by);
    setAnchor((a) => shift(a, by));
  };
  const nav = "grid size-11 place-items-center rounded-full border border-line transition hover:border-ink/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30";
  const dayNumber = (iso: string) => (lang === "fa" ? toJalali(iso).d : Number(iso.slice(8, 10)));

  return (
    <div data-testid="month">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button type="button" onClick={() => move(-1)} disabled={!canPrev} aria-label={lang === "fa" ? "ماه قبل" : "Previous month"} className={nav}>
          <CaretRight className="size-5 ltr:rotate-180" />
        </button>
        <h3 className="font-display text-lg font-extrabold" aria-live="polite">
          {title}
        </h3>
        <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label={lang === "fa" ? "ماه بعد" : "Next month"} className={nav}>
          <CaretLeft className="size-5 ltr:rotate-180" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 pb-1.5 text-center text-xs text-muted" aria-hidden>
        {WEEKDAYS[lang].map((d) => (
          <span key={d} className="truncate">
            {lang === "fa" ? d.replace("شنبه", "ش").replace("یکش", "ی").replace("دوش", "د").replace("سه‌ش", "س").replace("چهارش", "چ").replace("پنجش", "پ").replace("جمعه", "ج") : d}
          </span>
        ))}
      </div>
      <motion.div
        key={`${anchor.y}-${anchor.m}`}
        initial={reduce ? false : { opacity: 0, x: dir * -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-7 gap-1"
        role="grid"
      >
        {cells.map((iso, i) => {
          if (!iso) return <span key={`b${i}`} />;
          const d = info[iso];
          const can = selectable ? selectable(iso) : !!d;
          const on = value === iso;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              data-day={iso}
              disabled={!can}
              aria-selected={on}
              aria-current={isToday ? "date" : undefined}
              onClick={() => onSelect(iso)}
              className={`relative flex h-[3.4rem] flex-col items-center justify-center rounded-2xl text-[15px] font-semibold tabular-nums transition active:scale-95 disabled:cursor-default sm:h-16 ${
                on ? "bg-ink text-bg shadow-md" : d?.tone ? tonal[d.tone] : "text-ink"
              } ${!can && !d?.tone ? "opacity-35" : ""} ${can && !on ? "hover:ring-2 hover:ring-ink/20" : ""} ${isToday && !on ? "ring-2 ring-accent" : ""} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40`}
            >
              {num(dayNumber(iso), lang)}
              {d?.badge && <span className={`mt-0.5 text-[10.5px] font-medium leading-none ${on ? "text-bg/80" : "text-muted"}`}>{d.badge}</span>}
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
