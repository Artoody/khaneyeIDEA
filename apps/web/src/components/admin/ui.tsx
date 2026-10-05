import Link from "next/link";
import { ArrowRight, Plus } from "@phosphor-icons/react/dist/ssr";

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

export function ListSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-ink/10" />
      <div className="mt-8 flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-ink/5" />
        ))}
      </div>
    </div>
  );
}

/** Clickable list rows with a consistent look. */
export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-center gap-4 px-4 py-3 transition hover:bg-ink/[0.03] sm:px-5">
        {children}
      </Link>
    </li>
  );
}

export function RowList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">{children}</ul>;
}
