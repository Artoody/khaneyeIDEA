"use client";

import { useActionState, useState } from "react";
import { ArrowSquareOut, CheckCircle, Copy, CircleNotch, Monitor, TelegramLogo, ChatCircleDots } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { createClassCode, unlinkClassGroup, type SessionState } from "@/app/[lang]/app/session-actions";

type Props = {
  o: OpsDict;
  classGroupId: string;
  linked: ("bale" | "telegram")[];
  invites: { bale: string | null; telegram: string | null };
  onlineUrl: string | null;
};

const row = "flex items-center gap-3 rounded-2xl border border-line bg-bg px-3.5 py-3";

/** The class's Bale and Telegram groups: bot connection status, the code to connect, invite links, the online room. */
export function ClassGroups({ o, classGroupId, linked, invites, onlineUrl }: Props) {
  const [state, create, pending] = useActionState<SessionState, FormData>(createClassCode, {});
  const [copied, setCopied] = useState(false);
  const cmd = state.code ? `/link ${state.code}` : null;
  const channels = [
    { key: "bale" as const, label: o.groups.bale, icon: ChatCircleDots },
    { key: "telegram" as const, label: o.groups.telegram, icon: TelegramLogo },
  ];
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6" data-testid="groups">
      <h2 className="font-display text-lg font-bold">{o.groups.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{o.groups.help}</p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {channels.map(({ key, label, icon: Icon }) => {
          const on = linked.includes(key);
          const invite = invites[key];
          return (
            <li key={key} className={row}>
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-ink/5 text-muted"}`}>
                <Icon weight="duotone" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className={`block text-xs ${on ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}`}>{on ? o.groups.connected : o.groups.notConnected}</span>
              </span>
              {invite ? (
                <a href={invite} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm hover:border-ink/30">
                  <ArrowSquareOut className="size-4" />
                  {o.groups.open}
                </a>
              ) : (
                <span className="text-xs text-muted">{o.groups.none}</span>
              )}
              {on && (
                <form action={unlinkClassGroup}>
                  <input type="hidden" name="classGroupId" value={classGroupId} />
                  <input type="hidden" name="channel" value={key} />
                  <button className="h-9 rounded-full px-3 text-xs text-muted hover:bg-red-500/10 hover:text-red-500">{o.classes.remove}</button>
                </form>
              )}
            </li>
          );
        })}
        <li className={row}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${onlineUrl ? "bg-accent/15 text-accent-text" : "bg-ink/5 text-muted"}`}>
            <Monitor weight="duotone" className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium">{o.groups.online}</span>
          {onlineUrl ? (
            <a href={onlineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm hover:border-ink/30">
              <ArrowSquareOut className="size-4" />
              {o.groups.open}
            </a>
          ) : (
            <span className="text-xs text-muted">{o.groups.none}</span>
          )}
        </li>
      </ul>
      <form action={create} className="mt-4">
        <input type="hidden" name="classGroupId" value={classGroupId} />
        <button disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-bg transition active:scale-[0.98] disabled:opacity-60">
          {pending && <CircleNotch className="size-4 animate-spin" />}
          {o.groups.connect}
        </button>
      </form>
      {cmd && (
        <div className="mt-4 rounded-2xl bg-ink/5 p-4" role="status">
          <p className="text-sm text-muted">{o.groups.codeHelp}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <code className="font-mono text-lg font-bold tracking-wider" dir="ltr" data-testid="class-code">
              {cmd}
            </code>
            <button
              type="button"
              aria-label="copy"
              onClick={() => {
                void navigator.clipboard?.writeText(cmd).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="grid size-9 place-items-center rounded-full hover:bg-ink/10"
            >
              {copied ? <CheckCircle weight="fill" className="size-5 text-emerald-600" /> : <Copy className="size-5" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">{o.groups.codeTtl}</p>
        </div>
      )}
    </section>
  );
}
