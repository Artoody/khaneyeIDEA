import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { getDict, href, isLocale, pick } from "@/lib/i18n";
import { getBlocks } from "@/server/content";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/home-sections";

const DEFAULT_DOWNLOAD = "https://github.com/Artoody/ClassBridge/releases/download/v1.0.0/ClassBridge.exe";
const REPO_URL = "https://github.com/Artoody/ClassBridge";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const blocks = await getBlocks();
  return {
    title: pick(blocks["tinkercad.hero"], lang),
    description: pick(blocks["tinkercad.lead"], lang),
    alternates: { canonical: href(lang, "/tinkercad"), languages: { fa: "/tinkercad", en: "/en/tinkercad" } },
  };
}

export default async function TinkercadPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const blocks = await getBlocks();
  const downloadUrl = pick(blocks["tinkercad.downloadUrl"], lang).trim() || DEFAULT_DOWNLOAD;
  const steps = [
    pick(blocks["tinkercad.step1"], lang),
    pick(blocks["tinkercad.step2"], lang),
    pick(blocks["tinkercad.step3"], lang),
  ];

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <header className="max-w-3xl pb-12 pt-12 sm:pt-16">
          <p className="text-sm font-semibold tracking-wide text-accent-text">ClassBridge</p>
          <h1 className="mt-3 font-display text-4xl font-black leading-[1.15] tracking-tight text-balance sm:text-6xl">
            {pick(blocks["tinkercad.hero"], lang)}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">{pick(blocks["tinkercad.lead"], lang)}</p>
          <p className="mt-6 text-base leading-relaxed text-ink/90 sm:text-lg">{pick(blocks["tinkercad.body"], lang)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={downloadUrl}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98]"
            >
              <DownloadSimple className="size-5" weight="bold" />
              {pick(blocks["tinkercad.downloadLabel"], lang)}
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-full border border-line px-6 text-sm font-medium transition hover:border-ink/30 active:scale-[0.98]"
            >
              GitHub
            </a>
          </div>
        </header>

        <section className="max-w-3xl">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{pick(blocks["tinkercad.stepsTitle"], lang)}</h2>
          <ol className="mt-6 space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4 rounded-2xl border border-line bg-surface px-5 py-4">
                <span className="font-display text-2xl font-black text-accent-text tabular-nums">{lang === "fa" ? ["۱", "۲", "۳"][i] : i + 1}</span>
                <p className="pt-1 text-base leading-relaxed text-ink/90">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm leading-relaxed text-muted">{pick(blocks["tinkercad.teacherNote"], lang)}</p>
          <p className="mt-6">
            <Link href={href(lang, "/about")} className="text-sm font-medium text-accent-text transition hover:underline">
              {t.nav.about}
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
