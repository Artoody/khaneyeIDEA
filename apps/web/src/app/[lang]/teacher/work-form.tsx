"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleNotch, Microphone, NotePencil, Stop, Trash } from "@phosphor-icons/react";
import { fill } from "@/lib/format";
import { num, type Locale } from "@/lib/i18n";
import type { OpsDict } from "@/lib/ops-i18n";
import { submitClassWork } from "./actions";

type Work = OpsDict["tp"]["work"];

const score = "grid h-11 w-full place-items-center rounded-xl border border-line text-sm font-semibold tabular-nums text-muted transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:ring-4 peer-focus-visible:ring-accent/30 active:scale-95";
const field = "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";

/** One row of 0..max chips. Plain radios, so the form still posts the value the server already expects. */
function Scale({ name, max, def, label, lang }: { name: string; max: number; def: number; label: string; lang: Locale }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${max + 1}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {Array.from({ length: max + 1 }, (_, n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} defaultChecked={n === def} className="peer sr-only" />
            <span className={score}>{num(n, lang)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function WorkForm({
  lang,
  sessionId,
  students,
  aiOn,
  t,
}: {
  lang: Locale;
  sessionId: string;
  students: { id: string; name: string }[];
  aiOn: boolean;
  t: Work;
}) {
  const [state, action, pending] = useActionState(submitClassWork, {});
  const [voiceKey, setVoiceKey] = useState("");
  const [homeworkVoiceKey, setHomeworkVoiceKey] = useState("");
  const [absent, setAbsent] = useState(0);
  const errors: Record<string, string> = { empty: t.errEmpty, voice: t.errVoice, ai: t.errAi, missing: t.errMissing };
  return (
    <form action={action} onChange={(e) => setAbsent(new FormData(e.currentTarget).getAll("absent").length)} className="flex flex-col gap-7">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="voiceKey" value={voiceKey} />
      <input type="hidden" name="homeworkVoiceKey" value={homeworkVoiceKey} />

      <fieldset>
        <legend className="flex w-full items-baseline justify-between gap-3">
          <span className="font-display text-lg font-bold">{t.attendance}</span>
          <span className="text-sm text-muted" aria-live="polite">
            {fill(t.count, { p: num(students.length - absent, lang), a: num(absent, lang) })}
          </span>
        </legend>
        {students.length === 0 && <p className="mt-3 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">{t.empty}</p>}
        <ul className="mt-3 flex flex-col gap-2.5">
          {students.map((s, i) => (
            <li key={s.id} className="rise group/row rounded-2xl border border-line bg-surface p-3.5 transition has-[input[name=absent]:checked]:border-red-500/40 has-[input[name=absent]:checked]:bg-red-500/[0.06]" style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/20 font-display text-sm font-extrabold text-accent-text">{[...s.name][0]}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                <label className="cursor-pointer">
                  <input type="checkbox" name="absent" value={s.id} className="peer sr-only" />
                  <span className="inline-flex h-11 min-w-[5.5rem] items-center justify-center rounded-full bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-700 transition peer-checked:hidden peer-focus-visible:ring-4 peer-focus-visible:ring-accent/30 dark:text-emerald-300">{t.present}</span>
                  <span className="hidden h-11 min-w-[5.5rem] items-center justify-center rounded-full bg-red-500 px-4 text-sm font-semibold text-white transition peer-checked:inline-flex peer-focus-visible:ring-4 peer-focus-visible:ring-accent/30">{t.absent}</span>
                </label>
              </div>
              <div className="mt-3 flex flex-col gap-2.5 group-has-[input[name=absent]:checked]/row:hidden">
                <Scale name={`activity_${s.id}`} max={5} def={4} label={t.activity} lang={lang} />
                <Scale name={`homeworkScore_${s.id}`} max={3} def={2} label={t.homework} lang={lang} />
                <details className="group/note">
                  <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                    <NotePencil className="size-4" />
                    {t.addNote}
                  </summary>
                  <input name={`note_${s.id}`} maxLength={500} placeholder={t.notePh} aria-label={t.addNote} className={`${field} mt-1.5 !py-2.5 text-sm`} />
                  <p className="mt-1 text-xs text-muted">{t.noteHelp}</p>
                </details>
              </div>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-col gap-3">
        <label htmlFor={`report-${sessionId}`} className="font-display text-lg font-bold">
          {t.report}
        </label>
        <textarea id={`report-${sessionId}`} name="report" rows={4} className={field} placeholder={aiOn ? t.reportAi : t.reportPlain} />
        <Recorder label={t.voice} onKey={setVoiceKey} voiceKey={voiceKey} w={t} />
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor={`hw-${sessionId}`} className="font-display text-lg font-bold">
          {t.homeworkText}
        </label>
        <textarea id={`hw-${sessionId}`} name="homework" rows={3} className={field} />
        <Recorder label={t.voiceHomework} onKey={setHomeworkVoiceKey} voiceKey={homeworkVoiceKey} w={t} />
      </div>

      {state.error && errors[state.error] && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-700 dark:text-red-300" role="alert">
          {errors[state.error]}
        </p>
      )}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 md:bottom-4">
        <button disabled={pending} className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-accent text-base font-bold text-on-accent shadow-[0_10px_30px_-10px_color-mix(in_srgb,var(--accent)_70%,transparent)] transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-70">
          {pending && <CircleNotch className="size-5 animate-spin" />}
          {t.submit}
        </button>
      </div>
    </form>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Recorder({ label, onKey, voiceKey, w }: { label: string; onKey: (key: string) => void; voiceKey: string; w: Work }) {
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [on, setOn] = useState(false);
  const [sec, setSec] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  async function toggle() {
    if (on && rec.current) {
      rec.current.stop();
      setOn(false);
      if (timer.current) clearInterval(timer.current);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const media = new MediaRecorder(stream);
      rec.current = media;
      media.ondataavailable = (e) => chunks.push(e.data);
      media.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
        if (localUrl) URL.revokeObjectURL(localUrl);
        setLocalUrl(URL.createObjectURL(blob));
        setUploading(true);
        const body = new FormData();
        body.set("file", blob, "note.webm");
        const res = await fetch("/api/teacher/voice", { method: "POST", body });
        setUploading(false);
        if (!res.ok) {
          setErr(w.errSave);
          return;
        }
        const data = (await res.json()) as { key: string };
        onKey(data.key);
      };
      media.start();
      setOn(true);
      setSec(0);
      setErr("");
      timer.current = setInterval(() => setSec((n) => n + 1), 1000);
    } catch {
      setErr(w.errMic);
    }
  }

  function clear() {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    onKey("");
    setSec(0);
    setErr("");
  }

  const playSrc = localUrl ?? (voiceKey ? `/api/teacher/voice?key=${encodeURIComponent(voiceKey)}` : null);

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={toggle}
          disabled={uploading}
          data-sfx={on ? "close" : "open"}
          className={`inline-flex h-12 items-center gap-2.5 rounded-full px-5 font-medium transition active:scale-[0.98] ${
            on ? "bg-red-500 text-white" : "border border-line hover:border-ink/30"
          }`}
        >
          {on ? <Stop className="size-5" weight="fill" /> : <Microphone className="size-5" weight="duotone" />}
          {on ? w.stop : label}
        </button>
        {on && (
          <span className="inline-flex items-center gap-2 font-mono text-red-600 dark:text-red-400" aria-live="polite">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            {w.recording} {formatTime(sec)}
          </span>
        )}
        {uploading && <span className="text-muted">{w.saving}</span>}
        {!on && voiceKey && !uploading && <span className="text-accent-text">{w.ready}</span>}
        {err && (
          <span className="text-red-600 dark:text-red-400" role="alert">
            {err}
          </span>
        )}
      </div>
      {playSrc && !on && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <audio controls src={playSrc} className="h-10 max-w-full flex-1" preload="metadata" />
          <button type="button" onClick={clear} data-sfx="remove" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs text-muted hover:text-ink">
            <Trash className="size-3.5" />
            {w.remove}
          </button>
        </div>
      )}
    </div>
  );
}
