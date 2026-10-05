import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import type { SessionUser } from "@khaneyeidea/core";
import { logoutAction } from "@/app/[lang]/login/actions";
import { getDict, href, num, type Locale } from "@/lib/i18n";
import { LogoMark } from "@/components/site/logo-mark";

const ROLE_LABEL = {
  fa: { owner: "مدیر کل", admin: "ادمین", content_manager: "مدیر محتوا", teacher: "مربی", parent: "ولی", student: "دانش‌آموز" },
  en: { owner: "Owner", admin: "Admin", content_manager: "Content manager", teacher: "Coach", parent: "Parent", student: "Student" },
} as const;

export function PanelShell({ lang, user, title, children }: { lang: Locale; user: SessionUser; title: string; children: React.ReactNode }) {
  const t = getDict(lang);
  const phone = `0${user.phone.slice(2)}`;
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href={href(lang)} className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-auto" />
          </Link>
          <span className="font-display text-base font-bold">{title}</span>
          <div className="ms-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline" dir="ltr">{num(phone, lang)}</span>
            <form action={logoutAction}>
              <input type="hidden" name="lang" value={lang} />
              <button className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm transition hover:border-ink/30">
                <SignOut weight="bold" className="size-4 rtl:-scale-x-100" />
                {t.panel.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">
          {t.panel.roles}: {user.roles.map((r) => ROLE_LABEL[lang][r.role]).join("، ")}
        </p>
        {children}
      </main>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-10 sm:px-6">
      <div className="h-8 w-48 rounded-lg bg-ink/10" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-[var(--radius-card)] bg-ink/5" />
        ))}
      </div>
    </div>
  );
}
