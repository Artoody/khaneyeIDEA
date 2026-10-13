import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { classGroups, enrollments, getDb, guardians, students, teachers, users } from "@khaneyeidea/db";
import { normalizeIranMobile } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { AutoSubmitCheckbox, AutoSubmitSelect } from "@/components/ops/auto-submit";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { ageFromJalaliYear } from "@/lib/age";
import { requirePermissionPage } from "@/server/auth";
import { byTeacherName } from "@/server/teachers-order";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang, q, cls, tch, free }: { lang: Locale; q: string; cls: string | null; tch: string | null; free: boolean }) {
  const user = await requirePermissionPage(lang, "students.manage");
  const o = getOpsDict(lang);
  const db = getDb();
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const phone = q ? normalizeIranMobile(q) : null;
  const byPhone = phone
    ? db.select({ id: guardians.studentId }).from(guardians).innerJoin(users, eq(users.id, guardians.userId)).where(eq(users.phone, phone))
    : null;
  const active = and(eq(enrollments.status, "active"));
  // narrow by class, by coach (any of their classes), or to students in no class at all
  const inClass = cls ? db.select({ id: enrollments.studentId }).from(enrollments).where(and(active, eq(enrollments.classGroupId, cls))) : null;
  const ofCoach = tch
    ? db.select({ id: enrollments.studentId }).from(enrollments).innerJoin(classGroups, eq(classGroups.id, enrollments.classGroupId)).where(and(active, eq(classGroups.teacherId, tch)))
    : null;
  const anyClass = free ? db.select({ id: enrollments.studentId }).from(enrollments).where(active) : null;
  const [classList, coachList] = await Promise.all([
    db.select({ id: classGroups.id, title: classGroups.title }).from(classGroups).where(eq(classGroups.tenantId, user.tenantId)).orderBy(asc(classGroups.weekday), asc(classGroups.startTime)),
    db.select().from(teachers).where(eq(teachers.tenantId, user.tenantId)).orderBy(byTeacherName),
  ]);
  const rows = await db
    .select()
    .from(students)
    .where(
      and(
        eq(students.tenantId, user.tenantId),
        inClass ? inArray(students.id, inClass) : undefined,
        ofCoach ? inArray(students.id, ofCoach) : undefined,
        anyClass ? notInArray(students.id, anyClass) : undefined,
        q ? or(ilike(sql`${students.firstName} || ' ' || ${students.lastName}`, like), byPhone ? inArray(students.id, byPhone) : undefined) : undefined,
      ),
    )
    .orderBy(asc(students.firstName))
    .limit(300);
  const ids = rows.map((r) => r.id);
  const classes = ids.length
    ? await db
        .select({ studentId: enrollments.studentId, title: classGroups.title, status: enrollments.status })
        .from(enrollments)
        .innerJoin(classGroups, eq(classGroups.id, enrollments.classGroupId))
        .where(and(inArray(enrollments.studentId, ids), inArray(enrollments.status, ["active", "waitlist"])))
    : [];
  const base = href(lang, "/app/admin/students");
  return (
    <>
      <PageHeader title={o.nav.students} description={o.students.help} action={{ href: `${base}/new`, label: o.students.new }} />
      <form action={base} role="search" className="mb-5 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder={o.students.search} aria-label={o.students.search} className="h-11 min-w-0 flex-1 basis-60 rounded-full border border-line bg-surface px-5 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15" />
        <AutoSubmitSelect name="t" defaultValue={tch ?? ""} aria-label={o.classes.teacher} className="h-11 rounded-full border border-line bg-surface px-3 text-sm">
          <option value="">{o.classes.teacher}: {o.board.all}</option>
          {coachList.map((t) => (
            <option key={t.id} value={t.id}>
              {pick(t.name, lang)}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="c" defaultValue={cls ?? ""} aria-label={o.nav.classes} className="h-11 max-w-56 rounded-full border border-line bg-surface px-3 text-sm">
          <option value="">{o.nav.classes}: {o.board.all}</option>
          {classList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </AutoSubmitSelect>
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm">
          <AutoSubmitCheckbox name="u" value="1" defaultChecked={free} className="size-4 accent-[var(--accent)]" />
          {o.students.noClasses}
        </label>
      </form>
      {rows.length === 0 ? (
        <p className="text-muted">{o.students.empty}</p>
      ) : (
        <RowList>
          {rows.map((s) => {
            const age = ageFromJalaliYear(s.birthYear);
            return (
              <RowLink key={s.id} href={`${base}/${s.id}`} initials={s.firstName.slice(0, 1)}>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {s.firstName} {s.lastName}
                    {age !== null && <span className="ms-2 text-sm font-normal text-muted">{fill(o.students.age, { n: num(age, lang) })}</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {classes
                      .filter((c) => c.studentId === s.id)
                      .map((c) => c.title + (c.status === "waitlist" ? ` (${o.classes.waitlist})` : ""))
                      .join("، ") || o.students.noClasses}
                  </span>
                </span>
                {classes.some((c) => c.studentId === s.id && c.status === "waitlist") && <Badge tone="accent">{o.classes.waitlist}</Badge>}
              </RowLink>
            );
          })}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/students">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      {searchParams.then(({ q, c, t, u }) => (
        <List
          lang={lang}
          q={typeof q === "string" ? q.trim().slice(0, 60) : ""}
          cls={typeof c === "string" && z.uuid().safeParse(c).success ? c : null}
          tch={typeof t === "string" && z.uuid().safeParse(t).success ? t : null}
          free={u === "1"}
        />
      ))}
    </Suspense>
  );
}
