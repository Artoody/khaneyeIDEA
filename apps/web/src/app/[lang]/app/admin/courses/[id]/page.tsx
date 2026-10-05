import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { courseBranches, courses, getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { CourseForm } from "@/components/admin/course-form";
import { courseOptions } from "../options";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [c] = await db.select().from(courses).where(and(eq(courses.id, id), eq(courses.tenantId, user.tenantId)));
  if (!c) notFound();
  const [links, opts] = await Promise.all([
    db.select({ id: courseBranches.branchId }).from(courseBranches).where(eq(courseBranches.courseId, id)),
    courseOptions(user.tenantId, lang),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={pick(c.title, lang)}
        description={c.legacyUrl ? `${a.course.legacy}: ${c.legacyUrl}` : undefined}
        back={{ href: href(lang, "/app/admin/courses"), label: a.nav.courses }}
      />
      <CourseForm course={c} branchIds={links.map((l) => l.id)} {...opts} a={a} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/courses/[id]">) {
  // `id` is request data here, so it is read inside the Suspense boundary.
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
