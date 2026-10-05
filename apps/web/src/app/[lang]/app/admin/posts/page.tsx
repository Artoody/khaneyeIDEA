import { Suspense } from "react";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, posts } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { dayLabel, tehranIso } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const rows = await getDb().select().from(posts).where(eq(posts.tenantId, user.tenantId)).orderBy(desc(posts.publishedAt));
  const base = href(lang, "/app/admin/posts");
  return (
    <>
      <PageHeader title={a.nav.posts} description={a.post.help} action={{ href: `${base}/new`, label: a.post.new }} />
      {rows.length === 0 ? (
        <p className="text-muted">{a.common.empty}</p>
      ) : (
        <RowList>
          {rows.map((p) => (
            <RowLink key={p.id} href={`${base}/${p.id}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{pick(p.title, lang)}</span>
                <span className="block truncate text-sm text-muted">
                  {p.publishedAt ? dayLabel(tehranIso(p.publishedAt), lang, { weekday: false, year: true }) : "-"} · /blog/{p.slug}
                </span>
              </span>
              <Badge tone={p.status === "published" ? "success" : "muted"}>{p.status === "published" ? a.common.published : a.common.draft}</Badge>
            </RowLink>
          ))}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/posts">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} />
    </Suspense>
  );
}
