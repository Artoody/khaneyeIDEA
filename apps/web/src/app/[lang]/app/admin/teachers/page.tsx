import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, count, countDistinct, eq } from "drizzle-orm";
import Link from "next/link";
import { ChalkboardTeacher } from "@phosphor-icons/react/dist/ssr";
import { classGroups, enrollments, getDb, teachers } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  const db = getDb();
  const rows = await db.select().from(teachers).where(eq(teachers.tenantId, user.tenantId)).orderBy(asc(teachers.sortOrder), asc(teachers.createdAt));
  // what each coach teaches: classes and (active) students
  const load = await db
    .select({ teacherId: classGroups.teacherId, classes: count(classGroups.id), students: countDistinct(enrollments.studentId) })
    .from(classGroups)
    .leftJoin(enrollments, and(eq(enrollments.classGroupId, classGroups.id), eq(enrollments.status, "active")))
    .where(and(eq(classGroups.tenantId, user.tenantId), eq(classGroups.active, true)))
    .groupBy(classGroups.teacherId);
  const per = new Map(load.map((l) => [l.teacherId, l]));
  const classesBase = href(lang, "/app/admin/classes");
  const base = href(lang, "/app/admin/teachers");
  return (
    <>
      <PageHeader title={a.nav.teachers} description={a.teacher.isSampleHelp} action={{ href: `${base}/new`, label: a.teacher.new }} />
      <Link href={`${classesBase}?v=teacher`} className="-mt-3 mb-5 inline-flex h-10 items-center rounded-full border border-line px-4 text-sm hover:border-ink/30">
        {o.nav.classes}: {o.cb.views.teacher}
      </Link>
      {rows.length === 0 ? (
        <p className="text-muted">{a.common.empty}</p>
      ) : (
        <RowList>
          {rows.map((x) => (
            <RowLink key={x.id} href={`${base}/${x.id}`} icon={ChalkboardTeacher}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{pick(x.name, lang)}</span>
                <span className="block truncate text-sm text-muted">{x.role ? pick(x.role, lang) : null}</span>
              </span>
              <span className="hidden text-end text-sm text-muted sm:block">
                {fill(o.cb.classesCount, { n: num(per.get(x.id)?.classes ?? 0, lang) })}
                <br />
                {fill(o.cb.studentsCount, { n: num(per.get(x.id)?.students ?? 0, lang) })}
              </span>
              {x.isSample && <Badge tone="accent">{a.common.sample}</Badge>}
              {!x.showOnSite && <Badge tone="muted">{a.teacher.hidden}</Badge>}
            </RowLink>
          ))}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/teachers">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} />
    </Suspense>
  );
}
