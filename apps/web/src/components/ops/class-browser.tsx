"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ClassQuick } from "./class-quick";
import { CalendarBlank, ChalkboardTeacher, Clock, MagnifyingGlass, MapPin, Monitor, Plus, SquaresFour, X } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { num, type Locale } from "@/lib/i18n";
import { fill } from "@/lib/format";

export type ClassRow = {
  id: string;
  title: string;
  course: string;
  teacherId: string | null;
  teacher: string | null;
  branchId: string | null;
  branch: string | null;
  online: boolean;
  weekday: number;
  start: string; // HH:MM
  end: string;
  n: number;
  capacity: number;
  active: boolean;
  bale: boolean;
  telegram: boolean;
  href: string;
};
export type TeacherInfo = { id: string; name: string; role: string | null; href: string };
type View = "weekday" | "teacher" | "branch" | "grid";
const VIEWS: View[] = ["weekday", "teacher", "branch", "grid"];

// One colour per coach (muted, translucent so it works on light and dark). The index is the coach's position.
const HUES = [28, 205, 150, 285, 350, 85, 235, 60];
const hue = (i: number) => HUES[((i % HUES.length) + HUES.length) % HUES.length]!;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hoursOf = (rows: ClassRow[]) => rows.reduce((s, r) => s + (mins(r.end) - mins(r.start)) / 60, 0);
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => [...w][0]).join("");

type Ctx = { tIndex: Map<string, number>; lang: Locale; c: OpsDict["cb"]; weekdays: readonly string[]; onOpen: (id: string) => void };

/** A plain click opens the quick panel; a modified click (new tab, new window) still goes to the class page. */
const openProps = (r: ClassRow, ctx: Ctx) => ({
  href: r.href,
  "data-class-id": r.id,
  "data-sfx": "swoosh",
  onClick: (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    ctx.onOpen(r.id);
  },
});

/** Minutes since midnight in Tehran, or null until the browser has said (keeps the server and first paint equal). */
function useTehranMinutes(): number | null {
  const [m, setM] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
      setM(get("hour") * 60 + get("minute"));
    };
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);
  return m;
}

function Avatar({ name, idx, size = "size-11" }: { name: string; idx: number; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full font-display text-sm font-extrabold`} style={{ background: `hsl(${hue(idx)} 65% 50% / 0.2)`, color: `hsl(${hue(idx)} 60% 32%)` }}>
      {initials(name)}
    </span>
  );
}

function Heading({ title, sub, action, avatar }: { title: string; sub?: string; action?: { href: string; label: string }; avatar?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-base font-bold leading-tight">{title}</h2>
        {sub && <p className="truncate text-[13px] text-muted">{sub}</p>}
      </div>
      {action && (
        <Link href={action.href} aria-label={action.label} title={action.label} className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-ink/30 hover:text-ink active:scale-95">
          <Plus weight="bold" className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** Seats as a small ring: filled share of the capacity, the number of students inside. */
function SeatRing({ n, capacity, color }: { n: number; capacity: number; color: string }) {
  const pct = Math.min(100, Math.round((n / Math.max(1, capacity)) * 100));
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums"
      style={{ background: `conic-gradient(${color} ${pct}%, hsl(0 0% 50% / 0.16) 0)` }}
      title={`${n}/${capacity}`}
    >
      <span className="grid size-[1.7rem] place-items-center rounded-full bg-surface">{n.toLocaleString("fa-IR")}</span>
    </span>
  );
}

/**
 * A class as a card. The top band names who it is about (the coach, or the weekday when the page is already grouped
 * by coach): that is what people scan for. Time, place and seats sit below the class name.
 */
function ClassCard({ r, showTeacher = true, ctx, i = 0 }: { r: ClassRow; showTeacher?: boolean; ctx: Ctx; i?: number }) {
  const { tIndex, lang, c, weekdays } = ctx;
  const idx = r.teacherId ? (tIndex.get(r.teacherId) ?? 0) : 0;
  const h = hue(idx);
  const accent = r.teacherId ? `hsl(${h} 65% 48%)` : "var(--muted)";
  const band = r.teacherId ? { background: `hsl(${h} 70% 52% / 0.14)`, color: `hsl(${h} 55% 26%)` } : { background: "hsl(0 0% 50% / 0.1)" };
  return (
    <Link
      {...openProps(r, ctx)}
      style={{ "--i": i } as React.CSSProperties}
      className={`rise group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-px hover:border-ink/25 hover:shadow-[0_8px_20px_-12px_rgb(0_0_0/0.3)] ${r.active ? "" : "opacity-55"}`}
    >
      <span className="flex items-center gap-2.5 px-3.5 py-2.5" style={band}>
        {showTeacher ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/70 text-[11px] font-extrabold dark:bg-black/30">{r.teacher ? initials(r.teacher) : "-"}</span>
        ) : (
          <CalendarBlank weight="duotone" className="size-5 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{showTeacher ? (r.teacher ?? c.noTeacherGroup) : (weekdays[r.weekday] ?? "")}</span>
        {!r.active && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-ink">{c.inactive}</span>}
      </span>
      <span className="flex items-start gap-3 p-3.5">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{r.title}</span>
          <span className="block truncate text-[13px] text-muted">{r.course}</span>
          <span className="mt-2.5 flex flex-wrap gap-1.5 text-[12.5px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-1 font-medium tabular-nums">
              <Clock weight="duotone" className="size-3.5" />
              {num(r.start, lang)} - {num(r.end, lang)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-1">
              {r.online ? <Monitor weight="duotone" className="size-3.5" /> : <MapPin weight="duotone" className="size-3.5" />}
              {r.online ? c.onlineGroup : r.branch}
            </span>
          </span>
        </span>
        <SeatRing n={r.n} capacity={r.capacity} color={accent} />
      </span>
    </Link>
  );
}

const CARD_GRID = "grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,21rem),1fr))]";

export function ClassBrowser({
  rows,
  teachers,
  branches,
  o,
  lang,
  weekdays,
  base,
  todayWd,
  initial,
}: {
  rows: ClassRow[];
  teachers: TeacherInfo[];
  branches: { id: string; name: string }[];
  o: OpsDict;
  lang: Locale;
  weekdays: readonly string[];
  base: string;
  todayWd: number;
  initial: { v?: string; t?: string; m?: string; q?: string; open?: string };
}) {
  const [view, setView] = useState<View>(VIEWS.includes(initial.v as View) ? (initial.v as View) : "weekday");
  const [teacher, setTeacher] = useState<string | null>(initial.t && teachers.some((t) => t.id === initial.t) ? initial.t : null);
  const [mode, setMode] = useState<"all" | "in_person" | "online">(initial.m === "online" || initial.m === "in_person" ? initial.m : "all");
  const [q, setQ] = useState(initial.q ?? "");
  const [openId, setOpenId] = useState<string | null>(initial.open && rows.some((r) => r.id === initial.open) ? initial.open : null);
  const nowMin = useTehranMinutes();
  const reduce = useReducedMotion();
  const c = o.cb;

  useEffect(() => {
    const p = new URLSearchParams();
    if (view !== "weekday") p.set("v", view);
    if (teacher) p.set("t", teacher);
    if (mode !== "all") p.set("m", mode);
    if (q.trim()) p.set("q", q.trim());
    if (openId) p.set("open", openId);
    window.history.replaceState(null, "", p.size ? `${base}?${p}` : base);
  }, [view, teacher, mode, q, openId, base]);

  const tIndex = useMemo(() => new Map(teachers.map((t, i) => [t.id, i])), [teachers]);
  const ctx: Ctx = { tIndex, lang, c, weekdays, onOpen: setOpenId };
  const filtered = useMemo(() => {
    const needle = q.trim();
    return rows.filter(
      (r) =>
        (!teacher || r.teacherId === teacher) &&
        (mode === "all" || (mode === "online" ? r.online : !r.online)) &&
        (!needle || [r.title, r.course, r.teacher ?? "", r.branch ?? ""].some((x) => x.includes(needle))),
    );
  }, [rows, teacher, mode, q]);
  const focus = teacher ? teachers.find((t) => t.id === teacher) : null;
  const filtering = !!teacher || mode !== "all" || !!q.trim();

  const newHref = (p: { teacher?: string | null; weekday?: number | null }) => {
    const s = new URLSearchParams();
    if (p.teacher) s.set("teacher", p.teacher);
    if (p.weekday != null) s.set("weekday", String(p.weekday));
    return `${base}/new${s.size ? `?${s}` : ""}`;
  };
  const stat = (list: ClassRow[]) => ({ c: num(list.length, lang), s: num(list.reduce((a, r) => a + r.n, 0), lang), h: num(Math.round(hoursOf(list) * 10) / 10, lang) });

  const grid = (list: ClassRow[]) => {
    // the hours that matter, with an hour of air on both sides (at least a 6 hour window)
    const first = Math.min(...list.map((r) => Math.floor(mins(r.start) / 60)), 12);
    const last = Math.max(...list.map((r) => Math.ceil(mins(r.end) / 60)), 18);
    const lo = Math.max(0, first - 1);
    const hi = Math.min(24, Math.max(last + 1, lo + 6));
    const PX = 60;
    const HDR = 26; // height of a card's coach band: the part of a stacked card that always stays visible
    const height = (hi - lo) * PX;
    const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const yOf = (t: string) => ((mins(t) - lo * 60) / 60) * PX;

    // Every column has the same width. Classes that overlap in time are stacked like a deck of cards: each one is
    // pushed down just enough that its coach band stays readable, and hovering brings a card to the front.
    const days = weekdays.map((d, wd) => {
      const day = list.filter((r) => r.weekday === wd).sort((a, b) => mins(a.start) - mins(b.start) || (tIndex.get(a.teacherId ?? "") ?? 0) - (tIndex.get(b.teacherId ?? "") ?? 0));
      const clusters: ClassRow[][] = [];
      let end = -1;
      for (const r of day) {
        if (clusters.length && mins(r.start) < end) clusters[clusters.length - 1]!.push(r);
        else clusters.push([r]);
        end = Math.max(end, mins(r.end));
      }
      const placed = clusters.flatMap((cl) => {
        let prev = -Infinity;
        return cl.map((r, depth) => {
          const top = Math.max(yOf(r.start), prev + HDR);
          prev = top;
          return { r, top, bottom: Math.max(yOf(r.end) - 2, top + HDR + 26), depth, count: cl.length };
        });
      });
      return { d, wd, placed };
    });
    const tallest = Math.max(height, ...days.flatMap((x) => x.placed.map((p) => p.bottom + 4)));

    return (
      <div className="rise hidden lg:block" data-testid="timetable">
        <div className="overflow-x-auto pb-2">
          <div className="grid gap-x-2" style={{ gridTemplateColumns: "3rem repeat(7, minmax(8.5rem, 1fr))" }}>
            <div />
            {days.map(({ d, wd }) => (
              <div key={d} className={`mb-2 flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 text-sm ${wd === todayWd ? "bg-accent/15 font-semibold" : "text-muted"}`}>
                {d}
                <Link href={newHref({ teacher, weekday: wd })} aria-label={fill(c.newOn, { day: d })} title={fill(c.newOn, { day: d })} className="grid size-6 place-items-center rounded-full hover:bg-ink/10">
                  <Plus weight="bold" className="size-3.5" />
                </Link>
              </div>
            ))}
            <div className="relative" style={{ height: tallest }}>
              {hours.map((h) => (
                <span key={h} className="absolute -translate-y-1/2 text-xs tabular-nums text-muted" style={{ top: (h - lo) * PX }}>
                  {num(`${String(h).padStart(2, "0")}:00`, lang)}
                </span>
              ))}
            </div>
            {days.map(({ d, wd, placed }) => (
              <div
                key={d}
                className={`relative rounded-xl border ${wd === todayWd ? "border-accent/40 bg-accent/[0.04]" : "border-line"}`}
                style={{ height: tallest, backgroundImage: "linear-gradient(to bottom, var(--line) 1px, transparent 1px)", backgroundSize: `100% ${PX}px` }}
              >
                {wd === todayWd && nowMin != null && nowMin >= lo * 60 && nowMin <= hi * 60 && (
                  <span data-testid="now-line" className="pointer-events-none absolute inset-x-0 z-20 h-px bg-accent" style={{ top: ((nowMin - lo * 60) / 60) * PX }}>
                    <span className="absolute -top-2 start-0 rounded-full bg-accent px-1.5 text-[10px] font-bold leading-4 text-on-accent">{c.now}</span>
                  </span>
                )}
                {placed.map(({ r, top, bottom, depth, count }) => {
                  const idx = r.teacherId ? (tIndex.get(r.teacherId) ?? 0) : 0;
                  const h = hue(idx);
                  return (
                    <Link
                      key={r.id}
                      {...openProps(r, ctx)}
                      style={{
                        top: top + 1,
                        height: bottom - top,
                        zIndex: depth + 1,
                        insetInlineStart: 3 + depth * 5,
                        width: `calc(100% - ${6 + (count - 1) * 5}px)`,
                        borderColor: r.teacherId ? `hsl(${h} 60% 46% / 0.55)` : undefined,
                      }}
                      className={`absolute flex flex-col overflow-hidden rounded-lg border bg-surface text-xs shadow-[0_1px_3px_rgb(0_0_0/0.12)] transition hover:z-30 hover:shadow-lg focus-visible:z-30 ${r.active ? "" : "opacity-55"}`}
                      title={`${r.teacher ?? ""}\n${r.title}\n${num(r.start, lang)} - ${num(r.end, lang)}`}
                    >
                      <span className="flex shrink-0 items-center gap-1.5 px-2 font-bold" style={{ height: HDR, background: r.teacherId ? `hsl(${h} 70% 52% / 0.2)` : "hsl(0 0% 50% / 0.12)", color: r.teacherId ? `hsl(${h} 55% 24%)` : undefined }}>
                        <span className="truncate">{r.teacher ?? c.noTeacherGroup}</span>
                      </span>
                      <span className="block px-2 pt-1">
                        <span className="block font-medium leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{r.title}</span>
                        <span className="mt-0.5 block text-[11px] tabular-nums text-muted">
                          {num(r.start, lang)} - {num(r.end, lang)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{c.gridHint}</p>
      </div>
    );
  };

  /**
   * Weekday view on a desktop: one row per day, each class laid out along the hours so its width is its length.
   * Classes that overlap move to their own lane inside the day instead of squeezing each other.
   */
  const timeline = (list: ClassRow[]) => {
    const starts = list.map((r) => mins(r.start));
    const ends = list.map((r) => mins(r.end));
    const lo = Math.max(0, Math.floor(Math.min(...starts, 15 * 60) / 60));
    const hi = Math.min(24, Math.max(Math.ceil(Math.max(...ends, 19 * 60) / 60), lo + 5));
    const span = hi - lo;
    const HOUR = 84;
    const LANE = 70;
    const pct = (m: number) => ((m - lo * 60) / (span * 60)) * 100;
    const hours = Array.from({ length: span + 1 }, (_, i) => lo + i);
    const rowsByDay = weekdays.map((d, wd) => {
      const day = list.filter((r) => r.weekday === wd).sort((a, b) => mins(a.start) - mins(b.start) || mins(a.end) - mins(b.end));
      const laneEnd: number[] = [];
      const placed = day.map((r) => {
        let lane = laneEnd.findIndex((e) => e <= mins(r.start));
        if (lane < 0) lane = laneEnd.length;
        laneEnd[lane] = mins(r.end);
        return { r, lane };
      });
      return { d, wd, placed, lanes: Math.max(1, laneEnd.length) };
    });
    const nowShown = nowMin != null && nowMin >= lo * 60 && nowMin <= hi * 60;

    return (
      <div className="rise hidden lg:block" data-testid="day-timeline">
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <div style={{ minWidth: `calc(7.5rem + ${span * HOUR}px)` }}>
            <div className="grid" style={{ gridTemplateColumns: "7.5rem 1fr" }}>
              <div className="sticky start-0 z-10 border-b border-line bg-surface" />
              <div className="relative h-8 border-b border-line">
                {hours.filter((h) => h < hi).map((h) => (
                  <span key={h} className="absolute top-1/2 -translate-y-1/2 ps-1.5 text-xs tabular-nums text-muted" style={{ insetInlineStart: `${((h - lo) / span) * 100}%` }}>
                    {num(`${String(h).padStart(2, "0")}:00`, lang)}
                  </span>
                ))}
              </div>
              {rowsByDay.map(({ d, wd, placed, lanes }, di) => (
                <div key={d} className="contents" data-testid="timeline-day">
                  <div className={`sticky start-0 z-10 flex flex-col justify-center gap-1 border-b border-line p-3 ${wd === todayWd ? "bg-accent/10" : "bg-surface"}`}>
                    <span className={`flex items-center gap-1.5 text-sm ${wd === todayWd ? "font-bold" : "font-semibold"}`}>
                      {d}
                      {wd === todayWd && <span className="rounded-full bg-accent/25 px-1.5 text-[10px] font-semibold text-accent-text">{c.today}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      {fill(c.classesCount, { n: num(placed.length, lang) })}
                      <Link href={newHref({ teacher, weekday: wd })} aria-label={fill(c.newOn, { day: d })} title={fill(c.newOn, { day: d })} className="grid size-6 place-items-center rounded-full hover:bg-ink/10 hover:text-ink">
                        <Plus weight="bold" className="size-3.5" />
                      </Link>
                    </span>
                  </div>
                  <div
                    className={`relative border-b border-line ${wd === todayWd ? "bg-accent/[0.04]" : ""}`}
                    style={{
                      height: lanes * LANE + 8,
                      backgroundImage: "linear-gradient(to right, var(--line) 1px, transparent 1px)",
                      backgroundSize: `${100 / span}% 100%`,
                    }}
                  >
                    {placed.map(({ r, lane }, pi) => {
                      const h = hue(r.teacherId ? (tIndex.get(r.teacherId) ?? 0) : 0);
                      return (
                        <Link
                          key={r.id}
                          {...openProps(r, ctx)}
                          title={`${r.teacher ?? ""}\n${r.title}\n${num(r.start, lang)} - ${num(r.end, lang)}`}
                          style={{
                            insetInlineStart: `calc(${pct(mins(r.start))}% + 2px)`,
                            width: `calc(${((mins(r.end) - mins(r.start)) / (span * 60)) * 100}% - 4px)`,
                            top: 4 + lane * LANE,
                            height: LANE - 6,
                            "--i": di + pi,
                            borderColor: r.teacherId ? `hsl(${h} 60% 46% / 0.5)` : undefined,
                          } as React.CSSProperties}
                          className={`rise absolute flex flex-col overflow-hidden rounded-xl border bg-surface text-xs shadow-[0_1px_3px_rgb(0_0_0/0.1)] transition hover:z-20 hover:-translate-y-px hover:shadow-lg focus-visible:z-20 ${r.active ? "" : "opacity-55"}`}
                        >
                          <span className="flex h-6 shrink-0 items-center gap-1.5 px-2.5 text-[12.5px] font-bold" style={{ background: r.teacherId ? `hsl(${h} 70% 52% / 0.2)` : "hsl(0 0% 50% / 0.12)", color: r.teacherId ? `hsl(${h} 55% 24%)` : undefined }}>
                            <span className="truncate">{r.teacher ?? c.noTeacherGroup}</span>
                            <span className="ms-auto shrink-0 text-[11px] font-medium tabular-nums opacity-75">
                              {num(r.n, lang)}/{num(r.capacity, lang)}
                            </span>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col justify-center px-2.5">
                            <span className="truncate font-medium">{r.title}</span>
                            <span className="truncate text-[11px] tabular-nums text-muted">
                              {num(r.start, lang)} - {num(r.end, lang)}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                    {wd === todayWd && nowShown && (
                      <span data-testid="now-line" className="pointer-events-none absolute inset-y-0 z-10 w-px bg-accent" style={{ insetInlineStart: `${pct(nowMin!)}%` }}>
                        <span className="absolute -top-px start-1/2 -translate-x-1/2 rounded-b-md bg-accent px-1.5 text-[10px] font-bold leading-4 text-on-accent [html[dir=rtl]_&]:translate-x-1/2">{c.now}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{c.timelineHint}</p>
      </div>
    );
  };

  const byWeekday = (list: ClassRow[], keepEmpty = false, withTimeline = false) => (
    <>
    {withTimeline && timeline(list)}
    <div className={`flex flex-col gap-7 ${withTimeline ? "lg:hidden" : ""}`} data-testid="class-days">
      {weekdays.map((d, wd) => {
        const day = list.filter((r) => r.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
        if (!day.length && !keepEmpty) return null;
        return (
          <section key={d}>
            <Heading
              title={d}
              sub={fill(c.classesCount, { n: num(day.length, lang) })}
              avatar={wd === todayWd ? <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-accent-text">{c.today}</span> : undefined}
              action={{ href: newHref({ teacher, weekday: wd }), label: fill(c.newOn, { day: d }) }}
            />
            <div className={CARD_GRID}>{day.map((r, i) => (
                <ClassCard key={r.id} r={r} showTeacher={!teacher} ctx={ctx} i={i} />
              ))}</div>
          </section>
        );
      })}
    </div>
    </>
  );

  const grouped = (kind: "teacher" | "branch") => {
    type Group = { key: string; title: string; t: TeacherInfo | null; list: ClassRow[] };
    const groups: Group[] =
      kind === "teacher"
        ? [
            ...teachers.filter((t) => !teacher || t.id === teacher).map((t) => ({ key: t.id, title: t.name, t, list: filtered.filter((r) => r.teacherId === t.id) })),
            { key: "-", title: c.noTeacherGroup, t: null, list: filtered.filter((r) => !r.teacherId) },
          ]
        : [
            ...branches.map((b) => ({ key: b.id, title: b.name, t: null, list: filtered.filter((r) => r.branchId === b.id) })),
            { key: "online", title: c.onlineGroup, t: null, list: filtered.filter((r) => !r.branchId) },
          ];
    return (
      <div className="flex flex-col gap-9" data-testid="class-groups">
        {groups
          .filter((g) => g.list.length > 0 || (kind === "teacher" && g.t && !filtering))
          .map((g) => (
            <section key={g.key} data-testid="group">
              <Heading
                title={g.title}
                sub={g.t ? (g.t.role ?? undefined) : fill(c.summary, stat(g.list))}
                avatar={g.t ? <Avatar name={g.t.name} idx={tIndex.get(g.t.id) ?? 0} /> : undefined}
                action={g.t ? { href: newHref({ teacher: g.t.id }), label: fill(c.newFor, { name: g.t.name }) } : undefined}
              />
              {g.t && <p className="-mt-1 mb-3 text-sm text-muted">{fill(c.summary, stat(g.list))}</p>}
              {g.list.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">{c.noClasses}</p>
              ) : (
                <div className={CARD_GRID}>
                  {[...g.list]
                    .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
                    .map((r, i) => (
                      <ClassCard key={r.id} r={r} showTeacher={kind !== "teacher"} ctx={ctx} i={i} />
                    ))}
                </div>
              )}
            </section>
          ))}
      </div>
    );
  };

  const viewIcon = { weekday: CalendarBlank, teacher: ChalkboardTeacher, branch: MapPin, grid: SquaresFour } as const;

  return (
    <div className="flex flex-col gap-5">
      {/* tools */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="tablist" aria-label={c.viewLabel} className="flex w-full rounded-full border border-line bg-surface p-1 sm:w-auto" data-testid="view-switch">
            {VIEWS.map((v) => {
              const Ico = viewIcon[v];
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className="relative inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[13px] text-muted transition-colors hover:text-ink aria-selected:text-bg sm:flex-none sm:px-3.5 sm:text-sm"
                >
                  {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full bg-ink" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38 }} />}
                  <Ico weight="duotone" className="relative hidden size-4 sm:block" />
                  <span className="relative">{c.views[v]}</span>
                </button>
              );
            })}
          </div>
          <label className="relative min-w-0 flex-1 basis-56">
            <MagnifyingGlass className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={c.search}
              aria-label={c.search}
              className="h-11 w-full rounded-full border border-line bg-surface ps-10 pe-4 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>
          <div className="flex rounded-full border border-line bg-surface p-1" role="group">
            {(["all", "in_person", "online"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className="h-9 rounded-full px-3.5 text-sm text-muted transition hover:text-ink aria-pressed:bg-ink/10 aria-pressed:font-medium aria-pressed:text-ink">
                {c.modes[m]}
              </button>
            ))}
          </div>
        </div>

        {/* one coach at a time, or everyone */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={c.allTeachers} data-testid="teacher-chips">
          <button
            type="button"
            aria-pressed={!teacher}
            onClick={() => setTeacher(null)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-sm transition hover:border-ink/30 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
          >
            {c.allTeachers}
            <span className="text-xs opacity-70">{num(rows.length, lang)}</span>
          </button>
          {teachers.map((t) => {
            const cnt = rows.filter((r) => r.teacherId === t.id).length;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={teacher === t.id}
                onClick={() => setTeacher(teacher === t.id ? null : t.id)}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line ps-1.5 pe-4 text-sm transition hover:border-ink/30 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
              >
                <Avatar name={t.name} idx={tIndex.get(t.id) ?? 0} size="size-8" />
                {t.name}
                <span className="text-xs opacity-70">{num(cnt, lang)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* focus banner / summary */}
      {focus ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5" data-testid="focus">
          <Avatar name={focus.name} idx={tIndex.get(focus.id) ?? 0} size="size-14" />
          <div className="min-w-0 flex-1 basis-40">
            <h2 className="truncate font-display text-xl font-extrabold">{focus.name}</h2>
            <p className="text-sm text-muted">{fill(c.summary, stat(filtered))}</p>
          </div>
          <div className="flex basis-full flex-wrap gap-2 sm:basis-auto">
            <Link href={newHref({ teacher: focus.id })} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-strong">
              <Plus weight="bold" className="size-4" />
              {o.dash.newClass}
            </Link>
            <Link href={focus.href} className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm hover:border-ink/30">
              {c.profile}
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted" data-testid="summary">
          {fill(c.summary, stat(filtered))}
        </p>
      )}

      {filtered.length === 0 && view !== "teacher" ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line p-8 text-center">
          <p className="font-medium">{c.noMatch}</p>
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setTeacher(null);
                setMode("all");
                setQ("");
              }}
              className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm hover:border-ink/30"
            >
              <X className="size-4" />
              {c.clear}
            </button>
          )}
        </div>
      ) : view === "weekday" ? (
        byWeekday(filtered, false, true)
      ) : view === "teacher" ? (
        grouped("teacher")
      ) : view === "branch" ? (
        grouped("branch")
      ) : (
        <>
          {grid(filtered)}
          <div className="lg:hidden">{byWeekday(filtered)}</div>
        </>
      )}

      <AnimatePresence>
        {openId && (
          <ClassQuick
            key={openId}
            id={openId}
            o={o}
            lang={lang}
            weekdays={weekdays}
            teachers={teachers.map((t, i) => ({ id: t.id, name: t.name, hue: hue(i) }))}
            fullHref={rows.find((r) => r.id === openId)?.href ?? base}
            onClose={() => setOpenId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
