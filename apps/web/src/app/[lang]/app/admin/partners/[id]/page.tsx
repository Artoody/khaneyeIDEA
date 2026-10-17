import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, partners } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { PartnerForm } from "@/components/admin/partner-form";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
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

export default function Page({ params }: PageProps<"/[lang]/app/admin/partners/[id]">) {
  // `id` is request data here, so it is read inside the Suspense boundary.
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
