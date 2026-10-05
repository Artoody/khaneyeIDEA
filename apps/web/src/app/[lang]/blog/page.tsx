import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpLeft } from "@phosphor-icons/react/dist/ssr";
import { getDict, href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { dayLabel, tehranIso } from "@/lib/jalali";
import { readingMinutes } from "@/lib/reading";
import { getPosts } from "@/server/content";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/home-sections";
import { CoverImage } from "@/components/site/cover-image";

export async function generateMetadata({ params }: PageProps<"/[lang]/blog">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang).blog;
  return {
    title: `${t.title}`,
    description: t.subtitle,
    alternates: { canonical: href(lang, "/blog"), languages: { fa: "/blog", en: "/en/blog" } },
  };
}

const date = (d: Date | null, l: Locale) => (d ? dayLabel(tehranIso(d), l, { weekday: false, year: true }) : "");

export default async function BlogPage({ params }: PageProps<"/[lang]/blog">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang).blog;
  const posts = await getPosts();
  const [first, ...rest] = posts;
  const faText = lang === "en" ? ({ lang: "fa", dir: "rtl" } as const) : {};
  return (
    <>
      <SiteHeader lang={lang} />
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <header className="max-w-3xl pb-12 pt-12 sm:pt-16">
          <h1 className="font-display text-4xl font-black tracking-tight sm:text-6xl">{t.title}</h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">{t.subtitle}</p>
          {lang === "en" && <p className="mt-3 text-sm text-muted">{t.onlyFa}</p>}
        </header>
        {!first ? (
          <p className="text-muted">{t.empty}</p>
        ) : (
          <>
            <Link
              href={href(lang, `/blog/${first.slug}`)}
              className="glass group grid overflow-hidden rounded-[var(--radius-card)] border border-line transition hover:border-accent/60 lg:grid-cols-[1.1fr_1fr]"
            >
              <div className="aspect-[16/10] overflow-hidden bg-ink/5 lg:aspect-auto">
                <CoverImage src={first.coverImage} className="h-full w-full transition duration-700 group-hover:scale-[1.03]" />
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-10" {...faText}>
                <p className="text-sm text-muted">
                  {date(first.publishedAt, lang)} · {fill(t.minutes, { n: num(readingMinutes(pick(first.body, "fa")), lang) })}
                </p>
                <h2 className="mt-3 font-display text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">{pick(first.title, "fa")}</h2>
                {first.excerpt && <p className="mt-4 line-clamp-3 leading-relaxed text-muted">{pick(first.excerpt, "fa")}</p>}
                <span className="mt-6 inline-flex items-center gap-2 font-medium text-accent-text">
                  {t.read}
                  <ArrowUpLeft weight="bold" className="size-4 ltr:-scale-x-100" />
                </span>
              </div>
            </Link>
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <li key={p.id}>
                  <Link
                    href={href(lang, `/blog/${p.slug}`)}
                    className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface/80 transition hover:-translate-y-1 hover:border-accent/60"
                  >
                    <div className="aspect-[16/10] overflow-hidden bg-ink/5">
                      <CoverImage src={p.coverImage} className="h-full w-full transition duration-700 group-hover:scale-[1.04]" />
                    </div>
                    <div className="flex flex-1 flex-col p-5" {...faText}>
                      <p className="text-xs text-muted">
                        {date(p.publishedAt, lang)} · {fill(t.minutes, { n: num(readingMinutes(pick(p.body, "fa")), lang) })}
                      </p>
                      <h2 className="mt-2 font-display text-lg font-extrabold leading-snug">{pick(p.title, "fa")}</h2>
                      {p.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{pick(p.excerpt, "fa")}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
