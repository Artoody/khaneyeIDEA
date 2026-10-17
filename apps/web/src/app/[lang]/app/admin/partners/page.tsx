import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Handshake } from "@phosphor-icons/react/dist/ssr";
import { getDb, partners } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const rows = await getDb()
    .select()
    .from(partners)
    .where(eq(partners.tenantId, user.tenantId))
    .orderBy(asc(partners.sortOrder));
  const base = href(lang, "/app/admin/partners");
  return (
    <>
      <PageHeader title={a.nav.partners} action={{ href: `${base}/new`, label: a.partner.new }} />
      <p className="mb-3 text-sm text-muted">{num(rows.length, lang)}</p>
      {rows.length === 0 ? (
        <p className="text-muted">{a.common.empty}</p>
      ) : (
        <RowList>
          {rows.map((x) => (
            <RowLink key={x.id} href={`${base}/${x.id}`} icon={Handshake}>
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink/5">
                <img src={x.logoUrl} alt="" className="max-h-8 max-w-8 object-contain" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{pick(x.name, lang)}</span>
              {!x.active && <Badge tone="muted">{a.common.inactive}</Badge>}
            </RowLink>
          ))}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} />
    </Suspense>
  );
}
