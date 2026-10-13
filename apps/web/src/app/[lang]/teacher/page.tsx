import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { CheckCircle, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";
import { enrollments, getDb, students } from "@khaneyeidea/db";
import { addDays, effectiveStatus } from "@khaneyeidea/core";
import { fill } from "@/lib/format";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import { loadSessionDetail, loadWeek, weekStart } from "@/server/sessions";
import { loadCoach } from "@/components/teacher/context";
import { TeacherShell } from "@/components/teacher/shell";
import { FocusCard, type Focus } from "@/components/teacher/focus-card";
import { SessionItem } from "@/components/teacher/session-item";
import { SessionSheet } from "@/components/teacher/sheet";
import { TeacherPwa } from "@/components/teacher/pwa";
import { SessionPanel } from "@/components/ops/session-panel";
import { panelData } from "@/components/ops/panel-data";
import { toggleClassAi } from "./actions";
import { WorkForm } from "./work-form";

const MS = 60_000;

async function Home({ lang, selected, saved }: { lang: Locale; selected: string | null; saved: boolean }) {
  const { user, profile, o, t } = await loadCoach(lang);
  if (!profile) {
    return (
      <TeacherShell lang={lang} t={t} active="today">
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{t.profile.noLink}</p>
      </TeacherShell>
    );
  }
  const db = getDb();
  const now = new Date();
  const today = tehranIso(now);
  const thisWeek = weekStart(today);
  // Three weeks back (what still waits for a report) and the coming week (the next class may be there).
  const weeks = await Promise.all([-14, -7, 0, 7].map((d) => loadWeek(user.tenantId, addDays(thisWeek, d), {}, profile.id)));
  const rows = weeks.flat().map((r) => ({ ...r, status: effectiveStatus(r.s) }));

  type Row = (typeof rows)[number];
  const closed = (r: Row) => r.status === "cancel_planned" || r.status === "held" || r.status === "not_held" || r.status === "needs_makeup";
  const live = rows.find((r) => r.s.startsAt <= now && r.s.endsAt >= now && !closed(r));
  const justEnded = rows.filter((r) => r.s.endsAt < now && r.s.endsAt.getTime() + 2 * 60 * MS >= now.getTime() && !closed(r)).at(-1);
  const next = rows.find((r) => r.s.startsAt > now && r.status === "scheduled");
  const focusRow = live ?? justEnded ?? next ?? null;
  const phase: Focus["phase"] = live ? "live" : justEnded && focusRow === justEnded ? "ended" : "next";

  const roster = focusRow
    ? await db
        .select({ id: students.id, name: students.firstName })
        .from(enrollments)
        .innerJoin(students, eq(students.id, enrollments.studentId))
        .where(and(eq(enrollments.classGroupId, focusRow.c.id), eq(enrollments.status, "active")))
        .orderBy(asc(students.firstName))
    : [];

  const until = (d: Date) => {
    const m = Math.max(1, Math.round((d.getTime() - now.getTime()) / MS));
    if (m < 60) return fill(t.minutes, { n: num(m, lang) });
    const h = Math.floor(m / 60);
    return m % 60 ? fill(t.hourMin, { h: num(h, lang), m: num(m % 60, lang) }) : fill(t.hours, { n: num(h, lang) });
  };
  const focus: Focus | null = focusRow
    ? {
        title: focusRow.c.title,
        phase,
        from: timeLabel(focusRow.s.startsAt, lang),
        to: timeLabel(focusRow.s.endsAt, lang),
        when: phase === "next" ? (focusRow.day === today ? fill(t.startsIn, { t: until(focusRow.s.startsAt) }) : dayLabel(focusRow.day, lang)) : dayLabel(focusRow.day, lang),
        place: focusRow.branch ? pick(focusRow.branch, lang) : o.classes.online,
        online: !focusRow.branch,
        names: roster.map((r) => r.name),
        link: focusRow.c.onlineUrl || profile.meetingUrl || null,
        progress: phase === "live" ? Math.min(100, Math.max(0, ((now.getTime() - focusRow.s.startsAt.getTime()) / (focusRow.s.endsAt.getTime() - focusRow.s.startsAt.getTime())) * 100)) : 0,
      }
    : null;

  const todo = rows.filter((r) => (r.status === "awaiting_teacher" || r.status === "held_incomplete") && r.s.id !== focusRow?.s.id);
  const todayRows = rows.filter((r) => r.day === today);
  const base = href(lang, "/teacher");
  const open = (id: string) => `${base}?s=${id}`;

  const detail = selected && z.uuid().safeParse(selected).success ? await loadSessionDetail(selected) : null;
  const panel = detail && detail.s.teacherId === profile.id && detail.s.tenantId === user.tenantId ? panelData(detail, lang, o) : null;

  return (
    <TeacherShell lang={lang} t={t} active="today">
      <div className="mb-5">
        <p className="text-sm text-muted">{dayLabel(today, lang, { weekday: true, year: true })}</p>
        <h1 className="mt-1 font-display text-[1.7rem] font-extrabold leading-tight tracking-tight">
          {t.hello}، <bdi>{pick(profile.name, lang)}</bdi>
        </h1>
      </div>

      {saved && (
        <p className="rise mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm font-medium text-emerald-800 dark:text-emerald-200" role="status">
          <CheckCircle className="size-5 shrink-0" weight="fill" />
          {t.saved}
        </p>
      )}

      {focus && focusRow ? (
        <>
          <FocusCard f={focus} lang={lang} t={t} />
          <form action={toggleClassAi} className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-2.5 text-sm">
            <input type="hidden" name="classId" value={focusRow.c.id} />
            <input type="hidden" name="lang" value={lang} />
            <span className="inline-flex min-w-0 items-center gap-2 text-muted">
              <Sparkle className={`size-4 shrink-0 ${focusRow.c.aiReportEnabled ? "text-accent-text" : ""}`} weight="duotone" />
              <span className="truncate">{focusRow.c.aiReportEnabled ? t.aiOn : t.aiOff}</span>
            </span>
            <button className="h-9 shrink-0 rounded-full border border-line px-4 font-medium transition hover:border-ink/30 active:scale-[0.97]">{focusRow.c.aiReportEnabled ? t.aiTurnOff : t.aiTurnOn}</button>
          </form>
          {phase !== "next" && (
            <section id="report" className="mt-8 scroll-mt-20">
              <WorkForm lang={lang} sessionId={focusRow.s.id} students={roster} aiOn={focusRow.c.aiReportEnabled} t={t.work} />
            </section>
          )}
        </>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{t.noUpcoming}</p>
      )}

      {todo.length > 0 && (
        <section className="mt-9" data-testid="todo">
          <h2 className="mb-3 font-display text-lg font-bold text-accent-text">{t.toReport}</h2>
          <ul className="flex flex-col gap-2.5">
            {todo.map((r, i) => (
              <li key={r.s.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                <SessionItem r={r} lang={lang} o={o} to={open(r.s.id)} day={dayLabel(r.day, lang)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-9" data-testid="today">
        <h2 className="mb-3 font-display text-lg font-bold">{t.todaySchedule}</h2>
        {todayRows.length ? (
          <ul className="flex flex-col gap-2.5">
            {todayRows.map((r, i) => (
              <li key={r.s.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                <SessionItem r={r} lang={lang} o={o} to={open(r.s.id)} live={r.s.id === live?.s.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-5 text-sm text-muted">{t.emptyToday}</p>
        )}
        <Link href={href(lang, "/teacher/week")} className="mt-3 inline-flex h-11 items-center rounded-full border border-line px-5 text-sm transition hover:border-ink/30 active:scale-[0.98]">
          {t.weekTitle}
        </Link>
      </section>

      <div className="mt-9">
        <TeacherPwa t={t.push} />
      </div>

      {panel && (
        <SessionSheet closeHref={base} closeLabel={o.board.close} title={panel.title} when={panel.when}>
          <SessionPanel key={panel.id} d={panel} o={o} lang={lang} asTeacher />
        </SessionSheet>
      )}
    </TeacherShell>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-2xl px-4 pt-20" aria-busy="true">
      <div className="h-3.5 w-40 rounded-full bg-ink/[0.07]" />
      <div className="mt-3 h-8 w-64 rounded-xl bg-ink/[0.08]" />
      <div className="relative mt-6 h-64 overflow-hidden rounded-[var(--radius-card)] bg-ink/[0.07]">
        <div className="shimmer size-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rise relative mt-3 h-[4.5rem] overflow-hidden rounded-2xl bg-ink/[0.045]" style={{ "--i": i } as React.CSSProperties}>
          <div className="shimmer size-full" style={{ animationDelay: `${i * 160}ms` }} />
        </div>
      ))}
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/[lang]/teacher">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      {Promise.all([params, searchParams]).then(([{ lang }, sp]) =>
        isLocale(lang) ? <Home lang={lang} selected={typeof sp.s === "string" ? sp.s : null} saved={sp.saved === "1"} /> : notFound(),
      )}
    </Suspense>
  );
}
