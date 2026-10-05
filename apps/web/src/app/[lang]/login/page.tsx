import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, href, isLocale, pick } from "@/lib/i18n";
import { getSettings } from "@/server/content";
import { LoginForm } from "@/components/auth/login-form";
import { LogoMark } from "@/components/site/logo-mark";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDict(lang).auth.title : undefined, robots: { index: false } };
}

export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const settings = await getSettings();
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#0b0c10] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-dots absolute inset-0 opacity-60 [--grid-dot:rgb(238_239_242/0.06)]" />
        <Link href={href(lang)} className="relative flex items-center gap-3 text-[#eeeff2]">
          <LogoMark className="h-9 w-auto" />
          <span className="font-display text-lg font-extrabold">{pick(settings.name, lang)}</span>
        </Link>
        <LogoMark className="relative mx-auto h-64 w-auto drop-shadow-[0_0_40px_rgba(255,179,71,0.35)]" />
        <p className="relative max-w-sm text-lg text-[#9aa1ae]">{pick(settings.tagline, lang)}</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <Link href={href(lang)} className="mb-10 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-9 w-auto" />
            <span className="font-display text-lg font-extrabold">{pick(settings.name, lang)}</span>
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{t.auth.title}</h1>
          <p className="mt-2 text-muted">{t.auth.subtitle}</p>
          <div className="mt-8">
            <LoginForm lang={lang} t={t.auth} />
          </div>
          <p className="mt-10 text-xs leading-relaxed text-muted">{t.auth.privacy}</p>
        </div>
      </section>
    </main>
  );
}
