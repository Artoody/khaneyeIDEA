import { Suspense } from "react";
import { notFound } from "next/navigation";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { TypeForm } from "@/components/admin/type-form";

async function New({ lang }: { lang: Locale }) {
  await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  return (
    <div className="max-w-3xl">
      <PageHeader title={a.booking.newType} back={{ href: href(lang, "/app/admin/booking/types"), label: a.booking.navTypes }} />
      <TypeForm a={a} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/booking/types/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <New lang={lang} />
    </Suspense>
  );
}
