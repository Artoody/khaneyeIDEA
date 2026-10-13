"use client";

import { useState } from "react";
import { Minus, Plus, WarningCircle } from "@phosphor-icons/react";
import type { classGroups } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { OpsDict } from "@/lib/ops-i18n";
import type { Locale } from "@/lib/i18n";
import { num } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { WEEKDAYS } from "@/lib/jalali";
import { saveClass, type ClassState } from "@/app/[lang]/app/admin/classes/actions";
import { TimeSelect } from "@/components/ops/time-select";
import { AdminForm, Field, inputCls, Toggle } from "./fields";
import { errorText } from "./errors";
import { JalaliDateInput } from "./jalali-date-input";

type ClassGroup = typeof classGroups.$inferSelect;
type Opt = { id: string; label: string };

const DURATIONS = [45, 60, 90, 120];
const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

const chip =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-4 text-sm transition hover:border-ink/30 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg aria-checked:border-ink aria-checked:bg-ink aria-checked:text-bg active:scale-[0.98]";

export function ClassForm({
  c,
  a,
  o,
  lang,
  years,
  options,
  defaults,
}: {
  c?: ClassGroup;
  a: AdminDict;
  o: OpsDict;
  lang: Locale;
  years: number[];
  options: { courses: Opt[]; teachers: Opt[]; branches: Opt[]; rooms: (Opt & { branchId: string })[]; terms: Opt[] };
  /** Prefill for a new class (from the "new class for this coach / on this day" buttons). */
  defaults?: { teacherId?: string; weekday?: number };
}) {
  const t = o.classes;
  const f = o.cf;
  const [courseId, setCourseId] = useState(c?.courseId ?? options.courses[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(c?.teacherId ?? defaults?.teacherId ?? "");
  const [termId, setTermId] = useState(c?.termId ?? "");
  const [weekday, setWeekday] = useState(c?.weekday ?? defaults?.weekday ?? 0);
  const [start, setStart] = useState(c?.startTime.slice(0, 5) ?? "17:00");
  const [end, setEnd] = useState(c?.endTime.slice(0, 5) ?? "18:30");
  const [mode, setMode] = useState<string>(c?.mode ?? "in_person");
  const [branchId, setBranchId] = useState(c?.branchId ?? options.branches[0]?.id ?? "");
  const [roomId, setRoomId] = useState(c?.roomId ?? "");
  const [capacity, setCapacity] = useState(c?.capacity ?? 8);
  const [title, setTitle] = useState(c?.title ?? "");

  const duration = toMin(end) - toMin(start);
  const online = mode === "online";
  const rooms = options.rooms.filter((r) => r.branchId === branchId);
  const courseLabel = options.courses.find((x) => x.id === courseId)?.label.replace(/ \*$/, "") ?? "";
  const auto = fill(f.autoTitle, { course: courseLabel, day: WEEKDAYS[lang][weekday] ?? "" });
  const setDuration = (m: number) => setEnd(fromMin(toMin(start) + m));
  const setStartKeepingLength = (v: string) => {
    const len = duration > 0 ? duration : 90;
    setStart(v);
    setEnd(fromMin(toMin(v) + len));
  };

  return (
    <AdminForm action={saveClass} hidden={{ id: c?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => (s.fieldErrors?.[k] === "time_order" ? t.timeOrder : errorText(s.fieldErrors?.[k], a));
        const synced = (s as ClassState).synced;
        const conflicts = (s as ClassState).conflicts;
        return (
          <>
            {/* values the chips and steppers choose travel as hidden fields */}
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="teacherId" value={teacherId} />
            <input type="hidden" name="termId" value={termId} />
            <input type="hidden" name="weekday" value={weekday} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="branchId" value={online ? "" : branchId} />
            <input type="hidden" name="roomId" value={online ? "" : roomId} />
            <input type="hidden" name="capacity" value={capacity} />

            <Block title={f.sCourse}>
              <Field label={t.course} name="courseSelect" error={e("courseId")}>
                <select id="courseSelect" value={courseId} onChange={(ev) => setCourseId(ev.target.value)} className={inputCls}>
                  {options.courses.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.title} name="title" help={fill(f.titleAuto, { auto })} error={e("title")}>
                <input id="title" name="title" value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder={auto} className={inputCls} />
              </Field>
            </Block>

            <Block title={f.sPeople}>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.teacher} data-testid="teacher-pick">
                <button type="button" role="radio" aria-checked={!teacherId} onClick={() => setTeacherId("")} className={chip}>
                  {t.noTeacher}
                </button>
                {options.teachers.map((x) => (
                  <button key={x.id} type="button" role="radio" aria-checked={teacherId === x.id} onClick={() => setTeacherId(x.id)} className={chip}>
                    {x.label}
                  </button>
                ))}
              </div>
              {e("teacherId") && <p className="text-xs text-red-500">{e("teacherId")}</p>}
              <Field label={t.term} name="termSelect" error={e("termId")}>
                <select id="termSelect" value={termId} onChange={(ev) => setTermId(ev.target.value)} className={inputCls}>
                  <option value="">{o.terms.none}</option>
                  {options.terms.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </Field>
            </Block>

            <Block title={f.sWhen}>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t.weekday}</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" data-testid="weekday-pick">
                  {WEEKDAYS[lang].map((d, i) => (
                    <button key={d} type="button" role="radio" aria-checked={weekday === i} onClick={() => setWeekday(i)} className={chip}>
                      {d}
                    </button>
                  ))}
                </div>
                {e("weekday") && <p className="mt-1.5 text-xs text-red-500">{e("weekday")}</p>}
              </fieldset>
              <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                <div>
                  <TimeSelect name="startTime" value={start} onChange={setStartKeepingLength} label={t.start} />
                  {e("startTime") && <p className="mt-1.5 text-xs text-red-500">{e("startTime")}</p>}
                </div>
                <div>
                  <TimeSelect name="endTime" value={end} onChange={setEnd} label={f.ends} />
                  {e("endTime") && <p className="mt-1.5 text-xs text-red-500">{e("endTime")}</p>}
                </div>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{f.duration}</legend>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((m) => (
                    <button key={m} type="button" aria-pressed={duration === m} onClick={() => setDuration(m)} className={chip}>
                      {fill(f.minutes, { n: num(m, lang) })}
                    </button>
                  ))}
                </div>
              </fieldset>
            </Block>

            <Block title={f.sWhere}>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.mode}>
                {(["in_person", "online", "hybrid"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={chip}>
                    {f.modes[m]}
                  </button>
                ))}
              </div>
              {!online && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t.branch} name="branchSelect" error={e("branchId")}>
                    <select
                      id="branchSelect"
                      value={branchId}
                      onChange={(ev) => {
                        setBranchId(ev.target.value);
                        setRoomId("");
                      }}
                      className={inputCls}
                    >
                      {options.branches.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={o.groups.room} name="roomSelect" error={e("roomId")}>
                    <select id="roomSelect" value={roomId} onChange={(ev) => setRoomId(ev.target.value)} className={inputCls}>
                      <option value="">{o.groups.noRoom}</option>
                      {rooms.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
              {(online || mode === "hybrid") && (
                <Field label={t.onlineUrl} name="onlineUrl" error={e("onlineUrl")}>
                  <input id="onlineUrl" name="onlineUrl" dir="ltr" placeholder="https://" defaultValue={c?.onlineUrl ?? ""} className={inputCls} />
                </Field>
              )}
            </Block>

            <Block title={f.sSize}>
              <div>
                <p className="mb-2 text-sm font-medium">{t.capacity}</p>
                <div className="inline-flex items-center gap-1 rounded-full border border-line p-1">
                  <button type="button" aria-label="-" onClick={() => setCapacity((n) => Math.max(1, n - 1))} className="grid size-10 place-items-center rounded-full hover:bg-ink/5">
                    <Minus weight="bold" className="size-4" />
                  </button>
                  <span className="min-w-16 text-center font-display text-lg font-bold tabular-nums">
                    {num(capacity, lang)} <span className="text-sm font-normal text-muted">{f.seats}</span>
                  </span>
                  <button type="button" aria-label="+" onClick={() => setCapacity((n) => Math.min(200, n + 1))} className="grid size-10 place-items-center rounded-full hover:bg-ink/5">
                    <Plus weight="bold" className="size-4" />
                  </button>
                </div>
                {e("capacity") && <p className="mt-1.5 text-xs text-red-500">{e("capacity")}</p>}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <JalaliDateInput name="startsOn" value={c?.startsOn ?? new Date().toISOString().slice(0, 10)} label={t.startsOn} years={[years[0]! - 1, ...years]} />
                  <p className="mt-1.5 text-xs text-muted">{e("startsOn") ?? f.startsHelp}</p>
                </div>
                <div>
                  <JalaliDateInput name="endsOn" value={c?.endsOn} label={t.endsOn} emptyLabel={t.noEnd} years={years} />
                  <p className="mt-1.5 text-xs text-muted">{e("endsOn") ?? f.endsHelp}</p>
                </div>
              </div>
            </Block>

            <Block title={f.sLinks}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={o.groups.baleInvite} name="baleInviteUrl" error={e("baleInviteUrl")}>
                  <input id="baleInviteUrl" name="baleInviteUrl" dir="ltr" placeholder="https://ble.ir/join/…" defaultValue={c?.baleInviteUrl ?? ""} className={inputCls} />
                </Field>
                <Field label={o.groups.telegramInvite} name="telegramInviteUrl" error={e("telegramInviteUrl")}>
                  <input id="telegramInviteUrl" name="telegramInviteUrl" dir="ltr" placeholder="https://t.me/+…" defaultValue={c?.telegramInviteUrl ?? ""} className={inputCls} />
                </Field>
              </div>
              <Toggle name="active" label={t.active} defaultChecked={c?.active ?? true} />
            </Block>

            {conflicts && conflicts.length > 0 && (
              <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 text-sm" role="alert" data-testid="class-conflict">
                <p className="flex items-center gap-2 font-medium">
                  <WarningCircle weight="fill" className="size-5 text-accent-text" />
                  {o.conflict.title}
                </p>
                <ul className="mt-2 list-inside list-disc text-muted">
                  {conflicts.map((x, i) => (
                    <li key={i}>{fill(x.kind === "teacher" ? o.conflict.teacher : o.conflict.room, { title: x.title })}</li>
                  ))}
                </ul>
                <label className="mt-3 flex items-center gap-2">
                  <input type="checkbox" name="force" className="size-4 accent-[var(--accent)]" />
                  {o.conflict.saveAnyway}
                </label>
              </div>
            )}
            {synced && (synced.added > 0 || synced.removed > 0) && (
              <p className="text-sm text-muted" role="status">
                {fill(t.synced, { a: num(synced.added, lang), r: num(synced.removed, lang) })}
              </p>
            )}
          </>
        );
      }}
    </AdminForm>
  );
}
