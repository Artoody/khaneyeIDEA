import Link from "next/link";
import { SignIn } from "@phosphor-icons/react/dist/ssr";
import { getDict, href, pick, type Locale } from "@/lib/i18n";
import { getBlocks, getSettings } from "@/server/content";
import { HeaderShell, MobileMenu, ThemeToggle } from "./header-client";
import { LogoMark } from "./logo-mark";

export async function SiteHeader({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks()]);
  const other: Locale = lang === "fa" ? "en" : "fa";
  const links = [
    { href: href(lang, "/#courses"), label: t.nav.courses },
    { href: href(lang, "/#achievements"), label: t.nav.achievements },
    { href: href(lang, "/#branches"), label: t.nav.branches },
    { href: href(lang, "/#contact"), label: t.nav.contact },
  ];
  const cta = pick(blocks["home.hero.cta"], lang);

  const actions = (
    <>
      <Link
        href={href(lang, "/login")}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-medium text-ink transition hover:border-ink/30 active:scale-[0.98]"
      >
        <SignIn weight="bold" className="size-4 rtl:-scale-x-100" />
        {t.login}
      </Link>
      <Link
        href={href(lang, "/book")}
        className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98]"
      >
        {cta}
      </Link>
    </>
  );

  return (
    <HeaderShell>
      <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href={href(lang)} className="flex items-center gap-3" aria-label={pick(settings.name, lang)}>
          <LogoMark className="h-8 w-auto" title={pick(settings.name, lang)} />
          <span className="font-display text-[17px] font-extrabold tracking-tight">{pick(settings.name, lang)}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-[15px] text-muted transition hover:bg-ink/5 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1.5">
          <Link
            href={href(other)}
            hrefLang={other}
            className="hidden h-10 items-center rounded-full px-3 text-sm text-muted transition hover:bg-ink/5 hover:text-ink sm:inline-flex"
          >
            {t.switchLang}
          </Link>
          <ThemeToggle label={t.theme.toggle} />
          <div className="ms-2 hidden items-center gap-2 lg:flex">{actions}</div>
          <MobileMenu
            links={[...links, { href: href(other), label: t.switchLang }]}
            labels={{ menu: t.menu, close: t.close }}
            extra={actions}
          />
        </div>
      </div>
    </HeaderShell>
  );
}
