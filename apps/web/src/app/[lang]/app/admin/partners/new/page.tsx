import { Suspense } from "react";
import { notFound } from "next/navigation";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { PartnerForm } from "@/components/admin/partner-form";

async function New({ lang }: { lang: Locale }) {
  await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  return (
    <>
      <PageHeader title={a.partner.new} back={{ href: href(lang, "/app/admin/partners"), label: a.nav.partners }} />
      <PartnerForm a={a} lang={lang} />
    </>
  );
}

export default function Page({ params }: PageProps<"/[lang]/app/admin/partners/new">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang }) => (isLocale(lang) ? <New lang={lang} /> : notFound()))}
    </Suspense>
  );
}
