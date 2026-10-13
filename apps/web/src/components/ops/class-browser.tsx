"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarBlank, ChalkboardTeacher, MagnifyingGlass, MapPin, Monitor, Plus, SquaresFour, UserCircle, X } from "@phosphor-icons/react";
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
        <h2 className="truncate font-display text-lg font-bold">{title}</h2>
        {sub && <p className="truncate text-sm text-muted">{sub}</p>}
      </div>
      {action && (
        <Link href={action.href} aria-label={action.label} title={action.label} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm transition hover:border-ink/30 active:scale-[0.98]">
          <Plus weight="bold" className="size-4" />
          <span className="hidden sm:inline">{action.label}</span>
        </Link>
      )}
    </div>
  );
}

function ClassCard({ r, showTeacher = true, ctx }: { r: ClassRow; showTeacher?: boolean; ctx: Ctx }) {
  const { tIndex, lang, c } = ctx;
  const idx = r.teacherId ? (tIndex.get(r.teacherId) ?? 0) : 0;
  return (
    <Link
      href={r.href}
      style={r.teacherId ? tone(idx) : undefined}
      className={`group relative flex flex-col gap-2.5 overflow-hidden rounded-[var(--radius-card)] border bg-surface p-4 ps-5 transition hover:-translate-y-0.5 hover:shadow-sm ${r.teacherId ? "" : "border-line"} ${r.active ? "" : "opacity-55"}`}
    >
      <span className="absolute inset-y-0 start-0 w-1.5" style={{ background: r.teacherId ? "var(--strip)" : "var(--line)" }} aria-hidden />
      <span className="flex items-start justify-between gap-3">
        <span className="font-display text-xl font-black leading-none tabular-nums">
          {num(r.start, lang)}
          <span className="mx-1 text-sm font-normal text-muted">-</span>
          {num(r.end, lang)}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.n >= r.capacity ? "bg-accent/20 text-accent-text" : "bg-ink/5"}`}>
          {num(r.n, lang)}/{num(r.capacity, lang)}
        </span>
      </span>
      <span>
        <span className="block font-semibold leading-snug">{r.title}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">{r.course}</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {showTeacher && (
          <span className="inline-flex items-center gap-1.5">
            <UserCircle weight="duotone" className="size-4" />
            {r.teacher ?? c.noTeacherGroup}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          {r.online ? <Monitor weight="duotone" className="size-4" /> : <MapPin weight="duotone" className="size-4" />}
          {r.online ? c.onlineGroup : r.branch}
        </span>
        {!r.active && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs">{c.inactive}</span>}
      </span>
    </Link>
  );
}

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
    const lo = Math.min(8, ...list.map((r) => Math.floor(mins(r.start) / 60)));
    const hi = Math.max(20, ...list.map((r) => Math.ceil(mins(r.end) / 60)));
    const PX = 60;
    const height = (hi - lo) * PX;
    const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    return (
      <div className="hidden lg:block" data-testid="timetable">
        <div className="grid gap-x-2" style={{ gridTemplateColumns: "3rem repeat(7, minmax(0, 1fr))" }}>
          <div />
          {weekdays.map((d, wd) => (
            <div key={d} className={`mb-2 flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm ${wd === todayWd ? "bg-accent/15 font-semibold" : "text-muted"}`}>
              {d}
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
          {weekdays.map((d, wd) => {
            const day = list.filter((r) => r.weekday === wd).sort((a, b) => mins(a.start) - mins(b.start));
            // overlapping classes share the column side by side
            const lanes: number[] = [];
            const placed = day.map((r) => {
              let lane = lanes.findIndex((end) => end <= mins(r.start));
              if (lane < 0) lane = lanes.length;
              lanes[lane] = mins(r.end);
              return { r, lane };
            });
            const cluster = (p: (typeof placed)[number]) => {
              const peers = placed.filter((x) => mins(x.r.start) < mins(p.r.end) && mins(x.r.end) > mins(p.r.start));
              return Math.max(...peers.map((x) => x.lane)) + 1;
            };
            return (
              <div
                key={d}
                className={`relative rounded-xl border ${wd === todayWd ? "border-accent/40 bg-accent/[0.04]" : "border-line"}`}
                style={{ height, backgroundImage: "linear-gradient(to bottom, var(--line) 1px, transparent 1px)", backgroundSize: `100% ${PX}px` }}
              >
                {placed.map((p) => {
                  const r = p.r;
                  const n = cluster(p);
                  const top = ((mins(r.start) - lo * 60) / 60) * PX;
                  const h = Math.max(((mins(r.end) - mins(r.start)) / 60) * PX - 3, 34);
                  const idx = r.teacherId ? (tIndex.get(r.teacherId) ?? 0) : 0;
                  return (
                    <Link
                      key={r.id}
                      href={r.href}
                      style={{ ...(r.teacherId ? tone(idx) : {}), top: top + 1, height: h, insetInlineStart: `${(p.lane / n) * 100}%`, width: `calc(${100 / n}% - 3px)` }}
                      className={`absolute overflow-hidden rounded-lg border px-2 py-1 text-xs leading-snug transition hover:z-10 hover:shadow-md ${r.active ? "" : "opacity-55"}`}
                      title={`${r.title}\n${r.teacher ?? ""}`}
                    >
                      <span className="absolute inset-y-0 start-0 w-1" style={{ background: r.teacherId ? "var(--strip)" : "var(--line)" }} aria-hidden />
                      <span className="block ps-1 font-bold tabular-nums">{num(r.start, lang)}</span>
                      <span className="block ps-1 font-medium [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{r.title}</span>
                      {h > 70 && r.teacher && <span className="block truncate ps-1 text-muted">{r.teacher}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">{c.gridHint}</p>
      </div>
    );
  };

  const byWeekday = (list: ClassRow[], keepEmpty = false) => (
    <div className="grid items-start gap-x-8 gap-y-8 xl:grid-cols-2" data-testid="class-days">
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{day.map((r) => (
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
      <div className="flex flex-col gap-10" data-testid="class-groups">
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
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
