import { Suspense } from "react";
import { notFound } from "next/navigation";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { CourseForm } from "@/components/admin/course-form";
import { courseOptions } from "../options";

async function New({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const opts = await courseOptions(user.tenantId, lang);
  return (
    <div className="max-w-4xl">
      <PageHeader title={a.course.new} back={{ href: href(lang, "/app/admin/courses"), label: a.nav.courses }} />
      <CourseForm branchIds={[]} {...opts} a={a} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/courses/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <New lang={lang} />
    </Suspense>
  );
}
