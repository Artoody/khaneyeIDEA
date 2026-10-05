import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LockKey, SignOut } from "@phosphor-icons/react/dist/ssr";
import { homeFor } from "@khaneyeidea/core";
import { href, isLocale, num, type Locale } from "@/lib/i18n";
import { requireUser } from "@/server/auth";
import { logoutAction } from "@/app/[lang]/login/actions";
import { LogoMark } from "@/components/site/logo-mark";
import { PanelSkeleton } from "@/components/panel/panel-shell";

const T = {
  fa: {
    title: "این بخش برای حساب شما فعال نیست",
    noRole: "شماره‌ی شما وارد شده، اما هنوز نقشی (مدیر، معلم یا ولی) به آن داده نشده است. از مدیر آموزشگاه بخواهید دسترسی بدهد.",
    other: "این صفحه برای نقش شما نیست. پنل خودتان آماده است.",
    go: "رفتن به پنل من",
    site: "بازگشت به سایت",
    out: "خروج",
    as: "وارد شده با",
    dev: "اگر خودتان صاحب پروژه‌اید: یک بار در ترمینال بزنید",
  },
  en: {
    title: "This area isn't enabled for your account",
    noRole: "You are signed in, but your number has no role yet (admin, coach or parent). Ask the academy admin to give you access.",
    other: "This page isn't for your role. Your own panel is ready.",
    go: "Go to my panel",
    site: "Back to the site",
    out: "Sign out",
    as: "Signed in as",
    dev: "If you own this project, run this once in a terminal",
  },
} as const;

async function NoAccess({ lang }: { lang: Locale }) {
  const user = await requireUser(lang);
  const t = T[lang];
  const home = homeFor(user);
  const phone = `0${user.phone.slice(2)}`;
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-12">
      <div className="w-full max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-7 text-center shadow-sm sm:p-10">
        <LogoMark className="mx-auto h-9 w-auto" />
        <span className="mx-auto mt-8 grid size-14 place-items-center rounded-2xl bg-accent/15 text-accent-text">
          <LockKey weight="duotone" className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-extrabold">{t.title}</h1>
        <p className="mt-3 leading-relaxed text-muted">{home === "/app" ? t.noRole : t.other}</p>
        <p className="mt-4 text-sm text-muted">
          {t.as} <bdi dir="ltr">{num(phone, lang)}</bdi>
        </p>
        {home === "/app" && process.env.NODE_ENV !== "production" && (
          <p className="mt-5 rounded-xl bg-ink/5 p-3 text-start text-xs text-muted">
            {t.dev}:
            <code className="mt-1 block break-all text-[11px] text-ink" dir="ltr">
              pnpm --filter @khaneyeidea/db grant-role {phone} owner &quot;Admin&quot;
            </code>
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {home !== "/app" && (
            <Link href={href(lang, home)} className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-on-accent hover:bg-accent-strong">
              {t.go}
            </Link>
          )}
          <Link href={href(lang)} className="inline-flex h-11 items-center rounded-full border border-line px-6 text-sm hover:border-ink/30">
            {t.site}
          </Link>
          <form action={logoutAction}>
            <input type="hidden" name="lang" value={lang} />
            <button className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm text-muted hover:text-ink">
              <SignOut className="size-4 rtl:-scale-x-100" />
              {t.out}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/no-access">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <NoAccess lang={lang} />
    </Suspense>
  );
}
