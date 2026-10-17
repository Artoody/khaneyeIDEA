import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { PartnerForm } from "@/components/admin/partner-form";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  return (
    <>
      <PageHeader title={a.partner.new} back={{ href: href(lang, "/app/admin/partners"), label: a.nav.partners }} />
      <PartnerForm a={a} lang={lang} />
    </>
  );
}
