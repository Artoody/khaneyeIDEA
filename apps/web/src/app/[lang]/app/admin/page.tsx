import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import {
  CalendarCheck,
  CalendarDots,
  CheckCircle,
  Chalkboard,
  ClipboardText,
  Plus,
  Student,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { achievements, branches, classGroups, courses, getDb, messengerAccounts, students, teachers } from "@khaneyeidea/db";
import { can, effectiveStatus } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import { requireUser } from "@/server/auth";
import { loadDay, loadPendingRequests, loadUnanswered, loadUpcomingBookings } from "@/server/sessions";
import { ListSkeleton } from "@/components/admin/ui";
import { RequestsInbox } from "@/components/ops/requests-inbox";
import { ConnectCard } from "@/components/ops/connect-card";
import { STATUS_DOT } from "@/components/ops/panel-data";

const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

function Card({ title, aside, children, tone }: { title: string; aside?: React.ReactNode; children: React.ReactNode; tone?: "accent" }) {
  return (
    <section className={`rounded-[var(--radius-card)] border p-5 sm:p-6 ${tone === "accent" ? "border-accent/40 bg-accent/5" : "border-line bg-surface"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon: Icon, n, label, href: to, lang }: { icon: typeof Chalkboard; n: number; label: string; href: string; lang: Locale }) {
  return (
    <Link href={to} className="group flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/50 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent-text transition group-hover:bg-accent group-hover:text-on-accent">
        <Icon weight="duotone" className="size-6" />
      </span>
      <span>
        <span className="block font-display text-3xl font-black leading-none tabular-nums">{num(n, lang)}</span>
        <span className="mt-1 block text-sm text-muted">{label}</span>
      </span>
    </Link>
  );
}

async function Dashboard({ lang }: { lang: Locale }) {
  const user = await requireUser(lang);
  const ops = can(user, "schedule.manage");
  const cms = can(user, "content.edit");
  if (!ops && !cms) redirect(href(lang, "/app/no-access"));
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  const db = getDb();
  const tid = user.tenantId;
  const base = href(lang, "/app/admin");
  const today = tehranIso(new Date());
  const S = (n: number) => num(n, lang);

  const [day, waiting, requests, bookings, activeClasses, studentCount, linked] = ops
    ? await Promise.all([
        loadDay(tid, today),
        loadUnanswered(tid, 6),
        loadPendingRequests(tid),
        loadUpcomingBookings(tid, 5),
        one(db.select({ n: count() }).from(classGroups).where(and(eq(classGroups.tenantId, tid), eq(classGroups.active, true)))),
        one(db.select({ n: count() }).from(students).where(eq(students.tenantId, tid))),
        db.select({ channel: messengerAccounts.channel }).from(messengerAccounts).where(eq(messengerAccounts.userId, user.userId)),
      ])
    : [[], [], [], [], 0, 0, []];

  // Site content health (editors of the site content)
  const pub = and(eq(courses.tenantId, tid), eq(courses.status, "published"));
  const health = cms
    ? await Promise.all([
        one(db.select({ n: count() }).from(branches).where(and(eq(branches.tenantId, tid), eq(branches.active, true)))),
        one(db.select({ n: count() }).from(courses).where(pub)),
        one(db.select({ n: count() }).from(achievements).where(eq(achievements.tenantId, tid))),
        one(db.select({ n: count() }).from(courses).where(and(pub, isNull(courses.price)))),
        one(db.select({ n: count() }).from(courses).where(and(pub, or(isNull(courses.ageMin), isNull(courses.ageMax))))),
        one(db.select({ n: count() }).from(courses).where(and(pub, sql`jsonb_array_length(${courses.syllabus}) = 0`))),
        one(db.select({ n: count() }).from(teachers).where(and(eq(teachers.tenantId, tid), eq(teachers.isSample, true)))),
        one(db.select({ n: count() }).from(achievements).where(and(eq(achievements.tenantId, tid), sql`coalesce(${achievements.title}->>'en','') = ''`))),
      ])
    : null;
  const needs = health
    ? [
        { n: health[3], label: a.dashboard.coursesNoPrice, href: `${base}/courses?missing=price` },
        { n: health[4], label: a.dashboard.coursesNoAge, href: `${base}/courses?missing=age` },
        { n: health[5], label: a.dashboard.coursesNoSyllabus, href: `${base}/courses?missing=syllabus` },
        { n: health[6], label: a.dashboard.sampleTeachers, href: `${base}/teachers` },
        { n: health[7], label: a.dashboard.achievementsNoEn, href: `${base}/achievements?missing=en` },
      ].filter((x) => x.n > 0)
    : [];

  const firstName = user.fullName?.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{dayLabel(today, lang, { weekday: true, year: true })}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {o.dash.hello}
            {firstName && (
              <>
                ، <bdi>{firstName}</bdi>
              </>
            )}
          </h1>
          <p className="mt-1 text-muted">{o.dash.subtitle}</p>
        </div>
        {ops && (
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/classes/new`} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98]">
              <Plus weight="bold" className="size-4" />
              {o.dash.newClass}
            </Link>
            <Link href={`${base}/students/new`} className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-sm transition hover:border-ink/30 active:scale-[0.98]">
              <Plus weight="bold" className="size-4" />
              {o.dash.newStudent}
            </Link>
          </div>
        )}
      </header>

      {ops && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat lang={lang} icon={CalendarDots} n={day.length} label={o.dash.stats.today} href={`${base}/sessions`} />
            <Stat lang={lang} icon={ClipboardText} n={waiting.length} label={o.dash.stats.waiting} href={`${base}/sessions`} />
            <Stat lang={lang} icon={Chalkboard} n={activeClasses} label={o.dash.stats.classes} href={`${base}/classes`} />
            <Stat lang={lang} icon={Student} n={studentCount} label={o.dash.stats.students} href={`${base}/students`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-6">
              {requests.length > 0 && (
                <Card title={o.requests.title} tone="accent">
                  <RequestsInbox rows={requests} lang={lang} o={o} />
                </Card>
              )}
              <Card
                title={o.dash.today}
                aside={
                  <Link href={`${base}/sessions`} className="text-sm text-accent-text underline-offset-4 hover:underline">
                    {o.dash.openBoard}
                  </Link>
                }
              >
                {day.length === 0 ? (
                  <p className="text-sm text-muted">{o.dash.noToday}</p>
                ) : (
                  <ol className="flex flex-col gap-2" data-testid="today">
                    {day.map(({ s, c, teacher, branch }) => {
                      const st = effectiveStatus(s);
                      return (
                        <li key={s.id}>
                          <Link href={`${base}/sessions?s=${s.id}&w=${today}`} className="flex items-center gap-4 rounded-2xl border border-line bg-bg px-4 py-3 transition hover:border-accent/50">
                            <span className="w-14 shrink-0 font-display text-lg font-bold tabular-nums">{timeLabel(s.startsAt, lang)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{c.title}</span>
                              <span className="block truncate text-sm text-muted">{[teacher ? pick(teacher, lang) : o.classes.noTeacher, branch ? pick(branch, lang) : o.classes.online].join(" · ")}</span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
                              <span className={`size-2 rounded-full ${STATUS_DOT[st]}`} />
                              {o.status[st]}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>
            </div>

            <div className="flex flex-col gap-6">
              <Card title={o.dash.unanswered}>
                {waiting.length === 0 ? (
                  <p className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle weight="fill" className="size-5" />
                    {o.dash.noUnanswered}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {waiting.map(({ s, c, teacher }) => (
                      <li key={s.id}>
                        <Link href={`${base}/sessions?s=${s.id}&w=${tehranIso(s.startsAt)}`} className="block rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 transition hover:border-accent">
                          <span className="block text-sm font-medium">{c.title}</span>
                          <span className="block text-xs text-muted">
                            {dayLabel(tehranIso(s.startsAt), lang)} · {teacher ? pick(teacher, lang) : o.classes.noTeacher}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card
                title={o.dash.bookings}
                aside={
                  <Link href={`${base}/booking`} className="text-sm text-accent-text underline-offset-4 hover:underline">
                    {o.dash.viewAll}
                  </Link>
                }
              >
                {bookings.length === 0 ? (
                  <p className="text-sm text-muted">{o.dash.noBookings}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {bookings.map(({ a: b, type }) => (
                      <li key={b.id} className="flex items-center gap-3 rounded-xl bg-bg px-3.5 py-2.5 text-sm">
                        <CalendarCheck weight="duotone" className="size-5 shrink-0 text-accent-text" />
                        <span className="min-w-0 flex-1 truncate">{pick(type, lang)}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {dayLabel(tehranIso(b.startsAt), lang, { weekday: false })} · {timeLabel(b.startsAt, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <ConnectCard o={o} linked={linked.map((l) => l.channel as "bale" | "telegram")} />
            </div>
          </div>
        </>
      )}

      {health && (
        <section className="mt-12">
          <h2 className="font-display text-lg font-bold">{o.dash.content}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { n: health[0], label: a.dashboard.branches, href: `${base}/branches` },
              { n: health[1], label: a.dashboard.courses, href: `${base}/courses` },
              { n: health[2], label: a.dashboard.achievements, href: `${base}/achievements` },
            ].map((s) => (
              <Link key={s.label} href={s.href} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/50">
                <div className="font-display text-3xl font-black tabular-nums">{S(s.n)}</div>
                <div className="mt-1 text-sm text-muted">{s.label}</div>
              </Link>
            ))}
          </div>
          <h3 className="mt-8 font-display text-base font-bold">{a.dashboard.needs}</h3>
          {needs.length === 0 ? (
            <p className="mt-3 inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle weight="fill" className="size-5" />
              {a.dashboard.allGood}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {needs.map((x) => (
                <li key={x.label}>
                  <Link href={x.href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-ink/[0.03]">
                    <WarningCircle weight="fill" className="size-5 shrink-0 text-accent-text" />
                    <span className="font-display text-xl font-extrabold tabular-nums">{S(x.n)}</span>
                    <span className="text-muted">{x.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Dashboard lang={lang} />
    </Suspense>
  );
}
