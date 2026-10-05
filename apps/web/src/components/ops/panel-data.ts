import "server-only";
import { effectiveStatus } from "@khaneyeidea/core";
import { pick, type Locale } from "@/lib/i18n";
import { dayLabel, tehranIso, timeLabel, WEEKDAYS } from "@/lib/jalali";
import { addDays } from "@khaneyeidea/core";
import type { OpsDict } from "@/lib/ops-i18n";
import type { loadSessionDetail } from "@/server/sessions";
import type { PanelData } from "./session-panel";

const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** The next four weeks as pick-able days (weekday + Jalali date), starting tomorrow. */
export function dayOptions(lang: Locale) {
  const today = tehranIso(new Date());
  return Array.from({ length: 28 }, (_, i) => {
    const iso = addDays(today, i + 1);
    const wd = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    return { iso, weekday: WEEKDAYS[lang][(wd + 1) % 7]!, label: dayLabel(iso, lang, { weekday: false }) };
  });
}

export function panelData(d: NonNullable<Awaited<ReturnType<typeof loadSessionDetail>>>, lang: Locale, o: OpsDict): PanelData {
  const day = tehranIso(d.s.startsAt);
  return {
    id: d.s.id,
    title: d.c.title,
    when: `${dayLabel(day, lang)} · ${timeLabel(d.s.startsAt, lang)}-${timeLabel(d.s.endsAt, lang)}`,
    dayLabel: dayLabel(day, lang),
    dayIso: day,
    place: [d.teacher ? pick(d.teacher, lang) : null, d.branch ? pick(d.branch, lang) : o.classes.online].filter(Boolean).join(" · "),
    status: effectiveStatus(d.s),
    started: d.s.startsAt <= new Date(),
    roster: d.roster.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`.trim() })),
    marks: Object.fromEntries(d.marks.map((m) => [m.studentId, m.status])),
    summary: d.report?.summary ?? "",
    homework: d.homework?.text ?? null,
    hasHomeworkRow: !!d.homework,
    announcement: d.announcement ? { status: d.announcement.status, text: d.announcement.text, sendAt: `${dayLabel(tehranIso(d.announcement.sendAt), lang)} ${timeLabel(d.announcement.sendAt, lang)}` } : null,
    notHeldReason: d.s.notHeldReason,
    classGroupId: d.c.id,
    from: hhmm(d.s.startsAt),
    to: hhmm(d.s.endsAt),
    whenShort: `${dayLabel(day, lang)} ${timeLabel(d.s.startsAt, lang)}`,
    custom: d.s.custom,
    isMakeup: !!d.s.makeupOfSessionId || (d.s.custom && !d.s.originalStartsAt),
    days: dayOptions(lang),
    request: d.request ? { reason: d.request.reason } : null,
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
