import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, href, isLocale, num, pick } from "@/lib/i18n";
import { getBlocks, getFaqs, getStats } from "@/server/content";
import { SiteHeader } from "@/components/site/site-header";
import { Partners, Reviews, SiteFooter } from "@/components/site/home-sections";
import { FaqAccordion } from "@/components/site/faq-accordion";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const blocks = await getBlocks();
  return {
    title: pick(blocks["about.hero"], lang),
    description: pick(blocks["about.lead"], lang),
    alternates: { canonical: href(lang, "/about"), languages: { fa: "/about", en: "/en/about" } },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const [blocks, faqRows, stats] = await Promise.all([getBlocks(), getFaqs(), getStats()]);
  const body = pick(blocks["about.body"], lang);
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const faqs = faqRows.map((f) => ({
    id: f.id,
    question: pick(f.question, lang),
    answer: pick(f.answer, lang),
  }));
  const facts = [
    { value: num(stats.worldFirsts, lang), label: t.proof.worldFirsts },
    { value: num(stats.achievements, lang), label: t.proof.recorded },
    ...(stats.yearsActive ? [{ value: `${num(stats.yearsActive, lang)}+`, label: t.proof.years }] : []),
    { value: num(stats.branches, lang), label: t.proof.branches },
  ];

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <header className="grid gap-10 pb-12 pt-12 sm:pt-16 lg:grid-cols-[1.35fr_1fr] lg:items-end">
          <div>
            <h1 className="font-display text-4xl font-black leading-[1.15] tracking-tight text-balance sm:text-6xl">
              {pick(blocks["about.hero"], lang)}
            </h1>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">{pick(blocks["about.lead"], lang)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={href(lang, "/book")}
                className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98]"
              >
                {pick(blocks["home.hero.cta"], lang)}
              </Link>
              <Link
                href={href(lang, "/courses")}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-medium transition hover:border-ink/30 active:scale-[0.98]"
              >
                {t.hero.secondary}
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse border-s-2 border-accent ps-4">
                <dt className="mt-1 text-sm text-muted">{f.label}</dt>
                <dd className="font-display text-3xl font-black tracking-tight sm:text-4xl">{f.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="max-w-3xl">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{pick(blocks["about.whyTitle"], lang)}</h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed text-ink/90 sm:text-lg">
            {paragraphs.map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
          </div>
        </section>

        {faqs.length > 0 && (
          <section className="mt-16 sm:mt-20">
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{pick(blocks["about.faqTitle"], lang)}</h2>
            <div className="mt-6">
              <FaqAccordion items={faqs} />
            </div>
          </section>
        )}
      </main>
      <Reviews lang={lang} />
      <Partners lang={lang} />
      <SiteFooter lang={lang} />
    </>
  );
}
