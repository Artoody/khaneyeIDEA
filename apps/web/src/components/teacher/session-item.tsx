import Link from "next/link";
import { Monitor, MapPin, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { num, pick, type Locale } from "@/lib/i18n";
import { timeLabel } from "@/lib/jalali";
import type { OpsDict } from "@/lib/ops-i18n";
import { STATUS_DOT } from "@/components/ops/panel-data";

export type ItemRow = {
  s: { id: string; startsAt: Date; endsAt: Date };
  c: { title: string };
  branch: { fa: string; en?: string } | null;
  students: number;
  status: string;
};

/**
 * One class in a list: the hour on the side, the name, where and how many, and a quiet state. The whole card opens
 * the session sheet. Items that still need a report get the amber edge, a class in session gets the pulsing dot.
 */
export function SessionItem({ r, lang, o, to, live = false, day }: { r: ItemRow; lang: Locale; o: OpsDict; to: string; live?: boolean; day?: string }) {
  const needs = r.status === "awaiting_teacher" || r.status === "held_incomplete";
  const done = r.status === "held";
  const off = r.status === "cancel_planned" || r.status === "not_held" || r.status === "needs_makeup";
  return (
    <Link
      href={to}
      scroll={false}
      className={`group relative flex items-stretch gap-3.5 overflow-hidden rounded-2xl border bg-surface p-3.5 transition active:scale-[0.99] ${
        live ? "border-accent shadow-[0_8px_24px_-14px_color-mix(in_srgb,var(--accent)_80%,transparent)]" : needs ? "border-accent/50" : "border-line hover:border-ink/25"
      } ${off ? "opacity-60" : ""}`}
    >
      <span className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-ink/[0.045] py-1.5 tabular-nums">
        <span className="font-display text-lg font-black leading-none">{timeLabel(r.s.startsAt, lang)}</span>
        <span className="mt-1 text-[11px] leading-none text-muted">{timeLabel(r.s.endsAt, lang)}</span>
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        {day && <span className="mb-0.5 block text-xs font-medium text-accent-text">{day}</span>}
        <span className={`block truncate font-semibold leading-snug ${r.status === "cancel_planned" ? "line-through" : ""}`}>{r.c.title}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
          <span className="sm:hidden">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${live ? "bg-accent/20 font-semibold text-accent-text" : needs ? "bg-accent/15 text-accent-text" : done ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-ink/[0.05] text-muted"}`}>
                      <span className={`size-2 rounded-full ${live ? "live-dot bg-accent" : STATUS_DOT[r.status]}`} />
                      {o.status[r.status as keyof typeof o.status] ?? ""}
                    </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            {r.branch ? <MapPin className="size-4 shrink-0" weight="duotone" /> : <Monitor className="size-4 shrink-0" weight="duotone" />}
            <span className="truncate">{r.branch ? pick(r.branch as never, lang) : o.classes.online}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <UsersThree className="size-4" weight="duotone" />
            {num(r.students, lang)}
          </span>
        </span>
      </span>
      <span className="hidden shrink-0 items-center sm:flex">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${live ? "bg-accent/20 font-semibold text-accent-text" : needs ? "bg-accent/15 text-accent-text" : done ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-ink/[0.05] text-muted"}`}>
          <span className={`size-2 rounded-full ${live ? "live-dot bg-accent" : STATUS_DOT[r.status]}`} />
          {o.status[r.status as keyof typeof o.status] ?? ""}
        </span>
      </span>
    </Link>
  );
}
