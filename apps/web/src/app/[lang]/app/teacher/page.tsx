import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ArrowSquareOut, CaretDown, CaretLeft, CaretRight, ClipboardText, Monitor, UsersThree, X } from "@phosphor-icons/react/dist/ssr";
import { enrollments, getDb, messengerAccounts, students, teachers } from "@khaneyeidea/db";
import { addDays, effectiveStatus } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { dayLabel, tehranIso, timeLabel, WEEKDAYS } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { loadSessionDetail, loadWeek, weekStart } from "@/server/sessions";
import { PanelShell, PanelSkeleton } from "@/components/panel/panel-shell";
import { SessionPanel } from "@/components/ops/session-panel";
import { ConnectCard } from "@/components/ops/connect-card";
import { panelData, STATUS_DOT, STATUS_STYLE } from "@/components/ops/panel-data";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function TeacherPanel({ lang, selected, week: weekParam }: { lang: Locale; selected: string | null; week: string | null }) {
  const user = await requirePermissionPage(lang, "session.report_own");
  const o = getOpsDict(lang);
  const db = getDb();
  const [profile] = await db.select().from(teachers).where(eq(teachers.userId, user.userId));
  const linked = (await db.select({ channel: messengerAccounts.channel }).from(messengerAccounts).where(eq(messengerAccounts.userId, user.userId))).map((l) => l.channel as "bale" | "telegram");
  if (!profile || profile.tenantId !== user.tenantId)
    return (
      <PanelShell lang={lang} user={user} title={o.teacher.title}>
        <p className="mt-8 max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{o.teacher.noProfile}</p>
      </PanelShell>
    );

  const today = tehranIso(new Date());
  const thisWeek = weekStart(today);
  const start = weekParam && ISO.test(weekParam) ? weekStart(weekParam) : thisWeek;
  const rows = (await loadWeek(user.tenantId, start, {}, profile.id)).map((r) => ({ ...r, status: effectiveStatus(r.s) }));
  // Everything still waiting for an answer from the last three weeks, whichever week is on screen.
  const recent = [...(await loadWeek(user.tenantId, addDays(thisWeek, -14), {}, profile.id)), ...(await loadWeek(user.tenantId, addDays(thisWeek, -7), {}, profile.id)), ...(await loadWeek(user.tenantId, thisWeek, {}, profile.id))];
  const todo = recent.map((r) => ({ ...r, status: effectiveStatus(r.s) })).filter((r) => r.status === "awaiting_teacher" || r.status === "held_incomplete");
  const classIds = [...new Set([...rows, ...todo].map((r) => r.c.id))];
  const rosterRows = classIds.length
    ? await db
        .select({ classId: enrollments.classGroupId, name: students.firstName })
        .from(enrollments)
        .innerJoin(students, eq(students.id, enrollments.studentId))
        .where(and(inArray(enrollments.classGroupId, classIds), eq(enrollments.status, "active")))
        .orderBy(asc(students.firstName))
    : [];
  const roster = new Map<string, string[]>();
  for (const r of rosterRows) roster.set(r.classId, [...(roster.get(r.classId) ?? []), r.name]);

  const base = href(lang, "/app/teacher");
  const link = (p: { s?: string; w?: string }) => {
    const q = new URLSearchParams();
    const next = { w: start === thisWeek ? undefined : start, ...p };
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    return q.size ? `${base}?${q.toString()}` : base;
  };
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayCount = rows.filter((r) => r.day === today).length;

  const detail = selected && z.uuid().safeParse(selected).success ? await loadSessionDetail(selected) : null;
  const panel = detail && detail.s.teacherId === profile.id && detail.s.tenantId === user.tenantId ? panelData(detail, lang, o) : null;

  const card = (r: (typeof rows)[number]) => {
    const names = roster.get(r.c.id) ?? [];
    const hasLinks = r.c.onlineUrl || r.c.baleInviteUrl || r.c.telegramInviteUrl;
    return (
      <li key={r.s.id}>
        <details className={`group rounded-2xl border ${STATUS_STYLE[r.status]}`} open={selected === r.s.id}>
          <summary className="flex cursor-pointer list-none items-center gap-4 p-4 [&::-webkit-details-marker]:hidden">
            <span className="w-14 shrink-0 font-display text-xl font-black tabular-nums">{timeLabel(r.s.startsAt, lang)}</span>
            <span className="min-w-0 flex-1">
              <span className="title block truncate font-semibold">{r.c.title}</span>
              <span className="mt-0.5 flex items-center gap-3 text-sm text-muted">
                <span className="truncate">{r.branch ? pick(r.branch, lang) : o.classes.online}</span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <UsersThree className="size-4" />
                  {num(r.students, lang)}
                </span>
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
              <span className={`size-2 rounded-full ${STATUS_DOT[r.status]}`} />
              <span className="hidden sm:inline">{o.status[r.status]}</span>
            </span>
            <CaretDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-line/70 px-4 pb-4 pt-3 text-sm">
            <p className="font-medium">{o.teacherWeek.roster}</p>
            <p className="mt-1 leading-relaxed text-muted">{names.length ? names.join("، ") : o.session.noRoster}</p>
            {hasLinks && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.c.onlineUrl && (
                  <a href={r.c.onlineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 hover:border-ink/30">
                    <Monitor className="size-4" />
                    {o.groups.online}
                  </a>
                )}
                {r.c.baleInviteUrl && (
                  <a href={r.c.baleInviteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 hover:border-ink/30">
                    <ArrowSquareOut className="size-4" />
                    {o.groups.bale}
                  </a>
                )}
                {r.c.telegramInviteUrl && (
                  <a href={r.c.telegramInviteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 hover:border-ink/30">
                    <ArrowSquareOut className="size-4" />
                    {o.groups.telegram}
                  </a>
                )}
              </div>
            )}
            <Link href={link({ s: r.s.id })} scroll={false} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-bg transition active:scale-[0.98]">
              <ClipboardText className="size-4" />
              {r.s.startsAt > new Date() ? o.teacher.requestCancel : o.teacherWeek.record}
            </Link>
          </div>
        </details>
      </li>
    );
  };

  return (
    <PanelShell lang={lang} user={user} title={o.teacher.title}>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{dayLabel(today, lang, { weekday: true, year: true })}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            {o.dash.hello}، <bdi>{pick(profile.name, lang)}</bdi>
          </h1>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-ink/5 px-4 py-2">
            {o.teacher.today}: <b className="tabular-nums">{num(todayCount, lang)}</b>
          </span>
          <span className={`rounded-full px-4 py-2 ${todo.length ? "bg-accent/20" : "bg-ink/5"}`}>
            {o.teacher.todo}: <b className="tabular-nums">{num(todo.length, lang)}</b>
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>
          {todo.length > 0 && (
            <section className="mb-8" data-testid="todo">
              <h2 className="font-display text-lg font-bold text-accent-text">{o.teacher.todo}</h2>
              <ul className="mt-3 flex flex-col gap-2">{todo.map(card)}</ul>
            </section>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link href={link({ w: addDays(start, -7) })} aria-label={o.board.prev} className="grid size-10 place-items-center rounded-full border border-line hover:border-ink/30">
              <CaretRight className="size-4 ltr:rotate-180" />
            </Link>
            <Link href={base} aria-current={start === thisWeek ? "page" : undefined} className="h-10 rounded-full border border-line px-4 text-sm leading-10 text-muted aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg">
              {o.board.thisWeek}
            </Link>
            <Link href={link({ w: addDays(start, 7) })} aria-label={o.board.next} className="grid size-10 place-items-center rounded-full border border-line hover:border-ink/30">
              <CaretLeft className="size-4 ltr:rotate-180" />
            </Link>
            <span className="ms-2 text-sm text-muted">
              {dayLabel(start, lang, { weekday: false })} - {dayLabel(addDays(start, 6), lang, { weekday: false })}
            </span>
          </div>

          <div className="flex flex-col gap-6" data-testid="week">
            {days.map((day, i) => {
              const list = rows.filter((r) => r.day === day);
              if (!list.length && day !== today) return null;
              return (
                <section key={day}>
                  <h2 className={`mb-2 flex items-baseline justify-between rounded-xl px-3 py-1.5 text-sm ${day === today ? "bg-accent/15 font-semibold" : "text-muted"}`}>
                    <span>{WEEKDAYS[lang][i]}</span>
                    <span className="tabular-nums">{dayLabel(day, lang, { weekday: false })}</span>
                  </h2>
                  {list.length ? <ul className="flex flex-col gap-2">{list.map(card)}</ul> : <p className="px-3 text-sm text-muted">{o.teacher.noToday}</p>}
                </section>
              );
            })}
            {rows.length === 0 && <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{o.board.empty}</p>}
          </div>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ConnectCard o={o} linked={linked} />
        </aside>
      </div>

      {panel && (
        <>
          <Link href={link({})} scroll={false} aria-label={o.board.close} className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]" />
          <aside className="fixed inset-y-0 end-0 z-50 flex w-full flex-col overflow-y-auto border-s border-line bg-bg shadow-2xl sm:w-[30rem]" data-testid="session-panel">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-bg/95 p-5 backdrop-blur">
              <div>
                <h2 className="font-display text-xl font-extrabold">{panel.title}</h2>
                <p className="mt-1 text-sm text-muted">{panel.when}</p>
              </div>
              <Link href={link({})} scroll={false} aria-label={o.board.close} className="grid size-10 place-items-center rounded-full hover:bg-ink/5">
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
      {searchParams.then(({ s, w }) => (
        <TeacherPanel lang={lang} selected={typeof s === "string" ? s : null} week={typeof w === "string" ? w : null} />
      ))}
    </Suspense>
  );
}
