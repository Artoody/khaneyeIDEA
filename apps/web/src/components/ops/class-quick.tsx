"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowSquareOut, CircleNotch, MagnifyingGlass, Plus, WarningCircle, X } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { num, type Locale } from "@/lib/i18n";
import { enrollStudents, getClassQuick, quickUpdateClass, setEnrollment, type QuickClass } from "@/app/[lang]/app/admin/classes/actions";
import { TimeSelect } from "./time-select";

export type QuickTeacher = { id: string; name: string; hue: number };

const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => [...w][0]).join("");
const chip = "inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm transition hover:border-ink/30 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg active:scale-[0.98] disabled:opacity-50";

/**
 * Change a class without leaving the list: the coach, the weekly day and time, and who is in it. Every change is
 * saved on the spot (the time with its own button) and the list behind the panel updates by itself.
 */
export function ClassQuick({
  id,
  o,
  lang,
  teachers,
  weekdays,
  fullHref,
  onClose,
}: {
  id: string;
  o: OpsDict;
  lang: Locale;
  teachers: QuickTeacher[];
  weekdays: readonly string[];
  fullHref: string;
  onClose: () => void;
}) {
  const q = o.qp;
  const [data, setData] = useState<QuickClass | null>(null);
  const [weekday, setWeekday] = useState(0);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("18:30");
  const [clash, setClash] = useState<{ kind: "teacher" | "room"; title: string }[] | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [find, setFind] = useState("");
  const [busy, startBusy] = useTransition();
  const pending = useRef<Record<string, string> | null>(null);

  const [tick, setTick] = useState(0);
  const load = useCallback(async () => setTick((n) => n + 1), []);
  // the parent mounts this panel with key={id}, so a different class always starts from the loading state
  useEffect(() => {
    let live = true;
    void getClassQuick(id).then((d) => {
      if (!live) return;
      setData(d);
      if (d) {
        setWeekday(d.weekday);
        setStart(d.start);
        setEnd(d.end);
      }
    });
    return () => {
      live = false;
    };
  }, [id, tick]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const duration = toMin(end) - toMin(start);
  const dirty = !!data && (weekday !== data.weekday || start !== data.start || end !== data.end);
  const free = useMemo(() => {
    const needle = find.trim();
    return (data?.available ?? []).filter((s) => !needle || s.name.includes(needle)).slice(0, 40);
  }, [data, find]);

  const run = (job: () => Promise<void>) =>
    startBusy(async () => {
      await job();
      await load();
    });

  const update = (fields: Record<string, string>, force = false) =>
    run(async () => {
      const f = new FormData();
      f.set("id", id);
      for (const [k, v] of Object.entries(fields)) f.set(k, v);
      if (force) f.set("force", "on");
      const r = await quickUpdateClass({}, f);
      if (r.error === "conflict" && r.conflicts) {
        setClash(r.conflicts);
        setNote(null);
        pending.current = fields;
        return;
      }
      setClash(null);
      pending.current = null;
      setNote(r.ok ? { ok: true, text: r.synced && (r.synced.added || r.synced.removed) ? `${q.saved}. ${q.sessionsMoved}` : q.saved } : { ok: false, text: q.error });
    });

  const timeFields = { weekday: String(weekday), startTime: start, endTime: end };

  const reduce = useReducedMotion();
  const away = lang === "fa" ? -56 : 56; // the panel sits at the inline end: the left in Persian
  const fade = reduce ? { duration: 0 } : { duration: 0.22 };
  return (
    <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
      <button type="button" aria-label={o.board.close} onClick={onClose} className="absolute inset-0 cursor-default bg-ink/20 backdrop-blur-[2px]" />
      <motion.aside
        initial={{ x: away, opacity: 0.6 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: away, opacity: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
        className="absolute inset-y-0 end-0 z-50 flex w-full flex-col overflow-y-auto border-s border-line bg-bg shadow-2xl sm:w-[28rem]"
        data-testid="class-quick"
        aria-label={data?.title}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-bg/95 p-5 backdrop-blur">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold leading-snug">{data?.title ?? q.loading}</h2>
            {data && <p className="mt-0.5 text-sm text-muted">{data.course}</p>}
          </div>
          <button type="button" onClick={onClose} data-sfx="close" aria-label={o.board.close} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-ink/5">
            <X className="size-5" />
          </button>
        </header>

        {!data ? (
          <div className="grid flex-1 place-items-center p-10 text-muted">
            <CircleNotch className="size-6 animate-spin" aria-label={q.loading} />
          </div>
        ) : (
          <div className="rise flex flex-col gap-7 p-5">
            {/* coach */}
            <section>
              <h3 className="mb-2.5 font-display text-base font-bold">{q.teacher}</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label={q.teacher} data-testid="quick-teachers">
                <button type="button" aria-pressed={!data.teacherId} disabled={busy} onClick={() => update({ teacherId: "" })} className={chip}>
                  {q.noTeacher}
                </button>
                {teachers.map((t) => (
                  <button key={t.id} type="button" aria-pressed={data.teacherId === t.id} disabled={busy} onClick={() => data.teacherId !== t.id && update({ teacherId: t.id })} className={chip}>
                    <span className="grid size-6 place-items-center rounded-full text-[10px] font-extrabold" style={{ background: `hsl(${t.hue} 65% 50% / 0.22)`, color: `hsl(${t.hue} 60% 30%)` }}>
                      {initials(t.name)}
                    </span>
                    {t.name}
                  </button>
                ))}
              </div>
            </section>

            {/* day and time */}
            <section>
              <h3 className="mb-2.5 font-display text-base font-bold">{q.time}</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label={q.time} data-testid="quick-days">
                {weekdays.map((d, i) => (
                  <button key={d} type="button" aria-pressed={weekday === i} onClick={() => setWeekday(i)} className={chip}>
                    {d}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <TimeSelect
                  name="startTime"
                  value={start}
                  label={o.classes.start}
                  onChange={(v) => {
                    const len = duration > 0 ? duration : 75;
                    setStart(v);
                    setEnd(fromMin(toMin(v) + len));
                  }}
                />
                <TimeSelect name="endTime" value={end} label={o.cf.ends} onChange={setEnd} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[60, 75].map((m) => (
                  <button key={m} type="button" aria-pressed={duration === m} onClick={() => setEnd(fromMin(toMin(start) + m))} className={chip}>
                    {fill(o.cf.minutes, { n: num(m, lang) })}
                  </button>
                ))}
              </div>
              {clash && (
                <div className="mt-4 rounded-2xl border border-accent/50 bg-accent/10 p-3.5 text-sm" role="alert">
                  <p className="flex items-center gap-2 font-medium">
                    <WarningCircle weight="fill" className="size-5 text-accent-text" />
                    {o.conflict.title}
                  </p>
                  <ul className="mt-2 list-inside list-disc text-muted">
                    {clash.map((x, i) => (
                      <li key={i}>{fill(x.kind === "teacher" ? o.conflict.teacher : o.conflict.room, { title: x.title })}</li>
                    ))}
                  </ul>
                  <button type="button" disabled={busy} onClick={() => update(pending.current ?? timeFields, true)} className="mt-3 h-10 rounded-full border border-line px-4 text-sm font-medium hover:border-ink/30">
                    {o.conflict.saveAnyway}
                  </button>
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button type="button" disabled={!dirty || busy || duration <= 0} onClick={() => update(timeFields)} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-40">
                  {busy && <CircleNotch className="size-4 animate-spin" />}
                  {q.saveTime}
                </button>
              </div>
              {note && (
                <p className={`mt-3 text-sm ${note.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`} role={note.ok ? "status" : "alert"}>
                  {note.text}
                </p>
              )}
            </section>

            {/* students */}
            <section>
              <h3 className="mb-2.5 flex items-center justify-between font-display text-base font-bold">
                {q.students}
                <span className="text-sm font-normal text-muted">{fill(o.classes.seats, { n: num(data.roster.filter((r) => r.status === "active").length, lang), c: num(data.capacity, lang) })}</span>
              </h3>
              {data.roster.length === 0 ? (
                <p className="text-sm text-muted">{o.classes.noStudents}</p>
              ) : (
                <ul className="divide-y divide-line rounded-2xl border border-line" data-testid="quick-roster">
                  {data.roster.map((r) => (
                    <li key={r.enrollmentId} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      {r.age != null && <span className="text-xs text-muted">{fill(o.students.age, { n: num(r.age, lang) })}</span>}
                      {r.status === "waitlist" && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent-text">{q.waitlist}</span>}
                      <button
                        type="button"
                        data-sfx="remove"
                        disabled={busy}
                        aria-label={`${q.remove}: ${r.name}`}
                        title={q.remove}
                        onClick={() =>
                          run(async () => {
                            const f = new FormData();
                            f.set("id", r.enrollmentId);
                            f.set("status", "dropped");
                            await setEnrollment(f);
                          })
                        }
                        className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-red-500/10 hover:text-red-500"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 rounded-2xl border border-line p-3">
                <label className="relative block">
                  <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={q.search} aria-label={q.search} className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15" />
                </label>
                <ul className="mt-2 max-h-52 overflow-y-auto" data-testid="quick-available">
                  {free.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        data-sfx="pop"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const f = new FormData();
                            f.set("classGroupId", id);
                            f.set("studentId", s.id);
                            await enrollStudents(f);
                          })
                        }
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-sm transition hover:bg-ink/5"
                      >
                        <span className="grid size-6 place-items-center rounded-full bg-accent/15 text-accent-text">
                          <Plus weight="bold" className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        {s.age != null && <span className="text-xs text-muted">{fill(o.students.age, { n: num(s.age, lang) })}</span>}
                      </button>
                    </li>
                  ))}
                  {free.length === 0 && <li className="px-2.5 py-3 text-sm text-muted">{q.noMore}</li>}
                </ul>
              </div>
            </section>

            <Link href={fullHref} className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-line px-5 text-sm hover:border-ink/30">
              <ArrowSquareOut className="size-4" />
              {q.openFull}
            </Link>
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}
