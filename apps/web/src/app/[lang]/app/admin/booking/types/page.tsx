import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { appointmentTypes, availabilityTemplates, getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListChecks } from "@phosphor-icons/react/dist/ssr";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const t = a.booking;
  const rows = await getDb()
    .select({ ty: appointmentTypes, n: count(availabilityTemplates.id) })
    .from(appointmentTypes)
    .leftJoin(availabilityTemplates, and(eq(availabilityTemplates.appointmentTypeId, appointmentTypes.id), eq(availabilityTemplates.active, true)))
    .where(eq(appointmentTypes.tenantId, user.tenantId))
    .groupBy(appointmentTypes.id)
    .orderBy(asc(appointmentTypes.sortOrder));
  const base = href(lang, "/app/admin/booking/types");
  return (
    <div className="max-w-3xl">
      <PageHeader title={t.navTypes} description={t.typesHelp} action={{ href: `${base}/new`, label: t.newType }} />
      <RowList>
        {rows.map(({ ty, n }) => (
          <RowLink key={ty.id} href={`${base}/${ty.id}`} icon={ListChecks}>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{pick(ty.title, lang)}</span>
              <span className="block truncate text-sm text-muted">{[t.kind[ty.kind], t.place[ty.place]].join(" · ")}</span>
            </span>
            {ty.active && n === 0 && <Badge tone="muted">{t.navTemplates}: 0</Badge>}
            <Badge tone={ty.active ? "success" : "muted"}>{ty.active ? a.common.active : a.common.inactive}</Badge>
          </RowLink>
        ))}
      </RowList>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/booking/types">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} />
    </Suspense>
  );
}
