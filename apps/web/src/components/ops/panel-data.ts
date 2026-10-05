import "server-only";
import { effectiveStatus } from "@khaneyeidea/core";
import { pick, type Locale } from "@/lib/i18n";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import type { OpsDict } from "@/lib/ops-i18n";
import type { loadSessionDetail } from "@/server/sessions";
import type { PanelData } from "./session-panel";

export function panelData(d: NonNullable<Awaited<ReturnType<typeof loadSessionDetail>>>, lang: Locale, o: OpsDict): PanelData {
  const day = tehranIso(d.s.startsAt);
  return {
    id: d.s.id,
    title: d.c.title,
    when: `${dayLabel(day, lang)} · ${timeLabel(d.s.startsAt, lang)}-${timeLabel(d.s.endsAt, lang)}`,
    dayLabel: dayLabel(day, lang),
    place: [d.teacher ? pick(d.teacher, lang) : null, d.branch ? pick(d.branch, lang) : o.classes.online].filter(Boolean).join(" · "),
    status: effectiveStatus(d.s),
    started: d.s.startsAt <= new Date(),
    roster: d.roster.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`.trim() })),
    marks: Object.fromEntries(d.marks.map((m) => [m.studentId, m.status])),
    summary: d.report?.summary ?? "",
    homework: d.homework?.text ?? null,
    hasHomeworkRow: !!d.homework,
    announcement: d.announcement ? { text: d.announcement.text, sendAt: `${dayLabel(tehranIso(d.announcement.sendAt), lang)} ${timeLabel(d.announcement.sendAt, lang)}` } : null,
    notHeldReason: d.s.notHeldReason,
  };
}

/** Status colours for the board (spec section 1). */
export const STATUS_STYLE: Record<string, string> = {
  scheduled: "border-line bg-surface/90",
  cancel_planned: "border-accent/30 bg-accent/5 opacity-70 [&_.title]:line-through",
  awaiting_teacher: "border-accent/70 bg-accent/15",
  held_incomplete: "border-accent/60 bg-accent/10",
  held: "border-emerald-500/50 bg-emerald-500/10",
  not_held: "border-red-500/50 bg-red-500/10",
  needs_makeup: "border-red-500/60 bg-red-500/15",
};
export const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-ink/25",
  cancel_planned: "bg-accent/50",
  awaiting_teacher: "bg-accent",
  held_incomplete: "bg-accent",
  held: "bg-emerald-500",
  not_held: "bg-red-500",
  needs_makeup: "bg-red-500",
};
