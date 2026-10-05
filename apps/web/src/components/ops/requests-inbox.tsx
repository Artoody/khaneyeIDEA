import { Check, X } from "@phosphor-icons/react/dist/ssr";
import { pick, type Locale } from "@/lib/i18n";
import type { OpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import type { loadPendingRequests } from "@/server/sessions";
import { decideRequest } from "@/app/[lang]/app/session-actions";

type Req = Awaited<ReturnType<typeof loadPendingRequests>>[number];

/**
 * Teachers' cancellation requests. The admin sees the reason, edits the notice that will go to the class group,
 * and approves or declines with one click. Nothing is sent without this approval.
 */
export function RequestsInbox({ rows, lang, o }: { rows: Req[]; lang: Locale; o: OpsDict }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{o.requests.empty}</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid="requests">
      {rows.map(({ r, s, c, teacher, who }) => {
        const day = dayLabel(tehranIso(s.startsAt), lang);
        const msg = fill(o.session.messageDefault, { class: c.title, day, reason: r.reason ? `${r.reason}. ` : "" });
        return (
          <li key={r.id} className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
            <p className="text-sm font-medium">
              {fill(o.requests.by, { name: teacher ? pick(teacher, lang) : (who ?? "") })}
            </p>
            <p className="mt-1 font-display text-base font-bold">{c.title}</p>
            <p className="text-sm text-muted">
              {day} · {timeLabel(s.startsAt, lang)}
            </p>
            <p className="mt-2 text-sm">{r.reason || <span className="text-muted">{o.requests.noReason}</span>}</p>
            <form action={decideRequest} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="requestId" value={r.id} />
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                {o.requests.message}
                <textarea name="message" rows={3} defaultValue={msg} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15" />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  name="decision"
                  value="approve"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-bg transition active:scale-[0.98]"
                >
                  <Check weight="bold" className="size-4" />
                  {o.requests.approve}
                </button>
                <button
                  name="decision"
                  value="reject"
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-5 text-sm transition hover:border-ink/30 active:scale-[0.98]"
                >
                  <X weight="bold" className="size-4" />
                  {o.requests.reject}
                </button>
              </div>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
