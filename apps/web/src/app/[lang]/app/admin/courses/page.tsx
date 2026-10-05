import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { courses, departments, getDb } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { Badge, ListSkeleton, PageHeader, RowLink, RowList } from "@/components/admin/ui";

const FILTERS = ["price", "age", "syllabus"] as const;
type Missing = (typeof FILTERS)[number];

async function List({ lang, missing }: { lang: Locale; missing: Missing | null }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const t = a.course;
  const cond: Record<Missing, SQL | undefined> = {
    price: and(eq(courses.status, "published"), isNull(courses.price)),
    age: and(eq(courses.status, "published"), or(isNull(courses.ageMin), isNull(courses.ageMax))),
    syllabus: and(eq(courses.status, "published"), sql`jsonb_array_length(${courses.syllabus}) = 0`),
  };
  const rows = await getDb()
    .select({ c: courses, dep: departments.title })
    .from(courses)
    .leftJoin(departments, eq(departments.id, courses.departmentId))
    .where(and(eq(courses.tenantId, user.tenantId), missing ? cond[missing] : undefined))
    .orderBy(asc(departments.sortOrder), asc(courses.sortOrder));
  const base = href(lang, "/app/admin/courses");
  const tabs: { key: Missing | null; label: string }[] = [
    { key: null, label: t.all },
    { key: "price", label: t.missingPrice },
    { key: "age", label: t.missingAge },
    { key: "syllabus", label: t.missingSyllabus },
  ];
  return (
    <>
      <PageHeader title={a.nav.courses} action={{ href: `${base}/new`, label: t.new }} />
      <nav className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label={t.all}>
        {tabs.map((x) => (
          <Link
            key={x.label}
            href={x.key ? `${base}?missing=${x.key}` : base}
            aria-current={x.key === missing ? "page" : undefined}
            className="shrink-0 rounded-full border border-line px-4 py-1.5 text-sm text-muted transition hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg"
          >
            {x.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="text-muted">{a.common.empty}</p>
      ) : (
        <RowList>
          {rows.map(({ c, dep }) => (
            <RowLink key={c.id} href={`${base}/${c.id}`} icon={GraduationCap}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{pick(c.title, lang)}</span>
                <span className="block truncate text-sm text-muted">
                  {[dep ? pick(dep, lang) : null, c.ageMin != null && c.ageMax != null ? `${num(c.ageMin, lang)}–${num(c.ageMax, lang)} ${t.ages}` : null, c.modes.map((m) => t[m]).join("، ")]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <Badge tone={c.status === "published" ? "success" : "muted"}>{c.status === "published" ? a.common.published : a.common.draft}</Badge>
            </RowLink>
          ))}
        </RowList>
      )}
    </>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/courses">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      {searchParams.then(({ missing }) => (
        <List lang={lang} missing={FILTERS.find((f) => f === missing) ?? null} />
      ))}
    </Suspense>
  );
}
