import { Suspense } from "react";
import { notFound } from "next/navigation";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { TemplateForm } from "@/components/admin/template-form";
import { jalaliYears, templateOptions } from "../../options";

async function New({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const options = await templateOptions(user.tenantId, lang);
  return (
    <div className="max-w-4xl">
      <PageHeader title={a.booking.newTemplate} description={a.booking.templatesHelp} back={{ href: href(lang, "/app/admin/booking/templates"), label: a.booking.navTemplates }} />
      <TemplateForm options={options} a={a} lang={lang} years={jalaliYears()} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/booking/templates/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <New lang={lang} />
    </Suspense>
  );
}
