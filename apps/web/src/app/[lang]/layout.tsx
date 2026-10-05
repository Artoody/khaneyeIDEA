import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { notFound } from "next/navigation";
import { dirOf, isLocale, LOCALES, pick, type Locale } from "@/lib/i18n";
import { getSettings } from "@/server/content";
import { InlineScript } from "@/components/inline-script";
import { siteUrl } from "@/lib/site-url";
import "../globals.css";

const display = localFont({
  src: "../../fonts/estedad-arabic.woff2",
  variable: "--font-display-fa",
  weight: "100 900",
  display: "swap",
});
const body = localFont({
  src: "../../fonts/vazirmatn-arabic.woff2",
  variable: "--font-body-fa",
  weight: "100 900",
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    openGraph: {
      siteName: pick(s.name, lang),
      locale: lang === "fa" ? "fa_IR" : "en_US",
      type: "website",
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: pick(s.name, lang) }],
    },
    twitter: { card: "summary_large_image", images: ["/og.jpg"] },
    title: { default: pick(s.seo.title, lang) || pick(s.name, lang), template: `%s | ${pick(s.name, lang)}` },
    description: pick(s.seo.description, lang),
    icons: { icon: "/brand/mark.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c10" },
  ],
};

// Before first paint: applies the saved or system theme (no flash), and flags the one-time intro video for
// each new visit (browser session) landing on the home page (skipped for reduced motion and data saver).
const themeScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t}catch(e){d.dataset.theme="light"}try{var p=location.pathname.replace(/\\/$/,"");var c=navigator.connection;if((p===""||p==="/en")&&!sessionStorage.getItem("intro-seen")&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!(c&&c.saveData)){d.dataset.intro="1"}}catch(e){}})()`;

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const l: Locale = lang;
  return (
    <html
      lang={l}
      dir={dirOf(l)}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${GeistSans.variable} antialiased`}
      style={{ ["--font-latin" as string]: "var(--font-geist-sans)" }}
    >
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="min-h-[100dvh] text-ink">{children}</body>
    </html>
  );
}
