import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { UsersThree, X } from "@phosphor-icons/react/dist/ssr";
import { getDb, teachers } from "@khaneyeidea/db";
import { effectiveStatus } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { loadSessionDetail, loadWeek, weekStart } from "@/server/sessions";
import { PanelShell, PanelSkeleton } from "@/components/panel/panel-shell";
import { SessionPanel } from "@/components/ops/session-panel";
import { panelData, STATUS_DOT, STATUS_STYLE } from "@/components/ops/panel-data";

async function TeacherPanel({ lang, selected }: { lang: Locale; selected: string | null }) {
  const user = await requirePermissionPage(lang, "session.report_own");
  const o = getOpsDict(lang);
  const [profile] = await getDb().select().from(teachers).where(eq(teachers.userId, user.userId));
  if (!profile || profile.tenantId !== user.tenantId)
    return (
      <PanelShell lang={lang} user={user} title={o.teacher.title}>
        <p className="mt-8 max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{o.teacher.noProfile}</p>
      </PanelShell>
    );

  const today = tehranIso(new Date());
  const week = (await loadWeek(user.tenantId, weekStart(today), {}, profile.id)).map((r) => ({ ...r, status: effectiveStatus(r.s) }));
  const todays = week.filter((r) => r.day === today);
  const todo = week.filter((r) => r.status === "awaiting_teacher" || r.status === "held_incomplete");
  const base = href(lang, "/app/teacher");

  // The panel only opens sessions that belong to this teacher.
  const detail = selected && z.uuid().safeParse(selected).success ? await loadSessionDetail(selected) : null;
  const panel = detail && detail.s.teacherId === profile.id && detail.s.tenantId === user.tenantId ? panelData(detail, lang, o) : null;

  const card = (r: (typeof week)[number]) => (
    <Link key={r.s.id} href={`${base}?s=${r.s.id}`} scroll={false} className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 ${STATUS_STYLE[r.status]}`}>
      <span className="flex items-center justify-between gap-2 text-sm">
        <span className="font-display font-bold tabular-nums">
          {r.day !== today && <span className="me-1.5 font-normal text-muted">{dayLabel(r.day, lang)}</span>}
          {timeLabel(r.s.startsAt, lang)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span className={`size-2 rounded-full ${STATUS_DOT[r.status]}`} />
          {o.status[r.status]}
        </span>
      </span>
      <span className="title mt-1.5 block text-lg font-semibold">{r.c.title}</span>
      <span className="mt-1 flex items-center gap-3 text-sm text-muted">
        <span>{r.branch ? pick(r.branch, lang) : o.classes.online}</span>
        <span className="inline-flex items-center gap-1">
          <UsersThree className="size-4" />
          {num(r.students, lang)}
        </span>
      </span>
    </Link>
  );

  return (
    <PanelShell lang={lang} user={user} title={o.teacher.title}>
      <h1 className="mt-4 font-display text-3xl font-extrabold">
        {pick(profile.name, lang)}
      </h1>
      {todo.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-accent-text">{o.teacher.todo}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{todo.map(card)}</div>
        </section>
      )}
      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">{o.teacher.today}</h2>
        {todays.length === 0 ? <p className="mt-3 text-muted">{o.teacher.noToday}</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{todays.map(card)}</div>}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-lg font-bold">{o.teacher.week}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{week.filter((r) => r.day !== today).map(card)}</div>
      </section>

      {panel && (
        <>
          <Link href={base} scroll={false} aria-label={o.board.close} className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]" />
          <aside className="fixed inset-y-0 end-0 z-50 flex w-full flex-col overflow-y-auto border-s border-line bg-bg shadow-2xl sm:w-[30rem]" data-testid="session-panel">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-bg/95 p-5 backdrop-blur">
              <div>
                <h2 className="font-display text-xl font-extrabold">{panel.title}</h2>
                <p className="mt-1 text-sm text-muted">{panel.when}</p>
              </div>
              <Link href={base} scroll={false} aria-label={o.board.close} className="grid size-10 place-items-center rounded-full hover:bg-ink/5">
                <X className="size-5" />
              </Link>
            </header>
            <div className="p-5">
              <SessionPanel key={panel.id} d={panel} o={o} lang={lang} asTeacher />
            </div>
          </aside>
        </>
      )}
    </PanelShell>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/teacher">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PanelSkeleton />}>
      {searchParams.then(({ s }) => (
        <TeacherPanel lang={lang} selected={typeof s === "string" ? s : null} />
      ))}
    </Suspense>
  );
}
