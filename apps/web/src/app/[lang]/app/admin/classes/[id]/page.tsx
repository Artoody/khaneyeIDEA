import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, notInArray } from "drizzle-orm";
import { z } from "zod";
import { classGroups, classSessions, enrollments, getDb, students } from "@khaneyeidea/db";
import { effectiveStatus } from "@khaneyeidea/core";
import { href, isLocale, num, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader } from "@/components/admin/ui";
import { ClassForm } from "@/components/admin/class-form";
import { classOptions } from "../options";
import { jalaliYears } from "../../booking/options";
import { enrollStudent, setEnrollment } from "../actions";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [c] = await db.select().from(classGroups).where(and(eq(classGroups.id, id), eq(classGroups.tenantId, user.tenantId)));
  if (!c) notFound();
  const [roster, upcoming, options] = await Promise.all([
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
      .limit(6),
    classOptions(user.tenantId, lang),
  ]);
  const enrolled = new Set(roster.map((r) => r.s.id));
  const pickable = (await db.select().from(students).where(eq(students.tenantId, user.tenantId)).orderBy(asc(students.firstName))).filter((s) => !enrolled.has(s.id));
  const active = roster.filter((r) => r.e.status === "active").length;
  const sessionsHref = href(lang, "/app/admin/sessions");
  return (
    <div className="grid max-w-6xl gap-8 xl:grid-cols-[1fr_22rem]">
      <div>
        <PageHeader title={c.title} back={{ href: href(lang, "/app/admin/classes"), label: o.nav.classes }} />
        <ClassForm c={c} a={a} o={o} lang={lang} years={jalaliYears()} options={options} />
      </div>
      <aside className="flex flex-col gap-6 xl:pt-[5.5rem]">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
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
          {pickable.length > 0 && (
            <form action={enrollStudent} className="mt-4 flex gap-2">
              <input type="hidden" name="classGroupId" value={c.id} />
              <select name="studentId" aria-label={o.classes.pickStudent} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm">
                {pickable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
              <button className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-bg">{o.classes.addStudent}</button>
            </form>
          )}
          <Link href={href(lang, "/app/admin/students/new")} className="mt-3 inline-block text-sm text-accent-text underline-offset-4 hover:underline">
            {o.students.new}
          </Link>
        </section>
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">{o.classes.upcoming}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {upcoming.map((s) => (
              <li key={s.id}>
                <Link href={`${sessionsHref}?s=${s.id}&w=${tehranIso(s.startsAt)}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition hover:bg-ink/5">
                  <span>
                    {dayLabel(tehranIso(s.startsAt), lang)} · {timeLabel(s.startsAt, lang)}
                  </span>
                  <span className="text-xs text-muted">{o.status[effectiveStatus(s)]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/classes/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
