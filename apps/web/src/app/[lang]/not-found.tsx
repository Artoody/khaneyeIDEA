import Link from "next/link";
import { LogoMark } from "@/components/site/logo-mark";

// Rendered for notFound() inside a locale. Kept bilingual and static (no request data), so it is safe everywhere.
export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <LogoMark className="h-20 w-auto opacity-90" />
        <p className="mt-8 font-display text-6xl font-black tracking-tight">۴۰۴</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold">این صفحه پیدا نشد</h1>
        <p className="mt-1 text-muted">This page could not be found.</p>
        <div className="mt-8 flex gap-3">
          <Link href="/" className="inline-flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-on-accent transition hover:bg-accent-strong">
            صفحه‌ی اصلی
          </Link>
          <Link href="/en" className="inline-flex h-12 items-center rounded-full border border-line px-6 transition hover:border-ink/30">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
