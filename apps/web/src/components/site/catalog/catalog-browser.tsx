"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpLeft, CaretDown, Monitor, UsersThree } from "@phosphor-icons/react";
import type { Dict, Locale } from "@/lib/i18n";
import { href, num } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { DeptIcon } from "../dept-icon";

export type CatalogCourse = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  dept: string | null;
  ageMin: number | null;
  ageMax: number | null;
  ages: string | null;
  modes: ("in_person" | "online" | "hybrid")[];
  price: string | null;
};
export type CatalogDept = { slug: string; title: string; icon: string | null };
type Mode = "in_person" | "online";
type Labels = Dict["catalog"] & { modes: Dict["modes"] };

const pill =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition active:scale-[0.98] aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg border-line text-muted hover:border-ink/25 hover:text-ink";

export function CourseCard({ c, dept, lang, labels }: { c: CatalogCourse; dept?: CatalogDept; lang: Locale; labels: Labels }) {
  return (
    <Link
      href={href(lang, `/courses/${c.slug}`)}
      className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 transition duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-accent/60"
    >
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text">
            <DeptIcon icon={dept?.icon} className="size-5" />
          </span>
          <span className="truncate">{dept?.title}</span>
        </span>
        {c.ages && (
          <span className="shrink-0 rounded-full bg-ink/5 px-3 py-1 font-medium text-ink tabular-nums">
            {c.ages} {labels.years}
          </span>
        )}
      </div>
      <h2 className="mt-6 font-display text-2xl font-extrabold tracking-tight">{c.title}</h2>
      {c.summary && <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{c.summary}</p>}
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <div className="flex flex-wrap gap-1.5">
          {c.modes.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-muted">
              {m === "online" ? <Monitor className="size-3.5" /> : <UsersThree className="size-3.5" />}
              {labels.modes[m]}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          {c.price && <span className="text-muted">{c.price}</span>}
          <ArrowUpLeft weight="bold" className="size-4 shrink-0 text-accent-text transition group-hover:-translate-x-0.5 ltr:-scale-x-100 ltr:group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function CourseGrid({ courses, depts, lang, labels }: { courses: CatalogCourse[]; depts: CatalogDept[]; lang: Locale; labels: Labels }) {
  const bySlug = new Map(depts.map((d) => [d.slug, d]));
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <li key={c.id}>
          <CourseCard c={c} dept={c.dept ? bySlug.get(c.dept) : undefined} lang={lang} labels={labels} />
        </li>
      ))}
    </ul>
  );
}

/** Filters run in the browser over the full (small) catalog and are mirrored to the URL so a filtered view can be shared. */
export function CatalogBrowser({ courses, depts, lang, labels }: { courses: CatalogCourse[]; depts: CatalogDept[]; lang: Locale; labels: Labels }) {
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const [dept, setDept] = useState<string | null>(() => {
    const d = params.get("d");
    return d && depts.some((x) => x.slug === d) ? d : null;
  });
  const [age, setAge] = useState<number | null>(() => {
    const a = Number(params.get("age"));
    return Number.isInteger(a) && a > 0 ? a : null;
  });
  const [mode, setMode] = useState<Mode | null>(() => {
    const m = params.get("mode");
    return m === "online" || m === "in_person" ? m : null;
  });

  const sync = (next: { d: string | null; age: number | null; mode: Mode | null }) => {
    const q = new URLSearchParams();
    if (next.d) q.set("d", next.d);
    if (next.age) q.set("age", String(next.age));
    if (next.mode) q.set("mode", next.mode);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  };
  const update = (patch: Partial<{ d: string | null; age: number | null; mode: Mode | null }>) => {
    const next = { d: dept, age, mode, ...patch };
    setDept(next.d);
    setAge(next.age);
    setMode(next.mode);
    sync(next);
  };

  const ages = useMemo(() => {
    const lo = Math.min(...courses.map((c) => c.ageMin ?? 99));
    const hi = Math.max(...courses.map((c) => c.ageMax ?? 0));
    return lo <= hi ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : [];
  }, [courses]);

  const shown = courses.filter(
    (c) =>
      (!dept || c.dept === dept) &&
      (!age || ((c.ageMin ?? 0) <= age && age <= (c.ageMax ?? 99))) &&
      (!mode || c.modes.includes(mode) || c.modes.includes("hybrid")),
  );
  const bySlug = new Map(depts.map((d) => [d.slug, d]));
  const filtered = dept || age || mode;

  return (
    <>
      <div className="sticky top-[68px] z-20 -mx-4 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:px-0" role="group" aria-label={labels.filterDept}>
            <button type="button" aria-pressed={!dept} onClick={() => update({ d: null })} className={pill}>
              {labels.all}
            </button>
            {depts.map((d) => (
              <button key={d.slug} type="button" aria-pressed={dept === d.slug} onClick={() => update({ d: dept === d.slug ? null : d.slug })} className={pill}>
                <DeptIcon icon={d.icon} className="size-4" />
                {d.title}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 lg:ms-auto">
            <label className="relative">
              <span className="sr-only">{labels.filterAge}</span>
              <select
                value={age ?? ""}
                onChange={(e) => update({ age: e.target.value ? Number(e.target.value) : null })}
                className={`${pill} appearance-none pe-9 ${age ? "border-ink bg-ink text-bg" : ""}`}
              >
                <option value="">{labels.anyAge}</option>
                {ages.map((n) => (
                  <option key={n} value={n}>
                    {fill(labels.ageValue, { n: num(n, lang) })}
                  </option>
                ))}
              </select>
              <CaretDown weight="bold" aria-hidden className={`pointer-events-none absolute end-3.5 top-1/2 size-3.5 -translate-y-1/2 ${age ? "text-bg" : "text-muted"}`} />
            </label>
            <div className="flex rounded-full border border-line p-1" role="group" aria-label={labels.filterMode}>
              {(["in_person", "online"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => update({ mode: mode === m ? null : m })}
                  className="h-8 rounded-full px-3.5 text-sm text-muted transition aria-pressed:bg-accent aria-pressed:font-medium aria-pressed:text-on-accent"
                >
                  {labels.modes[m]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {fill(labels.found, { n: num(shown.length, lang) })}
      </p>

      {shown.length === 0 ? (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-dashed border-line p-10">
          <p className="text-lg">{labels.empty}</p>
          <button type="button" onClick={() => update({ d: null, age: null, mode: null })} className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-bg active:scale-[0.98]">
            {labels.reset}
          </button>
        </div>
      ) : (
        <motion.ul layout={!reduce} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((c) => (
              <motion.li
                key={c.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
              >
                <CourseCard c={c} dept={c.dept ? bySlug.get(c.dept) : undefined} lang={lang} labels={labels} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
      {filtered && shown.length > 0 && (
        <button type="button" onClick={() => update({ d: null, age: null, mode: null })} className="mt-8 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {labels.reset}
        </button>
      )}
    </>
  );
}
