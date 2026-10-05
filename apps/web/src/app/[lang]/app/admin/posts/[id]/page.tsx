import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, posts } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { PostForm } from "@/components/admin/post-form";
import { jalaliYears } from "../../booking/options";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const [p] = await getDb().select().from(posts).where(and(eq(posts.id, id), eq(posts.tenantId, user.tenantId)));
  if (!p) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={pick(p.title, lang)} back={{ href: href(lang, "/app/admin/posts"), label: a.nav.posts }} />
      {p.status === "published" && (
        <Link href={`/blog/${p.slug}`} target="_blank" className="-mt-5 mb-6 inline-block text-sm text-accent-text underline underline-offset-4">
          /blog/{p.slug}
        </Link>
      )}
      <PostForm post={p} a={a} lang={lang} years={jalaliYears()} />
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/posts/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
