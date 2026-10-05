import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { departments, getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { DepartmentForm } from "@/components/admin/department-form";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const [b] = await getDb().select().from(departments).where(and(eq(departments.id, id), eq(departments.tenantId, user.tenantId)));
  if (!b) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={pick(b.title, lang)} back={{ href: href(lang, "/app/admin/departments"), label: a.nav.departments }} />
      <DepartmentForm dept={b} a={a} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/departments/[id]">) {
  // `id` is request data here, so it is read inside the Suspense boundary.
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
