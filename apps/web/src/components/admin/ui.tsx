import Link from "next/link";
import { ArrowRight, CaretLeft, Plus } from "@phosphor-icons/react/dist/ssr";

// Server-safe layout pieces for admin pages.

export function PageHeader({
  title,
  description,
  back,
  action,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
            <ArrowRight className="size-4 ltr:rotate-180" />
            {back.label}
          </Link>
        )}
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98]"
        >
          <Plus weight="bold" className="size-4" />
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Section({ title, children, help }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {help && <p className="mt-1 text-sm text-muted">{help}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "success" | "muted" }) {
  const cls = {
    neutral: "bg-ink/5 text-ink",
    accent: "bg-accent/15 text-accent-text",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    muted: "bg-ink/5 text-muted",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

/** The bar that slides along the top while a panel page loads: the page is working, not frozen. */
function LoadBar() {
  return (
    <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-ink/5" role="progressbar" aria-busy="true">
      <span className="absolute inset-y-0 start-0 w-2/5 rounded-full bg-accent" style={{ animation: "load-bar 1.2s ease-in-out infinite" }} />
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div>
      <LoadBar />
      <div className="mt-6 h-8 w-48 rounded-lg bg-ink/[0.07]" />
      <div className="mt-8 flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rise h-16 overflow-hidden rounded-2xl bg-ink/[0.04]" style={{ "--i": i } as React.CSSProperties}>
            <div className="shimmer size-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The classes page while it loads: a toolbar and a few rows of class-shaped blocks. */
export function ClassesSkeleton() {
  const rows = [
    [38, 26, 18],
    [22, 40],
    [30, 30, 24],
    [44, 20],
  ];
  return (
    <div aria-busy="true">
      <LoadBar />
      <div className="mt-6 h-9 w-40 rounded-lg bg-ink/[0.07]" />
      <div className="mt-6 flex gap-2">
        <div className="h-11 w-64 rounded-full bg-ink/[0.05]" />
        <div className="h-11 flex-1 rounded-full bg-ink/[0.04]" />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={i} className="rise flex items-center gap-3 rounded-2xl border border-line p-3" style={{ "--i": i } as React.CSSProperties}>
            <div className="h-10 w-24 shrink-0 rounded-xl bg-ink/[0.06]" />
            {r.map((w, j) => (
              <div key={j} className="h-14 overflow-hidden rounded-xl bg-ink/[0.045]" style={{ width: `${w}%` }}>
                <div className="shimmer size-full" style={{ animationDelay: `${(i + j) * 140}ms` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Clickable list rows with a consistent look: a tinted icon (or initials) tile, the content, and a caret. */
export function RowLink({ href, children, icon: Ico, initials }: { href: string; children: React.ReactNode; icon?: React.ComponentType<{ weight?: "duotone" | "regular" | "fill" | "bold"; className?: string }>; initials?: string }) {
  return (
    <li>
      <Link href={href} className="group flex min-h-[4.5rem] items-center gap-4 px-4 py-3 transition hover:bg-ink/[0.03] sm:px-5">
        {(Ico || initials) && (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text transition group-hover:bg-accent group-hover:text-on-accent">
            {Ico ? <Ico weight="duotone" className="size-6" /> : <span className="font-display text-base font-extrabold">{initials}</span>}
          </span>
        )}
        {children}
        <CaretLeft className="size-4 shrink-0 text-muted/60 transition group-hover:-translate-x-0.5 group-hover:text-ink ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export function RowList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">{children}</ul>;
}
