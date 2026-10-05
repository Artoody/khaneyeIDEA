import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { CalendarCheck, Monitor } from "@phosphor-icons/react/dist/ssr";
import { appointmentTypes, attendance, branches, classGroups, classSessions, enrollments, getDb, guardians, homework, messengerAccounts, sessionReports, students, teachers } from "@khaneyeidea/db";
import { upcomingFor } from "@khaneyeidea/core";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { dayLabel, tehranIso, timeLabel, WEEKDAYS } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { PanelShell, PanelSkeleton } from "@/components/panel/panel-shell";
import { ConnectCard } from "@/components/ops/connect-card";

// A parent sees only their own children: their classes, the next session, class reports and homework,
// and their own child's attendance (never other children's).

async function ParentPanel({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "children.view_own");
  const o = getOpsDict(lang);
  const db = getDb();
  const now = new Date();
  const kids = await db
    .select({ s: students })
    .from(guardians)
    .innerJoin(students, eq(students.id, guardians.studentId))
    .where(and(eq(guardians.userId, user.userId), eq(students.tenantId, user.tenantId)))
    .orderBy(asc(students.firstName));
  const kidIds = kids.map((k) => k.s.id);
  const classes = kidIds.length
    ? await db
        .select({ e: enrollments, c: classGroups, teacher: teachers.name, branch: branches.name })
        .from(enrollments)
        .innerJoin(classGroups, eq(classGroups.id, enrollments.classGroupId))
        .leftJoin(teachers, eq(teachers.id, classGroups.teacherId))
        .leftJoin(branches, eq(branches.id, classGroups.branchId))
        .where(and(inArray(enrollments.studentId, kidIds), eq(enrollments.status, "active")))
    : [];
  const classIds = [...new Set(classes.map((x) => x.c.id))];
  const linked = (await db.select({ channel: messengerAccounts.channel }).from(messengerAccounts).where(eq(messengerAccounts.userId, user.userId))).map((l) => l.channel as "bale" | "telegram");
  const [upcoming, recent, bookings] = await Promise.all([
    classIds.length
      ? db.select().from(classSessions).where(and(inArray(classSessions.classGroupId, classIds), gte(classSessions.startsAt, now))).orderBy(asc(classSessions.startsAt)).limit(40)
      : [],
    classIds.length
      ? db
          .select({ s: classSessions, report: sessionReports.summary, hw: homework.text })
          .from(classSessions)
          .leftJoin(sessionReports, eq(sessionReports.sessionId, classSessions.id))
          .leftJoin(homework, eq(homework.sessionId, classSessions.id))
          .where(and(inArray(classSessions.classGroupId, classIds), lt(classSessions.startsAt, now), inArray(classSessions.status, ["held", "held_incomplete"])))
          .orderBy(desc(classSessions.startsAt))
          .limit(12)
      : [],
    upcomingFor(db, user.tenantId, user.phone, now),
  ]);
  const marks = recent.length && kidIds.length
    ? await db.select().from(attendance).where(and(inArray(attendance.sessionId, recent.map((r) => r.s.id)), inArray(attendance.studentId, kidIds)))
    : [];
  const types = bookings.length ? await db.select().from(appointmentTypes).where(inArray(appointmentTypes.id, bookings.map((b) => b.appointmentTypeId))) : [];
  const t = (s: string) => s.slice(0, 5);

  return (
    <PanelShell lang={lang} user={user} title={o.parent.title}>
      {kids.length === 0 ? (
        <p className="mt-8 max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{o.parent.noChildren}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {kids.map(({ s: kid }) => {
            const mine = classes.filter((x) => x.e.studentId === kid.id);
            const myClassIds = new Set(mine.map((x) => x.c.id));
            const reports = recent.filter((r) => myClassIds.has(r.s.classGroupId)).slice(0, 4);
            return (
              <section key={kid.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-7" data-testid="child">
                <h1 className="font-display text-2xl font-extrabold">{kid.firstName}</h1>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {mine.map(({ c, teacher, branch }) => {
                    const next = upcoming.find((u) => u.classGroupId === c.id);
                    return (
                      <article key={c.id} className="rounded-2xl border border-line bg-bg p-4">
                        <h2 className="font-semibold">{c.title}</h2>
                        <p className="mt-1 text-sm text-muted">
                          {WEEKDAYS[lang][c.weekday]} {t(c.startTime)}-{t(c.endTime)} · {branch ? pick(branch, lang) : o.classes.online}
                          {teacher && ` · ${pick(teacher, lang)}`}
                        </p>
                        {next && (
                          <p className={`mt-3 text-sm ${next.status === "cancel_planned" ? "text-red-600" : ""}`}>
                            {o.parent.next}: {dayLabel(tehranIso(next.startsAt), lang)} {timeLabel(next.startsAt, lang)}
                            {next.status === "cancel_planned" && ` (${o.status.cancel_planned})`}
                          </p>
                        )}
                        {c.onlineUrl && (
                          <a href={c.onlineUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text">
                            <Monitor className="size-4" />
                            {o.classes.onlineUrl}
                          </a>
                        )}
                      </article>
                    );
                  })}
                </div>
                <h2 className="mt-7 font-display text-lg font-bold">{o.parent.reports}</h2>
                {reports.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">{o.parent.noReports}</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {reports.map((r) => {
                      const mark = marks.find((m) => m.sessionId === r.s.id && m.studentId === kid.id);
                      return (
                        <li key={r.s.id} className="rounded-2xl border border-line bg-bg p-4 text-sm">
                          <p className="flex flex-wrap items-center justify-between gap-2 text-muted">
                            <span>
                              {dayLabel(tehranIso(r.s.startsAt), lang)} · {mine.find((x) => x.c.id === r.s.classGroupId)?.c.title}
                            </span>
                            {mark && (
                              <span className={mark.status === "absent" ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}>
                                {o.parent.attended}: {o.session[mark.status]}
                              </span>
                            )}
                          </p>
                          {r.report && <p className="mt-2 whitespace-pre-line leading-relaxed">{r.report}</p>}
                          {r.hw && (
                            <p className="mt-2 rounded-xl bg-accent/10 p-3 leading-relaxed">
                              <b>{o.parent.homework}: </b>
                              {r.hw}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <CalendarCheck weight="duotone" className="size-5 text-accent-text" />
          {o.parent.bookings}
        </h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {o.parent.noBookings}{" "}
            <Link href={href(lang, "/book")} className="text-accent-text underline underline-offset-4">
              {o.parent.book}
            </Link>
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
                <b>{pick(types.find((x) => x.id === b.appointmentTypeId)?.title, lang)}</b> · {dayLabel(tehranIso(b.startsAt), lang)} {timeLabel(b.startsAt, lang)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 max-w-xl">
        <ConnectCard o={o} linked={linked} />
      </div>
    </PanelShell>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/parent">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <ParentPanel lang={lang} />
    </Suspense>
  );
}
