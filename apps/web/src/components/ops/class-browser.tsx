"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarBlank, ChalkboardTeacher, MagnifyingGlass, MapPin, Monitor, Plus, SquaresFour, X } from "@phosphor-icons/react";
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
const tone = (i: number) => ({
  background: `hsl(${hue(i)} 70% 52% / 0.12)`,
  borderColor: `hsl(${hue(i)} 60% 46% / 0.4)`,
  ["--strip" as string]: `hsl(${hue(i)} 65% 50%)`,
});

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hoursOf = (rows: ClassRow[]) => rows.reduce((s, r) => s + (mins(r.end) - mins(r.start)) / 60, 0);
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => [...w][0]).join("");

type Ctx = { tIndex: Map<string, number>; lang: Locale; c: OpsDict["cb"] };

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

function ClassCard({ r, showTeacher = true, ctx }: { r: ClassRow; showTeacher?: boolean; ctx: Ctx }) {
  const { tIndex, lang, c } = ctx;
  const idx = r.teacherId ? (tIndex.get(r.teacherId) ?? 0) : 0;
  const h = hue(idx);
  const accent = r.teacherId ? `hsl(${h} 65% 48%)` : "var(--muted)";
  return (
    <Link
      href={r.href}
      className={`group flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-3 transition hover:-translate-y-px hover:border-ink/25 hover:shadow-[0_6px_18px_-10px_rgb(0_0_0/0.25)] ${r.active ? "" : "opacity-55"}`}
    >
      <span
        className="flex w-14 shrink-0 flex-col items-center justify-center self-stretch rounded-xl py-1.5 leading-none"
        style={{ background: r.teacherId ? `hsl(${h} 70% 52% / 0.13)` : "hsl(0 0% 50% / 0.1)", color: r.teacherId ? `hsl(${h} 55% 30%)` : undefined }}
      >
        <span className="font-display text-[15px] font-black tabular-nums">{num(r.start, lang)}</span>
        <span className="mt-1.5 text-[11px] tabular-nums opacity-65">{num(r.end, lang)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{r.title}</span>
        <span className="block truncate text-[13px] text-muted">{r.course}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {showTeacher && (
            <span className="inline-flex max-w-full items-center gap-1.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold" style={{ background: `hsl(${h} 65% 50% / 0.2)`, color: `hsl(${h} 60% 30%)` }}>
                {r.teacher ? initials(r.teacher) : "-"}
              </span>
              <span className="truncate">{r.teacher ?? c.noTeacherGroup}</span>
            </span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1">
            {r.online ? <Monitor weight="duotone" className="size-3.5" /> : <MapPin weight="duotone" className="size-3.5" />}
            <span>{r.online ? c.onlineGroup : r.branch}</span>
          </span>
          {!r.active && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px]">{c.inactive}</span>}
        </span>
      </span>
      <SeatRing n={r.n} capacity={r.capacity} color={accent} />
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
  initial: { v?: string; t?: string; m?: string; q?: string };
}) {
  const [view, setView] = useState<View>(VIEWS.includes(initial.v as View) ? (initial.v as View) : "weekday");
  const [teacher, setTeacher] = useState<string | null>(initial.t && teachers.some((t) => t.id === initial.t) ? initial.t : null);
  const [mode, setMode] = useState<"all" | "in_person" | "online">(initial.m === "online" || initial.m === "in_person" ? initial.m : "all");
  const [q, setQ] = useState(initial.q ?? "");
  const c = o.cb;

  useEffect(() => {
    const p = new URLSearchParams();
    if (view !== "weekday") p.set("v", view);
    if (teacher) p.set("t", teacher);
    if (mode !== "all") p.set("m", mode);
    if (q.trim()) p.set("q", q.trim());
    window.history.replaceState(null, "", p.size ? `${base}?${p}` : base);
  }, [view, teacher, mode, q, base]);

  const tIndex = useMemo(() => new Map(teachers.map((t, i) => [t.id, i])), [teachers]);
  const ctx: Ctx = { tIndex, lang, c };
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
    const height = (hi - lo) * PX;
    const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

    // Lay each day out: classes that overlap in time sit side by side in lanes.
    const days = weekdays.map((d, wd) => {
      const day = list.filter((r) => r.weekday === wd).sort((a, b) => mins(a.start) - mins(b.start) || mins(b.end) - mins(a.end));
      const laneEnd: number[] = [];
      const placed = day.map((r) => {
        let lane = laneEnd.findIndex((end) => end <= mins(r.start));
        if (lane < 0) lane = laneEnd.length;
        laneEnd[lane] = mins(r.end);
        return { r, lane, lanes: 1 };
      });
      // every block shares the width of the busiest moment it takes part in
      for (const p of placed) p.lanes = Math.max(...placed.filter((x) => mins(x.r.start) < mins(p.r.end) && mins(x.r.end) > mins(p.r.start)).map((x) => x.lane)) + 1;
      return { d, wd, placed, lanes: Math.max(1, ...placed.map((p) => p.lanes)) };
    });
    // A busy day gets a wider column (roughly 5.5rem per simultaneous class), so five coaches at one hour stay readable.
    const columns = days.map((x) => `minmax(max(7.5rem, ${x.lanes * 5.5}rem), ${x.lanes}fr)`).join(" ");

    return (
      <div className="hidden lg:block" data-testid="timetable">
        <div className="overflow-x-auto pb-2">
          <div className="grid gap-x-2" style={{ gridTemplateColumns: `3rem ${columns}` }}>
            <div />
            {days.map(({ d, wd, lanes }) => (
              <div key={d} className={`mb-2 flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 text-sm ${wd === todayWd ? "bg-accent/15 font-semibold" : "text-muted"}`}>
                <span>
                  {d}
                  {lanes >= 3 && <span className="ms-1.5 rounded-full bg-ink/10 px-1.5 text-[11px] font-medium text-ink">{num(lanes, lang)}×</span>}
                </span>
                <Link href={newHref({ teacher, weekday: wd })} aria-label={fill(c.newOn, { day: d })} title={fill(c.newOn, { day: d })} className="grid size-6 place-items-center rounded-full hover:bg-ink/10">
                  <Plus weight="bold" className="size-3.5" />
                </Link>
              </div>
            ))}
            <div className="relative" style={{ height }}>
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
                style={{ height, backgroundImage: "linear-gradient(to bottom, var(--line) 1px, transparent 1px)", backgroundSize: `100% ${PX}px` }}
              >
                {placed.map(({ r, lane, lanes }) => {
                  const top = ((mins(r.start) - lo * 60) / 60) * PX;
                  const h = Math.max(((mins(r.end) - mins(r.start)) / 60) * PX - 3, 34);
                  const idx = r.teacherId ? (tIndex.get(r.teacherId) ?? 0) : 0;
                  const compact = lanes >= 6; // far too narrow for text: coach initials and the time
                  return (
                    <Link
                      key={r.id}
                      href={r.href}
                      style={{ ...(r.teacherId ? tone(idx) : {}), top: top + 1, height: h, insetInlineStart: `calc(${(lane / lanes) * 100}% + 1px)`, width: `calc(${100 / lanes}% - 2px)` }}
                      className={`absolute overflow-hidden rounded-lg border text-xs leading-snug transition hover:z-10 hover:shadow-md ${compact ? "px-1 py-1" : "px-2 py-1"} ${r.active ? "" : "opacity-55"}`}
                      title={`${num(r.start, lang)} - ${num(r.end, lang)}\n${r.title}\n${r.teacher ?? ""}`}
                    >
                      <span className="absolute inset-y-0 start-0 w-1" style={{ background: r.teacherId ? "var(--strip)" : "var(--line)" }} aria-hidden />
                      <span className="block ps-1 font-bold tabular-nums">{num(r.start, lang)}</span>
                      {compact ? (
                        <span className="mt-1 block ps-1 text-[11px] font-semibold">{r.teacher ? initials(r.teacher) : "-"}</span>
                      ) : (
                        <>
                          {lanes >= 3 && r.teacher && <span className="block truncate ps-1 text-[11px] font-semibold">{r.teacher.split(" ")[0]}</span>}
                          <span className={`block ps-1 [display:-webkit-box] [-webkit-box-orient:vertical] overflow-hidden ${lanes >= 3 ? "text-[11px] text-muted [-webkit-line-clamp:2]" : "font-medium [-webkit-line-clamp:2]"}`}>{r.title}</span>
                          {lanes < 3 && h > 70 && r.teacher && <span className="block truncate ps-1 text-muted">{r.teacher}</span>}
                        </>
                      )}
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

  const byWeekday = (list: ClassRow[], keepEmpty = false) => (
    <div className="flex flex-col gap-7" data-testid="class-days">
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
            <div className={CARD_GRID}>{day.map((r) => (
                <ClassCard key={r.id} r={r} showTeacher={!teacher} ctx={ctx} />
              ))}</div>
          </section>
        );
      })}
    </div>
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
                    .map((r) => (
                      <ClassCard key={r.id} r={r} showTeacher={kind !== "teacher"} ctx={ctx} />
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
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[13px] sm:px-3.5 sm:text-sm text-muted transition hover:text-ink aria-selected:bg-ink aria-selected:text-bg sm:flex-none"
                >
                  <Ico weight="duotone" className="hidden size-4 sm:block" />
                  {c.views[v]}
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
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={c.allTeachers} data-testid="teacher-chips">
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
        byWeekday(filtered)
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
    </div>
  );
}
