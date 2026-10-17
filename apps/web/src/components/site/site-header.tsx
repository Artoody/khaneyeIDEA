import Link from "next/link";
import { SignIn } from "@phosphor-icons/react/dist/ssr";
import { getDict, href, pick, type Locale } from "@/lib/i18n";
import { getBlocks, getSettings } from "@/server/content";
import { HeaderShell, MobileMenu, ThemeToggle } from "./header-client";
import { LogoMark } from "./logo-mark";
import { NavLinks, type NavLink } from "./nav-links";
import { ScrollBackdrop } from "./scroll-backdrop";
import { LangSwitch } from "./lang-switch";

export async function SiteHeader({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks()]);
  const links: NavLink[] = [
    {
      href: href(lang, "/courses"),
      label: t.nav.courses,
      page: "/courses",
      section: "courses",
    },
    {
      href: href(lang, "/achievements"),
      label: t.nav.achievements,
      page: "/achievements",
      section: "achievements",
    },
    { href: href(lang, "/blog"), label: t.nav.blog, page: "/blog", section: "blog" },
    { href: href(lang, "/about"), label: t.nav.about, page: "/about", section: "about" },
    { href: href(lang, "/tinkercad"), label: t.nav.tinkercad, page: "/tinkercad", section: "tinkercad" },
    {
      href: href(lang, "/#branches"),
      label: t.nav.branches,
      section: "branches",
    },
    { href: href(lang, "/#contact"), label: t.nav.contact, section: "contact" },
  ];
  const cta = pick(blocks["home.hero.cta"], lang);
  // English words are longer: the inline menu needs a wider screen there, below it the menu button takes over.
  const wide = lang === "en" ? "2xl" : "xl";

  const actions = (
    <>
      <Link
        href={href(lang, "/login")}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line px-4 text-sm font-medium text-ink transition hover:border-ink/30 active:scale-[0.98] lg:px-5"
      >
        <SignIn weight="bold" className="size-4 rtl:-scale-x-100" />
        {t.login}
      </Link>
      <Link
        href={href(lang, "/book")}
        className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-accent px-4 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] lg:px-5"
      >
        {cta}
      </Link>
    </>
  );

  return (
    <>
      {/* Every public page has this header, so the scroll backdrop is mounted here once. */}
      <ScrollBackdrop />
      <HeaderShell>
        <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-3 px-4 sm:px-6 xl:gap-6">
          <Link
            href={href(lang)}
            className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3"
            aria-label={pick(settings.name, lang)}
          >
            <LogoMark
              className="h-8 w-auto"
              title={pick(settings.name, lang)}
            />
            <span className="whitespace-nowrap font-display text-base font-extrabold tracking-tight sm:text-[17px]">
              {pick(settings.name, lang)}
            </span>
          </Link>

          <NavLinks links={links} show={wide} />

          <div className="ms-auto flex items-center gap-1.5">
            <div className="hidden sm:block">
              <LangSwitch lang={lang} />
            </div>
            <ThemeToggle label={t.theme.toggle} />
            <div className="ms-2 hidden items-center gap-2 md:flex">
              {actions}
            </div>
            <MobileMenu
              links={links}
              show={wide}
              labels={{ menu: t.menu, close: t.close }}
              extra={
                <>
                  <div className="flex justify-center">
                    <LangSwitch lang={lang} />
                  </div>
                  <div className="flex flex-col gap-3 md:hidden">{actions}</div>
                </>
              }
            />
          </div>
        </div>
      </HeaderShell>
    </>
  );
}
