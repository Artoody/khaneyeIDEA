import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { ReviewForm } from "@/components/admin/review-form";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  return (
    <>
      <PageHeader title={a.review.new} back={{ href: href(lang, "/app/admin/reviews"), label: a.nav.reviews }} />
      <ReviewForm a={a} lang={lang} />
    </>
  );
}
