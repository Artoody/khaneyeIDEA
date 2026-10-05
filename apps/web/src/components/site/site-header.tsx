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
    {
      href: href(lang, "/#branches"),
      label: t.nav.branches,
      section: "branches",
    },
    { href: href(lang, "/#contact"), label: t.nav.contact, section: "contact" },
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
    <>
      {/* Every public page has this header, so the scroll backdrop is mounted here once. */}
      <ScrollBackdrop />
      <HeaderShell>
        <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link
            href={href(lang)}
            className="flex items-center gap-3"
            aria-label={pick(settings.name, lang)}
          >
            <LogoMark
              className="h-8 w-auto"
              title={pick(settings.name, lang)}
            />
            <span className="font-display text-[17px] font-extrabold tracking-tight">
              {pick(settings.name, lang)}
            </span>
          </Link>

          <NavLinks links={links} />

          <div className="ms-auto flex items-center gap-1.5">
            <div className="hidden sm:block">
              <LangSwitch lang={lang} />
            </div>
            <ThemeToggle label={t.theme.toggle} />
            <div className="ms-2 hidden items-center gap-2 lg:flex">
              {actions}
            </div>
            <MobileMenu
              links={links}
              labels={{ menu: t.menu, close: t.close }}
              extra={
                <>
                  <div className="flex justify-center">
                    <LangSwitch lang={lang} />
                  </div>
                  {actions}
                </>
              }
            />
          </div>
        </div>
      </HeaderShell>
    </>
  );
}
