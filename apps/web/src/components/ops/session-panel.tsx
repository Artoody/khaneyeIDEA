"use client";

import { useActionState, useState } from "react";
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import type { Locale } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { cancelSession, markNotHeld, restoreSession, saveSessionWork } from "@/app/[lang]/app/session-actions";

type State = { ok?: boolean; error?: string; savedAt?: number; fieldErrors?: Record<string, string> };
export type PanelData = {
  id: string;
  title: string;
  when: string;
  dayLabel: string;
  place: string;
  status: string;
  started: boolean;
  roster: { id: string; name: string }[];
  marks: Record<string, "present" | "absent" | "excused">;
  summary: string;
  homework: string | null;
  hasHomeworkRow: boolean;
  announcement: { text: string; sendAt: string } | null;
  notHeldReason: string | null;
};

const btn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60";
const box = "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";

function Feedback({ state, o }: { state: State; o: OpsDict }) {
  if (state.error)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-500" role="alert">
        <WarningCircle weight="fill" className="size-4" />
        {state.error === "future" ? o.session.future : state.error}
      </span>
    );
  if (state.ok)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400" role="status">
        <CheckCircle weight="fill" className="size-4" />
        {o.session.saved}
      </span>
    );
  return null;
}

function Work({ d, o }: { d: PanelData; o: OpsDict }) {
  const [state, action, pending] = useActionState<State, FormData>(saveSessionWork, {});
  const [noHw, setNoHw] = useState(d.hasHomeworkRow ? false : d.status === "held" && !d.homework);
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="sessionId" value={d.id} />
      <fieldset>
        <legend className="font-display text-base font-bold">{o.session.attendance}</legend>
        {d.roster.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{o.session.noRoster}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line" data-testid="attendance">
            {d.roster.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate">{s.name}</span>
                <span className="flex shrink-0 rounded-full border border-line p-0.5 text-xs">
                  {(["present", "absent", "excused"] as const).map((m) => (
                    <label key={m} className="cursor-pointer">
                      <input type="radio" name={`att.${s.id}`} value={m} defaultChecked={(d.marks[s.id] ?? "present") === m} className="peer sr-only" />
                      <span
                        className={`block rounded-full px-2.5 py-1 text-muted transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${
                          m === "present" ? "peer-checked:bg-emerald-500/15 peer-checked:text-emerald-700 dark:peer-checked:text-emerald-400" : m === "absent" ? "peer-checked:bg-red-500/15 peer-checked:text-red-600" : "peer-checked:bg-ink/10 peer-checked:text-ink"
                        }`}
                      >
                        {o.session[m]}
                      </span>
                    </label>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-display text-base font-bold">{o.session.report}</span>
        <textarea name="summary" rows={4} defaultValue={d.summary} placeholder={o.session.reportHelp} className={box} />
      </label>
      <div className="flex flex-col gap-2">
        <label htmlFor={`hw-${d.id}`} className="font-display text-base font-bold">
          {o.session.homework}
        </label>
        <textarea id={`hw-${d.id}`} name="homework" rows={3} defaultValue={d.homework ?? ""} disabled={noHw} className={`${box} disabled:opacity-50`} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="noHomework" checked={noHw} onChange={(e) => setNoHw(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          {o.session.noHomework}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={`${btn} bg-accent text-on-accent hover:bg-accent-strong`}>
          {pending && <CircleNotch className="size-4 animate-spin" />}
          {o.session.saveHeld}
        </button>
        <Feedback state={state} o={o} />
      </div>
    </form>
  );
}

function NotHeld({ d, o }: { d: PanelData; o: OpsDict }) {
  const [state, action, pending] = useActionState<State, FormData>(markNotHeld, {});
  const [reason, setReason] = useState("teacher");
  return (
    <details className="rounded-2xl border border-line p-4" open={d.status === "not_held" || d.status === "needs_makeup"}>
      <summary className="cursor-pointer font-medium text-red-600">{o.session.notHeld}</summary>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="sessionId" value={d.id} />
        <label className="flex flex-col gap-2 text-sm">
          {o.session.reason}
          <select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={box}>
            {Object.entries(o.session.reasons).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {reason === "other" && <input name="otherReason" className={box} />}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="needsMakeup" defaultChecked={d.status === "needs_makeup"} className="size-4 accent-[var(--accent)]" />
          {o.session.needsMakeup}
        </label>
        <div className="flex items-center gap-3">
          <button disabled={pending} className={`${btn} border border-red-500/40 text-red-600 hover:bg-red-500/10`}>
            {o.session.notHeld}
          </button>
          <Feedback state={state} o={o} />
        </div>
      </form>
    </details>
  );
}

function Cancel({ d, o, asTeacher }: { d: PanelData; o: OpsDict; asTeacher: boolean }) {
  const [state, action, pending] = useActionState<State, FormData>(cancelSession, {});
  const [reason, setReason] = useState("");
  const msg = fill(o.session.messageDefault, { class: d.title, day: d.dayLabel, reason: reason ? `${reason}. ` : "" });
  return (
    <details className="rounded-2xl border border-line p-4">
      <summary className="cursor-pointer font-medium">{o.session.cancelAhead}</summary>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="sessionId" value={d.id} />
        <label className="flex flex-col gap-2 text-sm">
          {o.session.reason}
          <input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={box} />
        </label>
        {!asTeacher && (
          <>
            <label className="flex flex-col gap-2 text-sm">
              {o.session.message}
              {/* keyed by the reason so the suggested text follows it until the admin edits it */}
              <textarea key={reason} name="message" rows={4} defaultValue={msg} className={box} />
            </label>
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="mb-2">{o.session.sendAt}</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="sendAt" value="morning" defaultChecked className="accent-[var(--accent)]" />
                {o.session.morning}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="sendAt" value="now" className="accent-[var(--accent)]" />
                {o.session.now}
              </label>
            </fieldset>
            <p className="text-xs text-muted">{o.session.cancelHelp}</p>
          </>
        )}
        <div className="flex items-center gap-3">
          <button disabled={pending} className={`${btn} bg-ink text-bg`}>
            {o.session.confirmCancel}
          </button>
          <Feedback state={state} o={o} />
        </div>
      </form>
    </details>
  );
}

export function SessionPanel({ d, o, asTeacher }: { d: PanelData; o: OpsDict; lang: Locale; asTeacher: boolean }) {
  if (d.status === "cancel_planned")
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-2xl bg-accent/10 p-4 text-sm">{o.session.canceled}</p>
        {d.announcement && (
          <blockquote className="rounded-2xl border border-line p-4 text-sm leading-relaxed">
            {d.announcement.text}
            <footer className="mt-2 text-xs text-muted">{d.announcement.sendAt}</footer>
          </blockquote>
        )}
        {!asTeacher && (
          <form action={restoreSession}>
            <input type="hidden" name="sessionId" value={d.id} />
            <button className={`${btn} border border-line hover:border-ink/30`}>{o.session.restore}</button>
          </form>
        )}
      </div>
    );
  if (!d.started)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{o.session.future}</p>
        <Cancel d={d} o={o} asTeacher={asTeacher} />
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <Work d={d} o={o} />
      <NotHeld d={d} o={o} />
    </div>
  );
}
