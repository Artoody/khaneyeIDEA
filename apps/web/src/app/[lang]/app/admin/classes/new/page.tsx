import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { ClassForm } from "@/components/admin/class-form";
import { classOptions } from "../options";
import { jalaliYears } from "../../booking/options";

async function New({ lang, teacher, weekday }: { lang: Locale; teacher?: string; weekday?: string }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  const options = await classOptions(user.tenantId, lang);
  const wd = weekday !== undefined && /^[0-6]$/.test(weekday) ? Number(weekday) : undefined;
  const t = teacher && z.uuid().safeParse(teacher).success && options.teachers.some((x) => x.id === teacher) ? teacher : undefined;
  return (
    <div className="max-w-3xl">
      <PageHeader title={o.classes.new} description={o.classes.help} back={{ href: href(lang, "/app/admin/classes"), label: o.nav.classes }} />
      <ClassForm a={a} o={o} lang={lang} years={jalaliYears()} options={options} defaults={{ teacherId: t, weekday: wd }} />
    </div>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/classes/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      {searchParams.then((sp) => (
        <New lang={lang} teacher={typeof sp.teacher === "string" ? sp.teacher : undefined} weekday={typeof sp.weekday === "string" ? sp.weekday : undefined} />
      ))}
    </Suspense>
  );
}
