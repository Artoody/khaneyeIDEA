import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { teachers, getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { TeacherForm } from "@/components/admin/teacher-form";
import { getOpsDict } from "@/lib/ops-i18n";
import { deleteTeacher } from "../actions";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const [b] = await getDb().select().from(teachers).where(and(eq(teachers.id, id), eq(teachers.tenantId, user.tenantId)));
  if (!b) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={pick(b.name, lang)} back={{ href: href(lang, "/app/admin/teachers"), label: a.nav.teachers }} />
      <TeacherForm teacher={b} a={a} lang={lang} />
      <details className="mt-8 rounded-2xl border border-red-500/30 p-4" data-testid="delete-teacher">
        <summary className="cursor-pointer font-medium text-red-600">{o.cf.deleteTeacher}</summary>
        <p className="mt-2 text-sm text-muted">{o.cf.deleteTeacherHelp}</p>
        <form action={deleteTeacher} className="mt-3">
          <input type="hidden" name="id" value={b.id} />
          <input type="hidden" name="lang" value={lang} />
          <button className="h-10 rounded-full border border-red-500/40 px-5 text-sm font-medium text-red-600 hover:bg-red-500/10">{o.cf.deleteConfirm}</button>
        </form>
      </details>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/teachers/[id]">) {
  // `id` is request data here, so it is read inside the Suspense boundary.
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
