import { Suspense } from "react";
import { notFound } from "next/navigation";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { ClassForm } from "@/components/admin/class-form";
import { classOptions } from "../options";
import { jalaliYears } from "../../booking/options";

async function New({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  return (
    <div className="max-w-4xl">
      <PageHeader title={o.classes.new} description={o.classes.help} back={{ href: href(lang, "/app/admin/classes"), label: o.nav.classes }} />
      <ClassForm a={a} o={o} lang={lang} years={jalaliYears()} options={await classOptions(user.tenantId, lang)} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/classes/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <New lang={lang} />
    </Suspense>
  );
}
