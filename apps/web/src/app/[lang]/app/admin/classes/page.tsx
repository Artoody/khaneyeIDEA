import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { Chalkboard } from "@phosphor-icons/react/dist/ssr";
import { branches, classGroups, courses, enrollments, getDb, teachers } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { WEEKDAYS } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  const db = getDb();
  const rows = await db
    .select({ c: classGroups, course: courses.title, teacher: teachers.name, branch: branches.name, n: count(enrollments.id) })
    .from(classGroups)
    .innerJoin(courses, eq(courses.id, classGroups.courseId))
    .leftJoin(teachers, eq(teachers.id, classGroups.teacherId))
    .leftJoin(branches, eq(branches.id, classGroups.branchId))
    .leftJoin(enrollments, and(eq(enrollments.classGroupId, classGroups.id), eq(enrollments.status, "active")))
    .where(eq(classGroups.tenantId, user.tenantId))
    .groupBy(classGroups.id, courses.title, teachers.name, branches.name)
    .orderBy(asc(classGroups.weekday), asc(classGroups.startTime));
  const base = href(lang, "/app/admin/classes");
  const t = (s: string) => num(s.slice(0, 5), lang);
  return (
    <>
      <PageHeader title={o.nav.classes} description={o.classes.help} action={{ href: `${base}/new`, label: o.classes.new }} />
      {rows.length === 0 ? (
        <p className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{o.classes.empty}</p>
      ) : (
        <RowList>
          {rows.map(({ c, course, teacher, branch, n }) => (
            <RowLink key={c.id} href={`${base}/${c.id}`}>
              <Chalkboard weight="duotone" className="size-6 shrink-0 text-accent-text" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{c.title}</span>
                <span className="block truncate text-sm text-muted">
                  {[pick(course, lang), teacher ? pick(teacher, lang) : o.classes.noTeacher, branch ? pick(branch, lang) : o.classes.online].join(" · ")}
                </span>
              </span>
              <span className="hidden text-sm tabular-nums text-muted sm:block">
                {WEEKDAYS[lang][c.weekday]} {t(c.startTime)}-{t(c.endTime)}
              </span>
              <Badge tone={n >= c.capacity ? "accent" : "neutral"}>{fill(o.classes.seats, { n: num(n, lang), c: num(c.capacity, lang) })}</Badge>
              {!c.active && <Badge tone="muted">{a.common.inactive}</Badge>}
            </RowLink>
          ))}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/classes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} />
    </Suspense>
  );
}
