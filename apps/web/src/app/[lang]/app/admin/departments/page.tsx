import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { courses, departments, getDb } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const rows = await getDb()
    .select({ d: departments, n: count(courses.id) })
    .from(departments)
    .leftJoin(courses, eq(courses.departmentId, departments.id))
    .where(eq(departments.tenantId, user.tenantId))
    .groupBy(departments.id)
    .orderBy(asc(departments.sortOrder));
  const base = href(lang, "/app/admin/departments");
  return (
    <>
      <PageHeader title={a.nav.departments} action={{ href: `${base}/new`, label: a.department.new }} />
      {rows.length === 0 ? (
        <p className="text-muted">{a.common.empty}</p>
      ) : (
        <RowList>
          {rows.map(({ d, n }) => (
            <RowLink key={d.id} href={`${base}/${d.id}`}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{pick(d.title, lang)}</span>
                <span className="block truncate text-sm text-muted">{d.description ? pick(d.description, lang) : null}</span>
              </span>
              <span className="text-sm tabular-nums text-muted">
                {num(n, lang)} {a.department.courses}
              </span>
              <Badge tone={d.active ? "success" : "muted"}>{d.active ? a.common.active : a.common.inactive}</Badge>
            </RowLink>
          ))}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/departments">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} />
    </Suspense>
  );
}
