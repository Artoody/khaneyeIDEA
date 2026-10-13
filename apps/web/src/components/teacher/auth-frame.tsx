import { LogoMark } from "@/components/site/logo-mark";

/** The sign-in and password pages: the logo, a title and one form on a calm background with a warm corner glow. */
export function AuthFrame({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-[100dvh] flex-col justify-center overflow-hidden px-5 py-14">
      <div aria-hidden className="pointer-events-none absolute -start-24 -top-24 -z-10 size-80 rounded-full bg-accent/25 blur-3xl" />
      <div className="mx-auto w-full max-w-md">
        <LogoMark className="h-11 w-auto" />
        <h1 className="mt-7 font-display text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{help}</p>
        <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.35)] sm:p-6">{children}</div>
      </div>
    </main>
  );
}
