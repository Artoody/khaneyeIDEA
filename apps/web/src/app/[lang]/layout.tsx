import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { notFound } from "next/navigation";
import { dirOf, isLocale, LOCALES, pick, type Locale } from "@/lib/i18n";
import { getSettings } from "@/server/content";
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
    title: { default: pick(s.seo.title, lang) || pick(s.name, lang), template: `%s | ${pick(s.name, lang)}` },
    description: pick(s.seo.description, lang),
    alternates: { languages: { fa: "/", en: "/en" } },
    icons: { icon: "/brand/mark.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c10" },
  ],
};

// Applies the saved or system theme before first paint (no flash).
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})()`;

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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-[100dvh] bg-bg text-ink">{children}</body>
    </html>
  );
}
