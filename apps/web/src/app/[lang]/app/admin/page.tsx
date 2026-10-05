import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { achievements, branches, courses, getDb, teachers } from "@khaneyeidea/db";
import { href, isLocale, num, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";

async function Dashboard({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "content.edit");
  const a = getAdminDict(lang);
  const db = getDb();
  const tid = user.tenantId;
  const pub = and(eq(courses.tenantId, tid), eq(courses.status, "published"));
  const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

  const [activeBranches, publishedCourses, allAchievements, noPrice, noAge, noSyllabus, samples, noEn] = await Promise.all([
    one(db.select({ n: count() }).from(branches).where(and(eq(branches.tenantId, tid), eq(branches.active, true)))),
    one(db.select({ n: count() }).from(courses).where(pub)),
    one(db.select({ n: count() }).from(achievements).where(eq(achievements.tenantId, tid))),
    one(db.select({ n: count() }).from(courses).where(and(pub, isNull(courses.price)))),
    one(db.select({ n: count() }).from(courses).where(and(pub, or(isNull(courses.ageMin), isNull(courses.ageMax))))),
    one(db.select({ n: count() }).from(courses).where(and(pub, sql`jsonb_array_length(${courses.syllabus}) = 0`))),
    one(db.select({ n: count() }).from(teachers).where(and(eq(teachers.tenantId, tid), eq(teachers.isSample, true)))),
    one(db.select({ n: count() }).from(achievements).where(and(eq(achievements.tenantId, tid), sql`coalesce(${achievements.title}->>'en','') = ''`))),
  ]);

  const base = href(lang, "/app/admin");
  const stats = [
    { n: activeBranches, label: a.dashboard.branches, href: `${base}/branches` },
    { n: publishedCourses, label: a.dashboard.courses, href: `${base}/courses` },
    { n: allAchievements, label: a.dashboard.achievements, href: `${base}/achievements` },
  ];
  const needs = [
    { n: noPrice, label: a.dashboard.coursesNoPrice, href: `${base}/courses?missing=price` },
    { n: noAge, label: a.dashboard.coursesNoAge, href: `${base}/courses?missing=age` },
    { n: noSyllabus, label: a.dashboard.coursesNoSyllabus, href: `${base}/courses?missing=syllabus` },
    { n: samples, label: a.dashboard.sampleTeachers, href: `${base}/teachers` },
    { n: noEn, label: a.dashboard.achievementsNoEn, href: `${base}/achievements?missing=en` },
  ].filter((x) => x.n > 0);

  return (
    <>
      <PageHeader title={`${a.dashboard.welcome}${user.fullName ? `، ${user.fullName}` : ""}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-[var(--radius-card)] border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-accent/50">
            <div className="font-display text-4xl font-black">{num(s.n, lang)}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </Link>
        ))}
      </div>
      <h2 className="mt-10 font-display text-lg font-bold">{a.dashboard.needs}</h2>
      {needs.length === 0 ? (
        <p className="mt-3 inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle weight="fill" className="size-5" />
          {a.dashboard.allGood}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {needs.map((x) => (
            <li key={x.label}>
              <Link href={x.href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-ink/[0.03]">
                <WarningCircle weight="fill" className="size-5 shrink-0 text-accent-text" />
                <span className="font-display text-xl font-extrabold tabular-nums">{num(x.n, lang)}</span>
                <span className="text-muted">{x.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Dashboard lang={lang} />
    </Suspense>
  );
}
