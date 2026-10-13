import { Monitor, MapPin, VideoCamera, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { fill } from "@/lib/format";
import { num, type Locale } from "@/lib/i18n";
import type { OpsDict } from "@/lib/ops-i18n";

export type Focus = {
  title: string;
  phase: "live" | "ended" | "next";
  /** formatted times */
  from: string;
  to: string;
  /** "in 40 minutes" for today's next class, the weekday and date otherwise */
  when: string;
  place: string;
  online: boolean;
  names: string[];
  link: string | null;
  progress: number;
};

/**
 * The one thing to do now. A dark card (light in dark mode) so it is the first thing the eye lands on: what and when,
 * where, who is coming, and the single button that matters (join, or write the report).
 */
export function FocusCard({ f, lang, t }: { f: Focus; lang: Locale; t: OpsDict["tp"] }) {
  const label = f.phase === "live" ? t.live : f.phase === "ended" ? t.ended : t.next;
  const shown = f.names.slice(0, 5);
  return (
    <section aria-label={label} className="rise relative overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-zinc-900 p-5 text-zinc-50 shadow-[0_18px_40px_-22px_rgb(0_0_0/0.5)] sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-accent/25 blur-3xl" />
      <div className="relative">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${f.phase === "next" ? "bg-white/15 text-zinc-50" : "bg-accent text-on-accent"}`}>
          {f.phase === "live" && <span className="live-dot size-2 rounded-full bg-on-accent" />}
          {label}
        </span>
        <h2 className="mt-4 font-display text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-3xl">{f.title}</h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-zinc-50/75">
          <span className="font-display text-xl font-bold tabular-nums text-zinc-50">
            {f.from} - {f.to}
          </span>
          <span className="text-sm">{f.when}</span>
        </p>
        {f.phase === "live" && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(f.progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${f.progress}%` }} />
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-zinc-50/80">
          <span className="inline-flex items-center gap-1.5">
            {f.online ? <Monitor className="size-5" weight="duotone" /> : <MapPin className="size-5" weight="duotone" />}
            {f.place}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="flex -space-x-2 rtl:space-x-reverse">
              {shown.map((n, i) => (
                <span key={i} className="grid size-7 place-items-center rounded-full bg-white/20 text-[11px] font-bold ring-2 ring-zinc-900">
                  {[...n][0]}
                </span>
              ))}
            </span>
            <UsersThree className="size-5" weight="duotone" />
            {fill(t.students, { n: num(f.names.length, lang) })}
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {f.phase !== "next" && (
            <a href="#report" data-sfx="swoosh" className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-base font-bold text-on-accent transition hover:bg-accent-strong active:scale-[0.98]">
              {t.writeReport}
            </a>
          )}
          {f.link && (
            <a
              href={f.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition active:scale-[0.98] ${f.phase === "next" ? "bg-accent text-on-accent hover:bg-accent-strong" : "border border-white/30 text-zinc-50 hover:border-white/60"}`}
            >
              <VideoCamera className="size-5" weight="duotone" />
              {t.joinClass}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
