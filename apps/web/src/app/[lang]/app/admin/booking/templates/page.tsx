import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Clock } from "@phosphor-icons/react/dist/ssr";
import { appointmentTypes, availabilityTemplates, branches, getDb } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { WEEKDAYS } from "@/lib/jalali";
import { fill } from "@/lib/format";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const t = a.booking;
  const rows = await getDb()
    .select({ tpl: availabilityTemplates, type: appointmentTypes.title, branch: branches.name })
    .from(availabilityTemplates)
    .innerJoin(appointmentTypes, eq(appointmentTypes.id, availabilityTemplates.appointmentTypeId))
    .leftJoin(branches, eq(branches.id, availabilityTemplates.branchId))
    .where(eq(availabilityTemplates.tenantId, user.tenantId))
    .orderBy(asc(availabilityTemplates.name));
  const base = href(lang, "/app/admin/booking/templates");
  const sep = lang === "fa" ? "، " : ", ";
  return (
    <>
      <PageHeader title={t.navTemplates} description={t.templatesHelp} action={{ href: `${base}/new`, label: t.newTemplate }} />
      {rows.length === 0 ? (
        <p className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{t.noTemplates}</p>
      ) : (
        <RowList>
          {rows.map(({ tpl, type, branch }) => {
            const perDay = Math.floor((toMin(tpl.endTime) - toMin(tpl.startTime)) / tpl.slotMinutes);
            return (
              <RowLink key={tpl.id} href={`${base}/${tpl.id}`}>
                <Clock weight="duotone" className="size-6 shrink-0 text-accent-text" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{tpl.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {[pick(type, lang), branch ? pick(branch, lang) : t.online, tpl.weekdays.map((d) => WEEKDAYS[lang][d]).join(sep), `${num(tpl.startTime.slice(0, 5), lang)}-${num(tpl.endTime.slice(0, 5), lang)}`].join(" · ")}
                  </span>
                </span>
                <span className="hidden text-sm text-muted sm:block">{fill(t.perWeek, { n: num(perDay * tpl.weekdays.length, lang) })}</span>
                <Badge tone={tpl.active ? "success" : "muted"}>{tpl.active ? a.common.active : a.common.inactive}</Badge>
              </RowLink>
            );
          })}
        </RowList>
      )}
    </>
  );
}

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

export default async function Page({ params }: PageProps<"/[lang]/app/admin/booking/templates">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} />
    </Suspense>
  );
}
