import Link from "next/link";
import { X } from "@phosphor-icons/react/dist/ssr";

/** The session drawer: a sheet from the bottom on a phone, a side panel on a wider screen. Closing is a link. */
export function SessionSheet({ closeHref, closeLabel, title, when, children }: { closeHref: string; closeLabel: string; title: string; when: string; children: React.ReactNode }) {
  return (
    <>
      <Link href={closeHref} scroll={false} aria-label={closeLabel} className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] [animation:fade-in_0.2s_ease-out_both]" />
      <aside
        data-testid="session-panel"
        className="sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-3xl border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] shadow-2xl sm:inset-y-0 sm:end-0 sm:start-auto sm:max-h-none sm:w-[30rem] sm:rounded-none sm:border-s sm:border-t-0"
      >
        <span aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-ink/15 sm:hidden" />
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-bg/95 p-5 backdrop-blur">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold leading-snug">{title}</h2>
            <p className="mt-1 text-sm text-muted">{when}</p>
          </div>
          <Link href={closeHref} scroll={false} aria-label={closeLabel} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-ink/5">
            <X className="size-5" />
          </Link>
        </header>
        <div className="p-5">{children}</div>
      </aside>
    </>
  );
}
