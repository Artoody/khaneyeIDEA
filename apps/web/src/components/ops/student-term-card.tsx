import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { EnrollmentTermDetail, TermSessionRow } from "@khaneyeidea/core";
import { href, num, pick, type Locale } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import type { OpsDict } from "@/lib/ops-i18n";
import { Badge } from "@/components/admin/ui";
import { EnrollmentPackageEdit } from "@/components/ops/enrollment-package-edit";

function statusLabel(o: OpsDict, status: EnrollmentTermDetail["item"]["status"]) {
  switch (status) {
    case "waitlist":
      return o.students.statusWaitlist;
    case "paused":
      return o.students.statusPaused;
    case "finished":
      return o.students.statusFinished;
    case "dropped":
      return o.students.statusDropped;
    default:
      return o.students.statusActive;
  }
}

function markBadge(o: OpsDict, row: TermSessionRow) {
  if (row.attendanceStatus === "present") return <Badge tone="success">{o.students.markPresent}</Badge>;
  if (row.attendanceStatus === "absent") return <Badge tone="accent">{o.students.markAbsent}</Badge>;
  if (row.attendanceStatus === "excused") return <Badge tone="muted">{o.students.markExcused}</Badge>;
  if (row.sessionStatus === "held" || row.sessionStatus === "held_incomplete") {
    return <Badge tone="muted">{o.students.noMark}</Badge>;
  }
  return <Badge tone="muted">{o.status[row.sessionStatus] ?? row.sessionStatus}</Badge>;
}

function SessionCard({ row, lang, o }: { row: TermSessionRow; lang: Locale; o: OpsDict }) {
  const day = dayLabel(tehranIso(row.startsAt), lang, { weekday: true });
  const time = `${timeLabel(row.startsAt, lang)}–${timeLabel(row.endsAt, lang)}`;
  return (
    <li className="rounded-xl border border-line/80 bg-bg/50 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{day}</p>
          <p className="text-xs text-muted" dir="ltr">
            {time}
          </p>
        </div>
        {markBadge(o, row)}
      </div>
      {(row.activityScore != null || row.homeworkScore != null) && (
        <p className="mt-2 text-xs text-muted">
          {[
            row.activityScore != null ? fill(o.students.activityScore, { n: num(row.activityScore, lang) }) : null,
            row.homeworkScore != null ? fill(o.students.homeworkScore, { n: num(row.homeworkScore, lang) }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {row.note && (
        <p className="mt-2 text-sm leading-relaxed">
          <span className="text-xs font-medium text-muted">{o.students.teacherNote}: </span>
          {row.note}
        </p>
      )}
      {row.reportSummary && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted">{o.students.sessionReport}</p>
          <p className="mt-0.5 whitespace-pre-line leading-relaxed text-ink/90">{row.reportSummary}</p>
        </div>
      )}
      {row.homeworkText && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted">{o.students.sessionHomework}</p>
          <p className="mt-0.5 whitespace-pre-line leading-relaxed text-ink/90">{row.homeworkText}</p>
        </div>
      )}
    </li>
  );
}

export function StudentTermCard({
  detail,
  lang,
  o,
  years,
  open,
  editable,
}: {
  detail: EnrollmentTermDetail;
  lang: Locale;
  o: OpsDict;
  years: number[];
  open: boolean;
  editable?: boolean;
}) {
  const item = detail.item;
  const st = o.students;
  return (
    <details
      {...(open ? { open: true } : {})}
      className="group rounded-2xl border border-line bg-surface open:shadow-[0_8px_24px_-18px_rgb(0_0_0/0.35)]"
      name="student-term"
    >
      <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <CaretDown className="mt-1 size-4 shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.classTitle}</span>
            {item.status !== "active" && <Badge tone={item.status === "finished" ? "success" : "muted"}>{statusLabel(o, item.status)}</Badge>}
            {item.termComplete && <Badge tone="accent">{st.packageDone}</Badge>}
          </span>
          <span className="mt-1 block text-xs text-muted">
            {[
              item.teacherName ? `${st.teacher}: ${pick(item.teacherName, lang)}` : null,
              item.termName ? `${st.term}: ${pick(item.termName, lang)}` : null,
              fill(st.packageProgress, { u: num(item.sessionsUsed, lang), p: num(item.plannedSessions, lang) }),
              fill(st.presentAbsent, { p: num(item.present, lang), a: num(item.absent, lang) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </summary>

      <div className="border-t border-line px-3 pb-3 pt-2">
        <Link href={href(lang, `/app/admin/classes/${item.classGroupId}`)} className="text-sm text-accent-text hover:underline">
          {item.classTitle}
        </Link>
        {editable && (
          <EnrollmentPackageEdit
            enrollmentId={item.enrollmentId}
            plannedSessions={item.plannedSessions}
            termStartedOn={item.termStartedOn}
            sessionsUsed={item.sessionsUsed}
            termComplete={item.termComplete}
            o={o}
            lang={lang}
            years={years}
          />
        )}

        <p className="mt-2 text-xs font-semibold text-muted">{st.termSummary}</p>
        <p className="mt-1 text-sm text-muted">
          {[
            fill(st.presentAbsent, { p: num(item.present, lang), a: num(item.absent, lang) }),
            item.avgActivity != null ? fill(st.avgActivity, { n: num(item.avgActivity, lang) }) : null,
            item.avgHomework != null ? fill(st.avgHomework, { n: num(item.avgHomework, lang) }) : null,
            fill(st.remaining, { n: num(item.sessionsRemaining, lang) }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {detail.sessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{st.noSessions}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {detail.sessions.map((row) => (
              <SessionCard key={row.sessionId} row={row} lang={lang} o={o} />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
