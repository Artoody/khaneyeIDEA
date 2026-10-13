import Link from "next/link";
import { CalendarBlank, CalendarCheck, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { href, type Locale } from "@/lib/i18n";
import type { OpsDict } from "@/lib/ops-i18n";
import { LogoMark } from "@/components/site/logo-mark";
import { ThemeToggle } from "@/components/site/header-client";
import { PanelSfx, SoundToggle } from "@/components/ops/sfx";

type Tab = "today" | "week" | "profile";
const TABS: { key: Tab; path: string; icon: typeof CalendarCheck }[] = [
  { key: "today", path: "/teacher", icon: CalendarCheck },
  { key: "week", path: "/teacher/week", icon: CalendarBlank },
  { key: "profile", path: "/teacher/profile", icon: UserCircle },
];

/**
 * The frame of the coach app. On a phone the three places sit in a bar under the thumb (and the page keeps clear of
 * the home indicator); on a wider screen the same links move up beside the logo.
 */
export function TeacherShell({ lang, t, active, children }: { lang: Locale; t: OpsDict["tp"]; active: Tab; children: React.ReactNode }) {
  const link = (tab: (typeof TABS)[number], cls: string) => (
    <Link key={tab.key} href={href(lang, tab.path)} aria-current={active === tab.key ? "page" : undefined} className={cls}>
      <tab.icon weight={active === tab.key ? "fill" : "regular"} className="size-6 md:size-5" />
      <span>{t.tabs[tab.key]}</span>
    </Link>
  );
  return (
    <div className="min-h-[100dvh] bg-bg">
      <PanelSfx />
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4 md:max-w-3xl">
          <Link href={href(lang, "/teacher")} className="flex items-center gap-2.5" aria-label={t.app}>
            <LogoMark className="h-7 w-auto" />
            <span className="font-display text-base font-extrabold">{t.app}</span>
          </Link>
          <nav className="ms-6 hidden items-center gap-1 md:flex" aria-label={t.app}>
            {TABS.map((tab) =>
              link(tab, "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm text-muted transition hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:font-semibold aria-[current=page]:text-bg"),
            )}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <SoundToggle
              onLabel={lang === "fa" ? "صدای رابط روشن است؛ برای خاموش کردن بزنید" : "Interface sounds are on; press to turn off"}
              offLabel={lang === "fa" ? "صدای رابط خاموش است؛ برای روشن کردن بزنید" : "Interface sounds are off; press to turn on"}
            />
            <ThemeToggle label={lang === "fa" ? "تغییر تم" : "Switch theme"} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-32 pt-6 md:max-w-3xl md:pb-16">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label={t.app}>
        <div className="mx-auto grid max-w-md grid-cols-3 px-2">
          {TABS.map((tab) =>
            link(tab, "relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] text-muted transition active:scale-95 aria-[current=page]:font-semibold aria-[current=page]:text-ink [&[aria-current=page]>svg]:text-accent-text"),
          )}
        </div>
      </nav>
    </div>
  );
}
