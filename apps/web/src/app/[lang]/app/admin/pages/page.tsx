import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, pageBlocks } from "@khaneyeidea/db";
import { isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { PagesForm } from "@/components/admin/pages-form";

async function Edit({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const rows = await getDb().select().from(pageBlocks).where(eq(pageBlocks.tenantId, user.tenantId));
  return (
    <div className="max-w-4xl">
      <PageHeader title={a.nav.pages} description={a.pages.help} />
      <PagesForm blocks={Object.fromEntries(rows.map((r) => [r.key, r.value]))} a={a} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/pages">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Edit lang={lang} />
    </Suspense>
  );
}
