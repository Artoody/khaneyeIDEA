"use client";

import { useActionState } from "react";
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { addMakeup, moveSession, type SessionState } from "@/app/[lang]/app/session-actions";
import { DayPicker } from "./day-picker";
import { TimeSelect } from "./time-select";

type Day = { iso: string; weekday: string; label: string };
const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60";

function Result({ s, o, done }: { s: SessionState; o: OpsDict; done: string }) {
  if (s.error === "conflict" && s.conflicts)
    return (
      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-3.5 text-sm" role="alert">
        <p className="flex items-center gap-2 font-medium">
          <WarningCircle weight="fill" className="size-5 text-accent-text" />
          {o.conflict.title}
        </p>
        <ul className="mt-2 list-inside list-disc text-muted">
          {s.conflicts.map((c, i) => (
            <li key={i}>{fill(c.kind === "teacher" ? o.conflict.teacher : o.conflict.room, { title: c.title })}</li>
          ))}
        </ul>
      </div>
    );
  if (s.error) {
    const map: Record<string, string> = { slot_taken: o.move.slotTaken, not_movable: o.move.notMovable, bad_time: o.move.badTime };
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-500" role="alert">
        <WarningCircle weight="fill" className="size-4" />
        {map[s.error] ?? s.error}
      </span>
    );
  }
  if (s.ok)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400" role="status">
        <CheckCircle weight="fill" className="size-4" />
        {done}
      </span>
    );
  return null;
}

type TimeProps = { o: OpsDict; days: Day[]; from: string; to: string };

/** Move one future session: new day and hours, with a clash warning and an optional notice to the class group. */
export function MoveForm({ o, days, from, to, sessionId, dayIso }: TimeProps & { sessionId: string; dayIso: string }) {
  const [s, action, pending] = useActionState<SessionState, FormData>(moveSession, {});
  return (
    <details className="rounded-2xl border border-line p-4" data-testid="move">
      <summary className="cursor-pointer font-medium">{o.move.title}</summary>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <p className="text-sm text-muted">{o.move.help}</p>
        <input type="hidden" name="sessionId" value={sessionId} />
        <DayPicker name="day" days={days} value={dayIso} label={o.move.day} />
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect name="from" value={from} label={o.move.from} />
          <TimeSelect name="to" value={to} label={o.move.to} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="size-4 accent-[var(--accent)]" />
          {o.move.notify}
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {o.move.message}
          <textarea name="message" rows={3} placeholder={o.move.messageHelp} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className={`${btn} bg-ink text-bg`}>
            {pending && <CircleNotch className="size-4 animate-spin" />}
            {o.move.save}
          </button>
          {s.error === "conflict" && (
            <button name="force" value="1" disabled={pending} className={`${btn} border border-line`}>
              {o.conflict.saveAnyway}
            </button>
          )}
          <Result s={s} o={o} done={o.move.moved} />
        </div>
      </form>
    </details>
  );
}

/** A one-off extra or makeup session for the class. */
export function MakeupForm({ o, days, from, to, classGroupId, ofSessionId }: TimeProps & { classGroupId: string; ofSessionId?: string }) {
  const [s, action, pending] = useActionState<SessionState, FormData>(addMakeup, {});
  return (
    <details className="rounded-2xl border border-line p-4" open={!!ofSessionId} data-testid="makeup">
      <summary className="cursor-pointer font-medium">{o.move.makeupTitle}</summary>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <p className="text-sm text-muted">{o.move.makeupHelp}</p>
        <input type="hidden" name="classGroupId" value={classGroupId} />
        {ofSessionId && <input type="hidden" name="ofSessionId" value={ofSessionId} />}
        <DayPicker name="day" days={days} label={o.move.day} />
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect name="from" value={from} label={o.move.from} />
          <TimeSelect name="to" value={to} label={o.move.to} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className={`${btn} bg-ink text-bg`}>
            {pending && <CircleNotch className="size-4 animate-spin" />}
            {o.move.makeupSave}
          </button>
          {s.error === "conflict" && (
            <button name="force" value="1" disabled={pending} className={`${btn} border border-line`}>
              {o.conflict.saveAnyway}
            </button>
          )}
          <Result s={s} o={o} done={o.move.added} />
        </div>
      </form>
    </details>
  );
}
