import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { classGroups, enrollments, getDb, guardians, students, users } from "@khaneyeidea/db";
import { normalizeIranMobile } from "@khaneyeidea/core";
import { href, isLocale, num, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { ageFromJalaliYear } from "@/lib/age";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang, q }: { lang: Locale; q: string }) {
  const user = await requirePermissionPage(lang, "students.manage");
  const o = getOpsDict(lang);
  const db = getDb();
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const phone = q ? normalizeIranMobile(q) : null;
  const byPhone = phone
    ? db.select({ id: guardians.studentId }).from(guardians).innerJoin(users, eq(users.id, guardians.userId)).where(eq(users.phone, phone))
    : null;
  const rows = await db
    .select()
    .from(students)
    .where(
      and(
        eq(students.tenantId, user.tenantId),
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
      <form action={base} role="search" className="mb-5 max-w-md">
        <input name="q" defaultValue={q} placeholder={o.students.search} aria-label={o.students.search} className="h-11 w-full rounded-full border border-line bg-surface px-5 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15" />
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
      {searchParams.then(({ q }) => (
        <List lang={lang} q={typeof q === "string" ? q.trim().slice(0, 60) : ""} />
      ))}
    </Suspense>
  );
}
