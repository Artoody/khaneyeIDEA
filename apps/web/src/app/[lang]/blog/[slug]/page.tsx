import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getDict, href, isLocale, num, pick } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { dayLabel, tehranIso } from "@/lib/jalali";
import { readingMinutes } from "@/lib/reading";
import { getBlocks, getPost, getPosts, getSettings } from "@/server/content";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/home-sections";
import { Prose } from "@/components/site/prose";
import { CoverImage } from "@/components/site/cover-image";

export async function generateStaticParams() {
  return (await getPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/blog/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const p = await getPost(decodeURIComponent(slug));
  if (!p) return {};
  const title = pick(p.seo.title, "fa") || pick(p.title, "fa");
  const description = pick(p.seo.description, "fa") || pick(p.excerpt, "fa") || undefined;
  return {
    title: `${title}`,
    description,
    // Articles are Persian: the Persian URL is canonical for both locales.
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: p.publishedAt?.toISOString(),
      modifiedTime: p.updatedAt.toISOString(),
      ...(p.coverImage ? { images: [{ url: p.coverImage }] } : {}),
    },
  };
}

export default async function PostPage({ params }: PageProps<"/[lang]/blog/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const [p, all, settings, blocks] = await Promise.all([getPost(decodeURIComponent(slug)), getPosts(), getSettings(), getBlocks()]);
  if (!p) notFound();
  const t = getDict(lang).blog;
  const body = pick(p.body, "fa");
  const more = all.filter((x) => x.id !== p.id).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: pick(p.title, "fa"),
    description: pick(p.excerpt, "fa") || undefined,
    image: p.coverImage ?? undefined,
    datePublished: p.publishedAt?.toISOString(),
    dateModified: p.updatedAt.toISOString(),
    inLanguage: "fa",
    author: { "@type": "Organization", name: pick(settings.name, "fa") },
    publisher: { "@type": "EducationalOrganization", name: pick(settings.name, "fa"), logo: { "@type": "ImageObject", url: "/brand/mark.svg" } },
    mainEntityOfPage: `/blog/${p.slug}`,
  };
  return (
    <>
      <SiteHeader lang={lang} />
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <article lang="fa" dir="rtl" className="mx-auto max-w-3xl pt-10 sm:pt-14">
          <Link href={href(lang, "/blog")} className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
            <ArrowRight className="size-4" />
            {getDict("fa").blog.back}
          </Link>
          <h1 className="mt-6 font-display text-3xl font-black leading-[1.4] tracking-tight text-balance sm:text-5xl sm:leading-[1.3]">{pick(p.title, "fa")}</h1>
          <p className="mt-5 text-sm text-muted">
            {p.publishedAt ? dayLabel(tehranIso(p.publishedAt), "fa", { weekday: false, year: true }) : ""} ·{" "}
            {fill(getDict("fa").blog.minutes, { n: num(readingMinutes(body), "fa") })}
          </p>
          {pick(p.excerpt, "fa") && <p className="mt-6 text-xl leading-relaxed text-ink/80">{pick(p.excerpt, "fa")}</p>}
          <Prose className="mt-10">{body}</Prose>
        </article>

        <aside className="glass mx-auto mt-16 flex max-w-3xl flex-col items-start gap-5 rounded-[var(--radius-card)] border border-line p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <p className="max-w-[46ch] text-lg leading-relaxed">{t.cta}</p>
          <Link
            href={href(lang, "/book?src=blog")}
            className="inline-flex h-12 shrink-0 items-center rounded-full bg-accent px-6 font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98]"
          >
            {pick(blocks["home.hero.cta"], lang)}
          </Link>
        </aside>

        {more.length > 0 && (
          <section className="mx-auto mt-16 max-w-3xl">
            <h2 className="font-display text-xl font-extrabold">{t.more}</h2>
            <ul className="mt-5 divide-y divide-line">
              {more.map((m) => (
                <li key={m.id}>
                  <Link href={href(lang, `/blog/${m.slug}`)} lang="fa" dir="rtl" className="flex items-center gap-4 py-4 transition hover:text-accent-text">
                    <CoverImage src={m.coverImage} className="size-16 shrink-0 rounded-xl" />
                    <span className="font-medium leading-relaxed">{pick(m.title, "fa")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
