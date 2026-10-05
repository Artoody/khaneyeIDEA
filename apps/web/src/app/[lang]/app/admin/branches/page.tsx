import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { MapPin } from "@phosphor-icons/react/dist/ssr";
import { branches, getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const rows = await getDb().select().from(branches).where(eq(branches.tenantId, user.tenantId)).orderBy(asc(branches.sortOrder));
  const base = href(lang, "/app/admin/branches");
  return (
    <>
      <PageHeader title={a.nav.branches} action={{ href: `${base}/new`, label: a.branch.new }} />
      {rows.length === 0 ? (
        <p className="text-muted">{a.common.empty}</p>
      ) : (
        <RowList>
          {rows.map((b) => (
            <RowLink key={b.id} href={`${base}/${b.id}`}>
              <MapPin weight="duotone" className="size-6 shrink-0 text-accent-text" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{pick(b.name, lang)}</span>
                <span className="block truncate text-sm text-muted">{pick(b.address, lang)}</span>
              </span>
              {b.appointmentOnly && <Badge tone="accent">{a.branch.appointmentOnly}</Badge>}
              <Badge tone={b.active ? "success" : "muted"}>{b.active ? a.common.active : a.common.inactive}</Badge>
            </RowLink>
          ))}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/branches">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} />
    </Suspense>
  );
}
