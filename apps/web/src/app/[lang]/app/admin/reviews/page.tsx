import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { CaretLeft, ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { getDb, siteReviews } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader } from "@/components/admin/ui";
import { setReviewStatus } from "./actions";

async function List({ lang, status }: { lang: Locale; status: string }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const t = a.review;
  const rows = await getDb()
    .select()
    .from(siteReviews)
    .where(
      and(
        eq(siteReviews.tenantId, user.tenantId),
        status && status !== "all" ? eq(siteReviews.status, status as "pending" | "published" | "rejected") : undefined,
      ),
    )
    .orderBy(desc(siteReviews.createdAt));
  const base = href(lang, "/app/admin/reviews");
  const filters = [
    { key: "all", label: a.course.all },
    { key: "pending", label: t.pending },
    { key: "published", label: t.published },
    { key: "rejected", label: t.rejected },
  ];
  return (
    <>
      <PageHeader title={a.nav.reviews} action={{ href: `${base}/new`, label: t.new }} />
      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((x) => {
          const on = (status || "all") === x.key;
          return (
            <Link
              key={x.key}
              href={x.key === "all" ? base : `${base}?status=${x.key}`}
              aria-current={on ? "page" : undefined}
              className="shrink-0 rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg"
            >
              {x.label}
            </Link>
          );
        })}
      </div>
      <p className="mb-3 text-sm text-muted">{num(rows.length, lang)}</p>
      {rows.length === 0 ? (
        <p className="text-muted">{a.common.empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((x) => (
            <li key={x.id}>
              <Link href={`${base}/${x.id}`} className="group flex min-h-[4.5rem] items-center gap-4 px-4 py-3 transition hover:bg-ink/[0.03] sm:px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text transition group-hover:bg-accent group-hover:text-on-accent">
                  <ChatCircleDots weight="duotone" className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{pick(x.authorName, lang)}</span>
                  <span className="block truncate text-sm text-muted">{pick(x.body, lang)}</span>
                </span>
                <Badge tone={x.status === "published" ? "accent" : "muted"}>
                  {x.status === "published" ? t.published : x.status === "rejected" ? t.rejected : t.pending}
                </Badge>
                <CaretLeft className="size-4 shrink-0 text-muted/60 transition group-hover:-translate-x-0.5 group-hover:text-ink ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
              </Link>
              {x.status === "pending" && (
                <div className="flex gap-2 px-4 pb-3 sm:px-5">
                  <form action={setReviewStatus}>
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="status" value="published" />
                    <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent">
                      {t.approve}
                    </button>
                  </form>
                  <form action={setReviewStatus}>
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
                      {t.reject}
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { status = "all" } = await searchParams;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <List lang={lang} status={status} />
    </Suspense>
  );
}
