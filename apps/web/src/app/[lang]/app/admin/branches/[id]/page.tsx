import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { branches, getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { BranchForm } from "@/components/admin/branch-form";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const [b] = await getDb().select().from(branches).where(and(eq(branches.id, id), eq(branches.tenantId, user.tenantId)));
  if (!b) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={pick(b.name, lang)} back={{ href: href(lang, "/app/admin/branches"), label: a.nav.branches }} />
      <BranchForm branch={b} a={a} lang={lang} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/branches/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Edit lang={lang} id={id} />
    </Suspense>
  );
}
