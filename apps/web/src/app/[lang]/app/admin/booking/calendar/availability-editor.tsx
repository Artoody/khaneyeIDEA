"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarX, CheckCircle, CircleNotch, Minus, Phone, Plus, WarningCircle } from "@phosphor-icons/react";
import { fill } from "@/lib/format";
import { num, type Locale } from "@/lib/i18n";
import { dayLabel, timeLabel, WEEKDAYS } from "@/lib/jalali";
import type { OpsDict } from "@/lib/ops-i18n";
import { JalaliMonth, type DayInfo } from "@/components/booking/jalali-month";
import { TimeSelect } from "@/components/ops/time-select";
import { addDateWindow, savePainted, setDayClosed } from "./actions";
import { setBookingStatus } from "../actions";

export type DayDTO = {
  day: string;
  closed: boolean;
  slots: { templateId: string; startsAt: string; capacity: number; remaining: number; bookings: { id: string; status: string; guardian: string | null; child: string | null; age: number | null; phone: string }[] }[];
};

const FIRST = 7 * 60; // the grid runs from 07:00 to 22:00
const LAST = 22 * 60;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const ROWS = Array.from({ length: (LAST - FIRST) / 30 }, (_, i) => FIRST + i * 30);
const key = (wd: number, m: number) => `${wd}|${hhmm(m)}`;
const chip = "inline-flex h-10 items-center rounded-full border border-line px-4 text-sm transition hover:border-ink/30 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg active:scale-[0.98]";
const tone = { booked: "bg-accent/20 text-accent-text", confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", attended: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", no_show: "bg-ink/10 text-muted" } as Record<string, string>;

export function AvailabilityEditor({
  lang,
  b,
  typeId,
  branchId,
  initial,
  days,
  today,
  statusLabels,
  actionLabels,
}: {
  lang: Locale;
  b: OpsDict["bkc"];
  typeId: string;
  branchId: string | null;
  initial: { cells: { weekday: number; time: string }[]; slotMinutes: number; capacity: number };
  days: DayDTO[];
  today: string;
  statusLabels: Record<string, string>;
  actionLabels: Record<string, string>;
}) {
  const [tab, setTab] = useState<"week" | "cal">("week");
  const [open, setOpen] = useState<Set<string>>(() => new Set(initial.cells.map((c) => `${c.weekday}|${c.time}`)));
  const [saved, setSaved] = useState(() => [...open].sort().join(","));
  const [slotMinutes, setSlotMinutes] = useState(initial.slotMinutes);
  const [capacity, setCapacity] = useState(initial.capacity);
  const [savedMeta, setSavedMeta] = useState(`${initial.slotMinutes}|${initial.capacity}`);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const drag = useRef<boolean | null>(null);
  const viaPointer = useRef(false);
  const router = useRouter();

  // The calendar shows other people's bookings: refresh it when it is opened, every half minute while it is open, and on return to the tab.
  useEffect(() => {
    if (tab !== "cal") return;
    router.refresh();
    const every = setInterval(() => router.refresh(), 30_000);
    const focus = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", focus);
    return () => {
      clearInterval(every);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [tab, router]);

  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const dirty = [...open].sort().join(",") !== saved || `${slotMinutes}|${capacity}` !== savedMeta;
  const set = (k: string, on: boolean) =>
    setOpen((cur) => {
      if (cur.has(k) === on) return cur;
      const next = new Set(cur);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const setMany = (keys: string[], on: boolean) =>
    setOpen((cur) => {
      const next = new Set(cur);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  const summary = useMemo(() => {
    let halfHours = 0;
    let slots = 0;
    for (let wd = 0; wd < 7; wd++) {
      let run = 0;
      for (const m of [...ROWS, LAST]) {
        if (m < LAST && open.has(key(wd, m))) run += 30;
        else {
          halfHours += run / 30;
          slots += Math.floor(run / slotMinutes);
          run = 0;
        }
      }
    }
    return { hours: halfHours / 2, slots };
  }, [open, slotMinutes]);

  const save = () =>
    start(async () => {
      const cells = [...open].map((k) => {
        const [wd, time] = k.split("|");
        return { weekday: Number(wd), time: time! };
      });
      const r = await savePainted({ typeId, branchId, slotMinutes, capacity, cells });
      if (r.ok) {
        setSaved([...open].sort().join(","));
        setSavedMeta(`${slotMinutes}|${capacity}`);
        setNote({ ok: true, text: r.paused ? `${b.saved} ${fill(b.paused, { n: num(r.paused, lang) })}` : b.saved });
      } else setNote({ ok: false, text: b.error });
    });

  const dayName = (wd: number) => WEEKDAYS[lang][wd]!;
  const hourFmt = (m: number) => num(hhmm(m), lang);

  return (
    <div>
      <div role="tablist" className="mb-6 inline-flex rounded-full border border-line bg-surface p-1">
        {(["week", "cal"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="h-10 rounded-full px-5 text-sm text-muted transition aria-selected:bg-ink aria-selected:font-semibold aria-selected:text-bg">
            {t === "week" ? b.tabWeek : b.tabCal}
          </button>
        ))}
      </div>

      {tab === "week" ? (
        <div data-testid="painter">
          <p className="mb-4 max-w-[62ch] text-sm leading-relaxed text-muted">{b.paintHint}</p>
          <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={b.slot}>
              <span className="me-1 text-sm font-medium">{b.slot}</span>
              {[30, 45, 60, 90].map((m) => (
                <button key={m} type="button" aria-pressed={slotMinutes === m} onClick={() => setSlotMinutes(m)} className={chip}>
                  {fill(b.minutes, { n: num(m, lang) })}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="me-1 text-sm font-medium">{b.capacity}</span>
              <button type="button" aria-label="-" onClick={() => setCapacity((c) => Math.max(1, c - 1))} className="grid size-10 place-items-center rounded-full border border-line hover:border-ink/30 active:scale-95">
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center font-display text-lg font-extrabold tabular-nums">{num(capacity, lang)}</span>
              <button type="button" aria-label="+" onClick={() => setCapacity((c) => Math.min(50, c + 1))} className="grid size-10 place-items-center rounded-full border border-line hover:border-ink/30 active:scale-95">
                <Plus className="size-4" />
              </button>
            </div>
          </div>

          <div className="select-none rounded-[var(--radius-card)] border border-line bg-surface p-2.5 sm:p-4" onPointerLeave={() => (drag.current = null)}>
            <div className="grid gap-x-1" style={{ gridTemplateColumns: "2.9rem repeat(7, minmax(0, 1fr))" }}>
              <span />
              {Array.from({ length: 7 }, (_, wd) => {
                const any = ROWS.some((m) => open.has(key(wd, m)));
                return (
                  <button
                    key={wd}
                    type="button"
                    onClick={() => (any ? setMany(ROWS.map((m) => key(wd, m)), false) : setMany(ROWS.filter((m) => m >= 10 * 60 && m < 18 * 60).map((m) => key(wd, m)), true))}
                    className="mb-1.5 truncate rounded-xl py-2 text-center text-xs font-semibold text-muted transition hover:bg-ink/5 hover:text-ink sm:text-sm"
                    title={dayName(wd)}
                  >
                    {dayName(wd)}
                  </button>
                );
              })}
              {ROWS.map((m, r) => (
                <div key={m} className="contents">
                  <span className={`relative -mt-2 self-start text-[11px] tabular-nums text-muted ${m % 60 ? "invisible" : ""}`}>
                    {m % 60 === 0 && (
                      <button
                        type="button"
                        className="rounded px-1 py-1.5 hover:bg-ink/5 hover:text-ink"
                        onClick={() => {
                          const keys = Array.from({ length: 7 }, (_, wd) => [key(wd, m), key(wd, m + 30)]).flat();
                          setMany(keys, !keys.every((k) => open.has(k)));
                        }}
                        aria-label={hourFmt(m)}
                      >
                        {hourFmt(m)}
                      </button>
                    )}
                  </span>
                  {Array.from({ length: 7 }, (_, wd) => {
                    const k = key(wd, m);
                    const on = open.has(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        data-cell={k}
                        aria-pressed={on}
                        aria-label={`${dayName(wd)} ${hourFmt(m)}`}
                        onPointerDown={(e) => {
                          if (e.pointerType !== "mouse") return;
                          viaPointer.current = true;
                          drag.current = !on;
                          set(k, !on);
                        }}
                        onPointerEnter={(e) => {
                          if (e.pointerType === "mouse" && drag.current !== null && e.buttons === 1) set(k, drag.current);
                        }}
                        onClick={() => {
                          if (viaPointer.current) {
                            viaPointer.current = false;
                            return;
                          }
                          set(k, !on);
                        }}
                        className={`h-[1.65rem] border-t transition-colors sm:h-7 ${m % 60 === 0 ? "border-line" : "border-line/40"} ${
                          on ? "bg-accent" : "bg-transparent hover:bg-accent/25"
                        } ${r === 0 ? "rounded-t-lg" : ""} ${r === ROWS.length - 1 ? "rounded-b-lg" : ""} focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="sticky bottom-[4.5rem] z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-bg/95 p-3 shadow-lg backdrop-blur sm:bottom-4 sm:p-4 lg:bottom-4">
            <p className="min-w-0 text-sm" data-testid="painter-summary">
              {summary.hours > 0 ? fill(b.summary, { h: num(summary.hours, lang), n: num(summary.slots, lang) }) : b.none}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(new Set())} disabled={open.size === 0} className="h-11 rounded-full border border-line px-5 text-sm transition hover:border-ink/30 disabled:opacity-40">
                {b.clear}
              </button>
              <button type="button" onClick={save} disabled={!dirty || pending} data-testid="painter-save" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-45">
                {pending && <CircleNotch className="size-4 animate-spin" />}
                {b.save}
              </button>
            </div>
          </div>
          {note && (
            <p role={note.ok ? "status" : "alert"} className={`mt-3 flex items-start gap-2 text-sm ${note.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"}`}>
              {note.ok ? <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0" /> : <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />}
              {note.text}
            </p>
          )}
        </div>
      ) : (
        <CalendarTab lang={lang} b={b} typeId={typeId} branchId={branchId} days={days} today={today} slotMinutes={slotMinutes} capacity={capacity} statusLabels={statusLabels} actionLabels={actionLabels} />
      )}
    </div>
  );
}

function CalendarTab({
  lang,
  b,
  typeId,
  branchId,
  days,
  today,
  slotMinutes,
  capacity,
  statusLabels,
  actionLabels,
}: {
  lang: Locale;
  b: OpsDict["bkc"];
  typeId: string;
  branchId: string | null;
  days: DayDTO[];
  today: string;
  slotMinutes: number;
  capacity: number;
  statusLabels: Record<string, string>;
  actionLabels: Record<string, string>;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [from, setFrom] = useState("12:00");
  const [to, setTo] = useState("13:00");
  const [err, setErr] = useState(false);
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const info = useMemo(() => {
    const out: Record<string, DayInfo> = {};
    for (const d of days) {
      const free = d.slots.filter((s) => s.remaining > 0).length;
      const booked = d.slots.reduce((n, s) => n + s.bookings.length, 0);
      if (!d.slots.length && d.closed) out[d.day] = { tone: "closed", badge: b.closedDay };
      else if (d.closed) out[d.day] = { tone: "closed", badge: b.closedDay };
      else if (booked) out[d.day] = { tone: "busy", badge: fill(b.booked, { n: num(booked, lang) }) };
      else if (free) out[d.day] = { tone: "open", badge: fill(b.free, { n: num(free, lang) }) };
      else if (d.slots.length) out[d.day] = { tone: "full" };
    }
    return out;
  }, [days, b, lang]);
  const cur = day ? byDay.get(day) : undefined;
  const run = (job: () => Promise<{ ok?: true; error?: string }>) =>
    start(async () => {
      const r = await job();
      setErr(!r.ok);
    });

  return (
    <div data-testid="admin-calendar" className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div>
        <p className="mb-4 text-sm text-muted">{b.daysHint}</p>
        <JalaliMonth lang={lang} value={day} onSelect={setDay} info={info} today={today} min={today} selectable={(iso) => iso >= today} />
      </div>
      <div>
        {!day ? null : (
          <section data-testid="day-panel" className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl font-extrabold">{dayLabel(day, lang)}</h3>
              {cur && cur.slots.length + (cur.closed ? 1 : 0) > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setDayClosed({ typeId, branchId, day, closed: !cur.closed }))}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm transition hover:border-ink/30 disabled:opacity-50"
                >
                  <CalendarX className="size-4" />
                  {cur.closed ? b.reopenDay : b.closeDay}
                </button>
              )}
            </div>
            {cur?.closed && <p className="mt-3 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">{b.closedNote}</p>}
            {!cur || cur.slots.length === 0 ? (
              !cur?.closed && <p className="mt-4 text-sm text-muted">{b.noSlots}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {cur.slots.map((s) => (
                  <li key={`${s.templateId}${s.startsAt}`} className="rounded-2xl border border-line p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-lg font-extrabold tabular-nums">{timeLabel(s.startsAt, lang)}</span>
                      <span className={`rounded-full px-3 py-1 text-xs ${s.remaining === 0 ? "bg-ink/[0.07] text-muted" : "bg-accent/15 text-accent-text"}`}>
                        {s.remaining === 0 ? b.closed : fill(b.seats, { n: num(s.remaining, lang), c: num(s.capacity, lang) }) + " " + b.freeSeat}
                      </span>
                    </div>
                    {s.bookings.length === 0 ? (
                      <p className="mt-1.5 text-sm text-muted">{b.noBooking}</p>
                    ) : (
                      <ul className="mt-2.5 flex flex-col gap-2">
                        {s.bookings.map((bk) => (
                          <li key={bk.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-sm">
                            <span className="font-semibold">{bk.guardian ?? "-"}</span>
                            {(bk.child || bk.age) && (
                              <span className="text-muted">
                                {[bk.child, bk.age ? num(bk.age, lang) : null].filter(Boolean).join("، ")}
                              </span>
                            )}
                            <a href={`tel:+${bk.phone}`} className="inline-flex items-center gap-1 text-muted hover:text-ink" dir="ltr">
                              <Phone className="size-3.5" />
                              {num(`0${bk.phone.slice(2)}`, lang)}
                            </a>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs ${tone[bk.status] ?? ""}`}>{statusLabels[bk.status] ?? bk.status}</span>
                            <span className="ms-auto flex gap-1.5">
                              {(bk.status === "booked" ? ["confirmed", "canceled"] : bk.status === "confirmed" ? ["canceled"] : []).map((st) => (
                                <form key={st} action={setBookingStatus}>
                                  <input type="hidden" name="id" value={bk.id} />
                                  <input type="hidden" name="status" value={st} />
                                  <button className={`h-9 rounded-full border px-3.5 text-sm transition active:scale-[0.98] ${st === "canceled" ? "border-line text-red-600 hover:border-red-500/50" : "border-accent/60 bg-accent/15 hover:bg-accent/25"}`}>{actionLabels[st === "confirmed" ? "confirm" : "cancel"]}</button>
                                </form>
                              ))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 border-t border-line pt-5">
              <h4 className="font-semibold">{b.extra}</h4>
              <p className="mt-0.5 text-sm text-muted">{b.extraHelp}</p>
              <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
                <TimeSelect name="from" value={from} label={b.from} onChange={setFrom} />
                <TimeSelect name="to" value={to} label={b.to} onChange={setTo} />
              </div>
              <button
                type="button"
                disabled={pending || to <= from}
                onClick={() => run(() => addDateWindow({ typeId, branchId, day, start: from, end: to, slotMinutes, capacity }))}
                className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-50"
              >
                {pending && <CircleNotch className="size-4 animate-spin" />}
                {b.add}
              </button>
              {err && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {b.error}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

