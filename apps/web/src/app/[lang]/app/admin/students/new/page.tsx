import { Suspense } from "react";
import { notFound } from "next/navigation";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { StudentForm } from "@/components/admin/student-form";

async function New({ lang }: { lang: Locale }) {
  await requirePermissionPage(lang, "students.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  return (
    <div className="max-w-4xl">
      <PageHeader title={o.students.new} description={o.students.help} back={{ href: href(lang, "/app/admin/students"), label: o.nav.students }} />
      <StudentForm guardians={[]} a={a} o={o} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/students/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <New lang={lang} />
    </Suspense>
  );
}
