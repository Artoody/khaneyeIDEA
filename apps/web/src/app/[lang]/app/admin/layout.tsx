import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { getDict, href, isLocale, num, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getUser } from "@/server/auth";
import { logoutAction } from "@/app/[lang]/login/actions";
import { LogoMark } from "@/components/site/logo-mark";
import { AdminNav, type NavItem } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/site/header-client";

// Layout only draws the frame. Authorization happens in every page and every action (never here).
async function UserChip({ lang }: { lang: Locale }) {
  const user = await getUser();
  if (!user) return null;
  return (
    <span className="hidden text-sm text-muted sm:inline" dir="ltr">
      {user.fullName ?? num(`0${user.phone.slice(2)}`, lang)}
    </span>
  );
}

export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/app/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const a = getAdminDict(lang);
  const t = getDict(lang);
  const base = href(lang, "/app/admin");
  const items: NavItem[] = (
    ["dashboard", "settings", "pages", "branches", "departments", "courses", "teachers", "achievements"] as const
  ).map((key) => ({ key, label: a.nav[key], href: key === "dashboard" ? base : `${base}/${key}` }));

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl sm:px-6">
        <Link href={base} className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-auto" />
          <span className="font-display text-base font-extrabold">{a.title}</span>
        </Link>
        <div className="ms-auto flex items-center gap-2">
          <Suspense>
            <UserChip lang={lang} />
          </Suspense>
          <ThemeToggle label={t.theme.toggle} />
          <form action={logoutAction}>
            <input type="hidden" name="lang" value={lang} />
            <button className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm transition hover:border-ink/30">
              <SignOut weight="bold" className="size-4 rtl:-scale-x-100" />
              <span className="hidden sm:inline">{t.panel.logout}</span>
            </button>
          </form>
        </div>
      </header>
      <div className="flex">
        <AdminNav items={items} siteHref={href(lang)} siteLabel={a.nav.viewSite} menuLabel={t.menu} />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-8 sm:px-8 lg:pb-12">{children}</main>
      </div>
    </div>
  );
}
