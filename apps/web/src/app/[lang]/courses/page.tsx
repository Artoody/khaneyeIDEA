import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDict, href, isLocale, pick, type Locale } from "@/lib/i18n";
import { ageRange, priceText } from "@/lib/format";
import { getBlocks, getCatalog, getSettings } from "@/server/content";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/home-sections";
import { CatalogBrowser, CourseGrid, type CatalogCourse, type CatalogDept } from "@/components/site/catalog/catalog-browser";

export async function generateMetadata({ params }: PageProps<"/[lang]/courses">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const blocks = await getBlocks();
  return {
    title: `${pick(blocks["courses.title"], lang)}`,
    description: pick(blocks["courses.subtitle"], lang),
    alternates: { canonical: href(lang, "/courses"), languages: { fa: "/courses", en: "/en/courses" } },
  };
}

async function Catalog({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const [{ courses, departments }, settings] = await Promise.all([getCatalog(), getSettings()]);
  const deptSlug = new Map(departments.map((d) => [d.id, d.slug]));
  const list: CatalogCourse[] = courses.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: pick(c.title, lang),
    summary: pick(c.summary, lang),
    dept: c.departmentId ? (deptSlug.get(c.departmentId) ?? null) : null,
    depts: [c.departmentId, ...c.alsoIn].map((id) => (id ? deptSlug.get(id) : undefined)).filter((x): x is string => !!x),
    ageMin: c.ageMin,
    ageMax: c.ageMax,
    ages: ageRange(c.ageMin, c.ageMax, lang),
    modes: c.modes,
    price: priceText(c, settings.showPrices, lang, { toman: t.toman, contact: "" }) || null,
  }));
  // Only departments that have published courses become filters.
  const used = new Set(list.flatMap((c) => c.depts));
  const depts: CatalogDept[] = departments.filter((d) => used.has(d.slug)).map((d) => ({ slug: d.slug, title: pick(d.title, lang), icon: d.icon }));
  const labels = { ...t.catalog, modes: t.modes };
  return (
    <Suspense fallback={<div className="mt-24"><CourseGrid courses={list} depts={depts} lang={lang} labels={labels} /></div>}>
      <CatalogBrowser courses={list} depts={depts} lang={lang} labels={labels} />
    </Suspense>
  );
}

export default async function CoursesPage({ params }: PageProps<"/[lang]/courses">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const blocks = await getBlocks();
  return (
    <>
      <SiteHeader lang={lang} />
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <header className="max-w-3xl pb-10 pt-12 sm:pt-16">
          <h1 className="font-display text-4xl font-black leading-[1.15] tracking-tight text-balance sm:text-6xl">{pick(blocks["courses.title"], lang)}</h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">{pick(blocks["courses.subtitle"], lang)}</p>
        </header>
        <Catalog lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
