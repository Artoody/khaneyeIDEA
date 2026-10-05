import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { achievements, getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { AchievementForm } from "@/components/admin/achievement-form";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const [b] = await getDb().select().from(achievements).where(and(eq(achievements.id, id), eq(achievements.tenantId, user.tenantId)));
  if (!b) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={pick(b.title, lang)} back={{ href: href(lang, "/app/admin/achievements"), label: a.nav.achievements }} />
      <AchievementForm item={b} a={a} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/achievements/[id]">) {
  // `id` is request data here, so it is read inside the Suspense boundary.
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
