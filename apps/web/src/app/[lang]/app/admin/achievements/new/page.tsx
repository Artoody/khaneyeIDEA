import { Suspense } from "react";
import { notFound } from "next/navigation";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { AchievementForm } from "@/components/admin/achievement-form";

async function New({ lang }: { lang: Locale }) {
  await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  return (
    <div className="max-w-4xl">
      <PageHeader title={a.achievement.new} back={{ href: href(lang, "/app/admin/achievements"), label: a.nav.achievements }} />
      <AchievementForm a={a} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/achievements/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <New lang={lang} />
    </Suspense>
  );
}
