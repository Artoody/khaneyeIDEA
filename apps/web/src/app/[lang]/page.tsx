import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import { IntroSplash } from "@/components/site/intro-splash";
import { SiteHeader } from "@/components/site/site-header";
import { Branches, Departments, Hero, Portal, Proof, SiteFooter } from "@/components/site/home-sections";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <>
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
