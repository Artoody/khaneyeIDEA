import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, href, isLocale, num, pick } from "@/lib/i18n";
import { localDigits } from "@/lib/format";
import { getAllAchievements, getBlocks, getSettings, getStats } from "@/server/content";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/home-sections";
import { AchievementsBrowser, type AchievementItem } from "@/components/site/achievements-browser";

export async function generateMetadata({ params }: PageProps<"/[lang]/achievements">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const [blocks, s] = await Promise.all([getBlocks(), getSettings()]);
  return {
    title: `${pick(blocks["achievements.title"], lang)} | ${pick(s.name, lang)}`,
    description: pick(blocks["achievements.subtitle"], lang),
    alternates: { canonical: href(lang, "/achievements"), languages: { fa: "/achievements", en: "/en/achievements" } },
  };
}

export default async function AchievementsPage({ params }: PageProps<"/[lang]/achievements">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const [rows, blocks, stats] = await Promise.all([getAllAchievements(), getBlocks(), getStats()]);
  const items: AchievementItem[] = rows.map((a) => ({
    id: a.id,
    // Persian text gets Persian digits ("2024" -> "۲۰۲۴"); stored data stays as entered.
    title: localDigits(pick(a.title, lang), lang === "en" && a.title.en ? "en" : "fa"),
    titleLang: lang === "en" && !a.title.en ? "fa" : undefined,
    competition: a.competition && localDigits(a.competition, lang),
    rank: a.rank,
    scope: a.scope === "world" || a.scope === "asia" || a.scope === "national" ? a.scope : null,
    country: pick(a.country, lang),
    year: a.year,
  }));
  // Real counts only (no fake numbers): everything below is computed from the rows.
  const countries = new Set(rows.map((a) => a.country?.fa).filter(Boolean)).size;
  const facts = [
    { value: num(stats.achievements, lang), label: t.proof.recorded },
    { value: num(stats.worldFirsts, lang), label: t.proof.worldFirsts },
    ...(countries > 1 ? [{ value: num(countries, lang), label: t.achievementsPage.countries }] : []),
  ];
  const untranslated = lang === "en" && items.some((i) => i.titleLang);

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <header className="grid gap-10 pb-12 pt-12 sm:pt-16 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <h1 className="font-display text-4xl font-black leading-[1.15] tracking-tight text-balance sm:text-6xl">{pick(blocks["achievements.title"], lang)}</h1>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">{pick(blocks["achievements.subtitle"], lang)}</p>
            {untranslated && <p className="mt-3 text-sm text-muted">{t.achievementsPage.untranslated}</p>}
          </div>
          <dl className="grid grid-cols-3 gap-4">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse border-s-2 border-accent ps-4">
                <dt className="mt-1 text-sm text-muted">{f.label}</dt>
                <dd className="font-display text-4xl font-black tracking-tight sm:text-5xl">{f.value}</dd>
              </div>
            ))}
          </dl>
        </header>
        <AchievementsBrowser items={items} lang={lang} labels={t.achievementsPage} />
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
