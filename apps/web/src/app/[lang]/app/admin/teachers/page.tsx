import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ChalkboardTeacher } from "@phosphor-icons/react/dist/ssr";
import { getDb, teachers } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const rows = await getDb().select().from(teachers).where(eq(teachers.tenantId, user.tenantId)).orderBy(asc(teachers.sortOrder));
  const base = href(lang, "/app/admin/teachers");
  return (
    <>
      <PageHeader title={a.nav.teachers} description={a.teacher.isSampleHelp} action={{ href: `${base}/new`, label: a.teacher.new }} />
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
