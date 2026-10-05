import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { appointmentTypes, getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { TypeForm } from "@/components/admin/type-form";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const [item] = await getDb().select().from(appointmentTypes).where(and(eq(appointmentTypes.id, id), eq(appointmentTypes.tenantId, user.tenantId)));
  if (!item) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={pick(item.title, lang)} back={{ href: href(lang, "/app/admin/booking/types"), label: a.booking.navTypes }} />
      <TypeForm item={item} a={a} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/booking/types/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
