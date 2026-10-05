import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, siteSettings } from "@khaneyeidea/db";
import { isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";

async function Settings({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const [s] = await getDb().select().from(siteSettings).where(eq(siteSettings.tenantId, user.tenantId));
  if (!s) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={a.nav.settings} />
      <SettingsForm s={s} a={a} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/settings">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Settings lang={lang} />
    </Suspense>
  );
}
