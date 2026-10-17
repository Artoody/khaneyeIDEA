import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, siteReviews } from "@khaneyeidea/db";
import { href, isLocale, pick } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { ReviewForm } from "@/components/admin/review-form";

export default async function Page({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const [row] = await getDb()
    .select()
    .from(siteReviews)
    .where(and(eq(siteReviews.id, id), eq(siteReviews.tenantId, user.tenantId)));
  if (!row) notFound();
  return (
    <>
      <PageHeader title={pick(row.authorName, lang)} back={{ href: href(lang, "/app/admin/reviews"), label: a.nav.reviews }} />
      <ReviewForm item={row} a={a} lang={lang} />
    </>
  );
}
