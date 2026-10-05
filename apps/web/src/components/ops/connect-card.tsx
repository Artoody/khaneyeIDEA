"use client";

import { useActionState, useState } from "react";
import { CheckCircle, Copy, CircleNotch, Link as LinkIcon } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { createMyCode, type SessionState } from "@/app/[lang]/app/session-actions";

/** Shows the code a person sends to the bot to connect their own chat, and which channels are already connected. */
export function ConnectCard({ o, linked }: { o: OpsDict; linked: ("bale" | "telegram")[] }) {
  const [state, create, pending] = useActionState<SessionState, FormData>(() => createMyCode(), {});
  const [copied, setCopied] = useState(false);
  const cmd = state.code ? `/start ${state.code}` : null;
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6" data-testid="connect-card">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <LinkIcon weight="duotone" className="size-5 text-accent-text" />
        {o.connect.title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{o.connect.help}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {(["bale", "telegram"] as const).map((ch) => {
          const on = linked.includes(ch);
          return (
            <li key={ch} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${on ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-ink/5 text-muted"}`}>
              {on && <CheckCircle weight="fill" className="size-4" />}
              {o.connect[ch]}: {on ? o.connect.linked : o.connect.none}
            </li>
          );
        })}
      </ul>
      <form action={create} className="mt-4">
        <button disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-bg transition active:scale-[0.98] disabled:opacity-60">
          {pending && <CircleNotch className="size-4 animate-spin" />}
          {o.connect.create}
        </button>
      </form>
      {cmd && (
        <div className="mt-4 rounded-2xl bg-ink/5 p-4" role="status">
          <p className="text-sm text-muted">{o.connect.step}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <code className="font-mono text-lg font-bold tracking-wider" dir="ltr" data-testid="connect-code">
              {cmd}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(cmd).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="grid size-9 place-items-center rounded-full hover:bg-ink/10"
              aria-label="copy"
            >
              {copied ? <CheckCircle weight="fill" className="size-5 text-emerald-600" /> : <Copy className="size-5" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">{o.connect.ttl}</p>
        </div>
      )}
    </section>
  );
}
