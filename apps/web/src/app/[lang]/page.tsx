import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDict, isLocale, pick } from "@/lib/i18n";
import { siteUrl } from "@/lib/site-url";
import { getBranches, getSettings } from "@/server/content";
import { IntroSplash } from "@/components/site/intro-splash";
import { SiteHeader } from "@/components/site/site-header";
import { Branches, Departments, Hero, Portal, Proof, SiteFooter } from "@/components/site/home-sections";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { alternates: { canonical: lang === "fa" ? "/" : "/en", languages: { fa: "/", en: "/en", "x-default": "/" } } };
}

/** Organization data for search engines: name, contacts, socials and every active branch (real data only). */
async function OrgJsonLd({ lang }: { lang: "fa" | "en" }) {
  const [s, branches] = await Promise.all([getSettings(), getBranches()]);
  const base = siteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: pick(s.name, lang),
    alternateName: pick(s.name, lang === "fa" ? "en" : "fa"),
    url: base,
    logo: `${base}/brand/mark.svg`,
    description: pick(s.seo.description, lang) || pick(s.tagline, lang),
    email: s.email ?? undefined,
    telephone: s.phones[0]?.number,
    sameAs: s.socials.filter((x) => x.enabled && x.url).map((x) => x.url),
    location: branches.map((b) => ({
      "@type": "Place",
      name: pick(b.name, lang),
      address: { "@type": "PostalAddress", streetAddress: pick(b.address, lang), addressLocality: lang === "fa" ? "تهران" : "Tehran", addressCountry: "IR" },
      ...(b.lat && b.lng ? { geo: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } } : {}),
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <>
      <OrgJsonLd lang={lang} />
      <IntroSplash labels={getDict(lang).intro} />
      <div id="top-sentinel" className="absolute top-0 h-px w-px" aria-hidden />
      <SiteHeader lang={lang} />
      <main>
        <Hero lang={lang} />
        <Proof lang={lang} />
        <Departments lang={lang} />
        <Portal lang={lang} />
        <Branches lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
