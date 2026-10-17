import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, partners } from "@khaneyeidea/db";
import { href, isLocale, pick } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { PartnerForm } from "@/components/admin/partner-form";

export default async function Page({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const [row] = await getDb()
    .select()
    .from(partners)
    .where(and(eq(partners.id, id), eq(partners.tenantId, user.tenantId)));
  if (!row) notFound();
  return (
    <>
      <PageHeader title={pick(row.name, lang)} back={{ href: href(lang, "/app/admin/partners"), label: a.nav.partners }} />
      <PartnerForm item={row} a={a} lang={lang} />
    </>
  );
}
