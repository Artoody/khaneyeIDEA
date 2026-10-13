"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Microphone, Stop, Trash } from "@phosphor-icons/react";
import { submitClassWork } from "./actions";

export function WorkForm({
  lang,
  sessionId,
  students,
  aiOn,
}: {
  lang: string;
  sessionId: string;
  students: { id: string; name: string }[];
  aiOn: boolean;
}) {
  const [state, action, pending] = useActionState(submitClassWork, {});
  const [voiceKey, setVoiceKey] = useState("");
  const [homeworkVoiceKey, setHomeworkVoiceKey] = useState("");
  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="voiceKey" value={voiceKey} />
      <input type="hidden" name="homeworkVoiceKey" value={homeworkVoiceKey} />
      <fieldset>
        <legend className="text-sm font-medium">حضور، فعالیت (۰ تا ۵)، تکلیف (۰ تا ۳) و توضیحات</legend>
        <ul className="mt-3 flex flex-col gap-3">
          {students.map((s) => (
            <li key={s.id} className="rounded-2xl border border-line px-3 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex min-w-24 cursor-pointer items-center gap-2 text-sm has-[:checked]:text-red-500">
                  <input type="checkbox" name="absent" value={s.id} className="accent-red-500" />
                  غایب
                </label>
                <span className="min-w-0 flex-1 font-medium">{s.name}</span>
                <label className="flex items-center gap-1 text-xs text-muted">
                  فعالیت
                  <select name={`activity_${s.id}`} defaultValue="4" className="h-9 rounded-xl border border-line bg-surface px-2 text-sm text-ink">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-xs text-muted">
                  تکلیف
                  <select name={`homeworkScore_${s.id}`} defaultValue="2" className="h-9 rounded-xl border border-line bg-surface px-2 text-sm text-ink">
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-xs text-muted">
                توضیحات اضافه (اگر موردی دارد، با نام در گروه می‌آید)
                <input
                  name={`note_${s.id}`}
                  maxLength={500}
                  placeholder="مثلاً نیاز به تمرین بیشتر روی سنسور…"
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70"
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm">
        گزارش کلاس
        <textarea name="report" rows={4} className="rounded-2xl border border-line bg-surface p-3" placeholder={aiOn ? "هرچه شد بنویسید؛ متن مرتب می‌شود." : "گزارش را بنویسید."} />
      </label>
      <Recorder label="ویس گزارش" onKey={setVoiceKey} voiceKey={voiceKey} />
      <label className="flex flex-col gap-1.5 text-sm">
        تکلیف هفته
        <textarea name="homework" rows={3} className="rounded-2xl border border-line bg-surface p-3" />
      </label>
      <Recorder label="ویس تکلیف" onKey={setHomeworkVoiceKey} voiceKey={homeworkVoiceKey} />
      {state.error === "empty" && <p className="text-sm text-red-500">گزارش را بنویسید یا ویس بگذارید.</p>}
      {state.error === "voice" && <p className="text-sm text-red-500">ویس خوانده نشد؛ دوباره ضبط کنید یا متن بنویسید.</p>}
      {state.error === "ai" && <p className="text-sm text-red-500">سرویس هوش مصنوعی برای رونویسی ویس تنظیم نشده.</p>}
      {state.error === "missing" && <p className="text-sm text-red-500">این جلسه برای شما نیست.</p>}
      <button disabled={pending} className="h-12 rounded-full bg-accent text-sm font-semibold text-on-accent">
        {pending ? "..." : "ثبت گزارش"}
      </button>
    </form>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Recorder({ label, onKey, voiceKey }: { label: string; onKey: (key: string) => void; voiceKey: string }) {
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
          setErr("ضبط ذخیره نشد.");
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
      setErr("دسترسی میکروفون داده نشد.");
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
    <div className="rounded-2xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={toggle}
          disabled={uploading}
          className={`inline-flex h-11 items-center gap-2 rounded-full px-4 transition ${
            on ? "bg-red-500/15 text-red-600 ring-1 ring-red-500/40" : "border border-line"
          }`}
        >
          {on ? <Stop className="size-4" weight="fill" /> : <Microphone className="size-4" />}
          {on ? "توقف ضبط" : label}
        </button>
        {on && (
          <span className="inline-flex items-center gap-2 font-mono text-red-600" aria-live="polite">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            در حال ضبط · {formatTime(sec)}
          </span>
        )}
        {uploading && <span className="text-muted">در حال ذخیره…</span>}
        {!on && voiceKey && !uploading && <span className="text-accent-text">آماده پخش</span>}
        {err && <span className="text-red-500">{err}</span>}
      </div>
      {playSrc && !on && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <audio controls src={playSrc} className="h-10 max-w-full flex-1" preload="metadata" />
          <button type="button" onClick={clear} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-muted">
            <Trash className="size-3.5" />
            حذف
          </button>
        </div>
      )}
    </div>
  );
}
