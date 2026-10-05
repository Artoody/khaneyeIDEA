import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, notInArray } from "drizzle-orm";
import { z } from "zod";
import { Clock, MapPin, Monitor, PencilSimple, UserCircle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { branches, chatLinks, classGroups, classSessions, courses, enrollments, getDb, rooms, students, teachers } from "@khaneyeidea/db";
import { effectiveStatus } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { ageFromJalaliYear } from "@/lib/age";
import { dayLabel, tehranIso, timeLabel, WEEKDAYS } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader } from "@/components/admin/ui";
import { ClassForm } from "@/components/admin/class-form";
import { RosterPicker } from "@/components/ops/roster-picker";
import { ClassGroups } from "@/components/ops/class-groups";
import { MakeupForm } from "@/components/ops/session-extras";
import { dayOptions, STATUS_DOT } from "@/components/ops/panel-data";
import { classOptions } from "../options";
import { jalaliYears } from "../../booking/options";
import { setEnrollment } from "../actions";

async function Edit({ lang, id, tab }: { lang: Locale; id: string; tab: "overview" | "edit" }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [c] = await db.select().from(classGroups).where(and(eq(classGroups.id, id), eq(classGroups.tenantId, user.tenantId)));
  if (!c) notFound();
  const [roster, upcoming, options, links, info, all] = await Promise.all([
    db
      .select({ e: enrollments, s: students })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .where(and(eq(enrollments.classGroupId, id), notInArray(enrollments.status, ["dropped", "finished"])))
      .orderBy(asc(enrollments.status), asc(students.firstName)),
    db
      .select()
      .from(classSessions)
      .where(and(eq(classSessions.classGroupId, id), gte(classSessions.endsAt, new Date())))
      .orderBy(asc(classSessions.startsAt))
      .limit(8),
    classOptions(user.tenantId, lang),
    db.select({ channel: chatLinks.channel }).from(chatLinks).where(eq(chatLinks.classGroupId, id)),
    db
      .select({ course: courses.title, teacher: teachers.name, branch: branches.name, room: rooms.name })
      .from(classGroups)
      .innerJoin(courses, eq(courses.id, classGroups.courseId))
      .leftJoin(teachers, eq(teachers.id, classGroups.teacherId))
      .leftJoin(branches, eq(branches.id, classGroups.branchId))
      .leftJoin(rooms, eq(rooms.id, classGroups.roomId))
      .where(eq(classGroups.id, id)),
    db.select().from(students).where(eq(students.tenantId, user.tenantId)).orderBy(asc(students.firstName)),
  ]);
  const i = info[0]!;
  const enrolled = new Set(roster.map((r) => r.s.id));
  const pickable = all
    .filter((s) => !enrolled.has(s.id))
    .map((s) => {
      const age = ageFromJalaliYear(s.birthYear);
      return { id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), age: age ? fill(o.students.age, { n: num(age, lang) }) : null };
    });
  const active = roster.filter((r) => r.e.status === "active").length;
  const sessionsHref = href(lang, "/app/admin/sessions");
  const base = href(lang, `/app/admin/classes/${id}`);
  const t = (s: string) => num(s.slice(0, 5), lang);
  const first = upcoming[0];
  const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

  const chip = (icon: React.ReactNode, text: string) => (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-sm">
      {icon}
      {text}
    </span>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={c.title} description={pick(i.course, lang)} back={{ href: href(lang, "/app/admin/classes"), label: o.nav.classes }} />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
        {chip(<Clock weight="duotone" className="size-4" />, `${WEEKDAYS[lang][c.weekday]} ${t(c.startTime)}-${t(c.endTime)}`)}
        {chip(<UserCircle weight="duotone" className="size-4" />, i.teacher ? pick(i.teacher, lang) : o.classes.noTeacher)}
        {chip(
          i.branch ? <MapPin weight="duotone" className="size-4" /> : <Monitor weight="duotone" className="size-4" />,
          i.branch ? `${pick(i.branch, lang)}${i.room ? ` / ${i.room}` : ""}` : o.classes.online,
        )}
        {chip(<UsersThree weight="duotone" className="size-4" />, fill(o.classes.seats, { n: num(active, lang), c: num(c.capacity, lang) }))}
        {!c.active && <Badge tone="muted">{a.common.inactive}</Badge>}
      </div>

      <nav className="mb-6 flex gap-2" aria-label="tabs">
        {(
          [
            ["overview", o.classes.overview],
            ["edit", o.classes.edit],
          ] as const
        ).map(([k, label]) => (
          <Link
            key={k}
            href={k === "overview" ? base : `${base}?tab=edit`}
            aria-current={tab === k ? "page" : undefined}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-5 text-sm text-muted transition hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg"
          >
            {k === "edit" && <PencilSimple className="size-4" />}
            {label}
          </Link>
        ))}
      </nav>

      {tab === "edit" ? (
        <div className="max-w-3xl">
          <ClassForm c={c} a={a} o={o} lang={lang} years={jalaliYears()} options={options} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
              <h2 className="flex items-center justify-between font-display text-lg font-bold">
                {o.classes.students}
                <span className="text-sm font-normal text-muted">{fill(o.classes.seats, { n: num(active, lang), c: num(c.capacity, lang) })}</span>
              </h2>
              {roster.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{o.classes.noStudents}</p>
              ) : (
                <ul className="mt-3 divide-y divide-line" data-testid="roster">
                  {roster.map(({ e, s }) => (
                    <li key={e.id} className="flex items-center gap-2 py-2.5">
                      <Link href={href(lang, `/app/admin/students/${s.id}`)} className="min-w-0 flex-1 truncate hover:text-accent-text">
                        {s.firstName} {s.lastName}
                      </Link>
                      {e.status === "waitlist" && <Badge tone="accent">{o.classes.waitlist}</Badge>}
                      <form action={setEnrollment}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="status" value="dropped" />
                        <button className="rounded-full px-2.5 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-500">{o.classes.remove}</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <RosterPicker classGroupId={c.id} students={pickable} seatsLeft={c.capacity - active} o={o} />
              <Link href={href(lang, "/app/admin/students/new")} className="mt-3 inline-block text-sm text-accent-text underline-offset-4 hover:underline">
                {o.students.new}
              </Link>
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <ClassGroups
              o={o}
              classGroupId={c.id}
              linked={links.map((l) => l.channel as "bale" | "telegram")}
              invites={{ bale: c.baleInviteUrl, telegram: c.telegramInviteUrl }}
              onlineUrl={c.onlineUrl}
            />
            <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold">{o.classes.sessionsTitle}</h2>
              <p className="mt-1.5 text-sm text-muted">{o.classes.sessionsHelp}</p>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{o.board.empty}</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5" data-testid="class-sessions">
                  {upcoming.map((s) => {
                    const st = effectiveStatus(s);
                    return (
                      <li key={s.id}>
                        <Link href={`${sessionsHref}?s=${s.id}&w=${tehranIso(s.startsAt)}`} className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm transition hover:bg-ink/5">
                          <span className="flex items-center gap-2">
                            <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[st]}`} />
                            {dayLabel(tehranIso(s.startsAt), lang)} · {timeLabel(s.startsAt, lang)}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted">
                            {s.makeupOfSessionId || (s.custom && !s.originalStartsAt) ? o.move.makeupOf : s.custom ? o.move.moved_tag : ""}
                            {o.status[st]}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-4">
                <MakeupForm o={o} days={dayOptions(lang)} from={first ? hhmm(first.startsAt) : c.startTime.slice(0, 5)} to={first ? hhmm(first.endsAt) : c.endTime.slice(0, 5)} classGroupId={c.id} />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/classes/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {Promise.all([params, searchParams]).then(([{ lang, id }, sp]) =>
        isLocale(lang) ? <Edit lang={lang} id={id} tab={sp.tab === "edit" ? "edit" : "overview"} /> : notFound(),
      )}
    </Suspense>
  );
}
