import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { MagnifyingGlass, Trophy } from "@phosphor-icons/react/dist/ssr";
import { achievements, getDb } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

async function List({ lang, q, missingEn }: { lang: Locale; q: string; missingEn: boolean }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const t = a.achievement;
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await getDb()
    .select()
    .from(achievements)
    .where(
      and(
        eq(achievements.tenantId, user.tenantId),
        q ? or(sql`${achievements.title}->>'fa' ilike ${like}`, sql`${achievements.title}->>'en' ilike ${like}`, ilike(achievements.competition, like)) : undefined,
        missingEn ? sql`coalesce(${achievements.title}->>'en','') = ''` : undefined,
      ),
    )
    .orderBy(desc(achievements.featured), desc(achievements.year), achievements.sortOrder);
  const base = href(lang, "/app/admin/achievements");
  return (
    <>
      <PageHeader title={a.nav.achievements} action={{ href: `${base}/new`, label: t.new }} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form action={base} className="relative min-w-60 flex-1" role="search">
          {missingEn && <input type="hidden" name="missing" value="en" />}
          <MagnifyingGlass className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            aria-label={a.common.search}
            className="h-11 w-full rounded-full border border-line bg-surface ps-10 pe-4 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </form>
        {[
          { on: !missingEn, label: t.all, to: q ? `${base}?q=${encodeURIComponent(q)}` : base },
          { on: missingEn, label: t.noEnglish, to: `${base}?missing=en${q ? `&q=${encodeURIComponent(q)}` : ""}` },
        ].map((x) => (
          <Link
            key={x.label}
            href={x.to}
            aria-current={x.on ? "page" : undefined}
            className="shrink-0 rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg"
          >
            {x.label}
          </Link>
        ))}
      </div>
      <p className="mb-3 text-sm text-muted">
        {num(rows.length, lang)} {t.results}
      </p>
      {rows.length === 0 ? (
        <p className="text-muted">{a.common.empty}</p>
      ) : (
        <RowList>
          {rows.map((x) => (
            <RowLink key={x.id} href={`${base}/${x.id}`} icon={Trophy}>
              <span className="w-12 shrink-0 text-sm tabular-nums text-muted">{x.year ? num(String(x.year), lang) : "-"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{pick(x.title, lang)}</span>
                <span className="block truncate text-sm text-muted">{[x.competition, x.rank].filter(Boolean).join(" · ")}</span>
              </span>
              {x.featured && <Badge tone="accent">{t.featuredShort}</Badge>}
              {!x.title.en && <Badge tone="muted">{t.noEnglish}</Badge>}
            </RowLink>
          ))}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/achievements">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      {searchParams.then(({ q, missing }) => (
        <List lang={lang} q={typeof q === "string" ? q.trim().slice(0, 80) : ""} missingEn={missing === "en"} />
      ))}
    </Suspense>
  );
}
