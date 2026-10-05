import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { CaretLeft, CaretRight, UsersThree, X } from "@phosphor-icons/react/dist/ssr";
import { branches, getDb, teachers } from "@khaneyeidea/db";
import { addDays, effectiveStatus } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { dayLabel, tehranIso, timeLabel, WEEKDAYS } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { loadPendingRequests, loadSessionDetail, loadWeek, weekStart } from "@/server/sessions";
import { RequestsInbox } from "@/components/ops/requests-inbox";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { SessionPanel } from "@/components/ops/session-panel";
import { panelData, STATUS_DOT, STATUS_STYLE } from "@/components/ops/panel-data";
import { AutoSubmitSelect } from "@/components/ops/auto-submit";

type Q = { w?: string; s?: string; t?: string; b?: string; st?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_ORDER = ["held", "awaiting_teacher", "held_incomplete", "scheduled", "cancel_planned", "not_held", "needs_makeup"];

async function Board({ lang, q }: { lang: Locale; q: Q }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const o = getOpsDict(lang);
  const today = tehranIso(new Date());
  const thisWeek = weekStart(today);
  const start = q.w && ISO.test(q.w) ? weekStart(q.w) : thisWeek;
  const teacherId = q.t && z.uuid().safeParse(q.t).success ? q.t : null;
  const branchId = q.b && z.uuid().safeParse(q.b).success ? q.b : null;
  const db = getDb();
  const [rows, ts, bs, requests] = await Promise.all([
    loadWeek(user.tenantId, start, { teacherId, branchId }),
    db.select().from(teachers).where(eq(teachers.tenantId, user.tenantId)).orderBy(asc(teachers.sortOrder)),
    db.select().from(branches).where(eq(branches.tenantId, user.tenantId)).orderBy(asc(branches.sortOrder)),
    loadPendingRequests(user.tenantId),
  ]);
  const requested = new Set(requests.map((r) => r.s.id));
  const withStatus = rows.map((r) => ({ ...r, status: effectiveStatus(r.s) }));
  const counts = new Map<string, number>();
  for (const r of withStatus) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const shown = q.st ? withStatus.filter((r) => r.status === q.st) : withStatus;

  const base = href(lang, "/app/admin/sessions");
  const link = (patch: Partial<Q>) => {
    const p = new URLSearchParams();
    const next = { w: start, t: teacherId ?? undefined, b: branchId ?? undefined, st: q.st, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `${base}?${p.toString()}`;
  };
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  // Drawer for the selected session (tenant-checked inside loadSessionDetail's caller).
  const selected = q.s && z.uuid().safeParse(q.s).success ? await loadSessionDetail(q.s) : null;
  const panel = selected && selected.s.tenantId === user.tenantId ? panelData(selected, lang, o) : null;

  const quick = [
    { w: thisWeek, label: o.board.thisWeek },
    { w: addDays(thisWeek, 7), label: o.board.nextWeek },
    { w: addDays(thisWeek, 14), label: o.board.afterNext },
  ];
  return (
    <>
      <PageHeader title={o.nav.sessions} />
      {requests.length > 0 && (
        <section className="mb-6 rounded-[var(--radius-card)] border border-accent/40 bg-accent/5 p-5">
          <h2 className="mb-3 font-display text-lg font-bold">{o.requests.title}</h2>
          <RequestsInbox rows={requests} lang={lang} o={o} />
        </section>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={link({ w: addDays(start, -7) })} aria-label={o.board.prev} className="grid size-10 place-items-center rounded-full border border-line hover:border-ink/30">
          <CaretRight className="size-4 ltr:rotate-180" />
        </Link>
        {quick.map((x) => (
          <Link
            key={x.w}
            href={link({ w: x.w })}
            aria-current={x.w === start ? "page" : undefined}
            className="h-10 rounded-full border border-line px-4 text-sm leading-10 text-muted transition hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg"
          >
            {x.label}
          </Link>
        ))}
        <Link href={link({ w: addDays(start, 7) })} aria-label={o.board.next} className="grid size-10 place-items-center rounded-full border border-line hover:border-ink/30">
          <CaretLeft className="size-4 ltr:rotate-180" />
        </Link>
        <span className="ms-2 text-sm text-muted">
          {dayLabel(start, lang, { weekday: false })} - {dayLabel(addDays(start, 6), lang, { weekday: false, year: true })}
        </span>
        <form action={base} className="ms-auto flex flex-wrap gap-2">
          <input type="hidden" name="w" value={start} />
          <AutoSubmitSelect name="t" defaultValue={teacherId ?? ""} aria-label={o.board.teacher} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
            <option value="">{o.board.teacher}: {o.board.all}</option>
            {ts.map((t) => (
              <option key={t.id} value={t.id}>
                {pick(t.name, lang)}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="b" defaultValue={branchId ?? ""} aria-label={o.board.branch} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
            <option value="">{o.board.branch}: {o.board.all}</option>
            {bs.map((b) => (
              <option key={b.id} value={b.id}>
                {pick(b.name, lang)}
              </option>
            ))}
          </AutoSubmitSelect>
        </form>
      </div>

      {/* Summary bar: each count filters the board */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm" data-testid="summary">
        <Link href={link({ st: undefined })} className={`rounded-full px-3 py-1.5 ${!q.st ? "bg-ink text-bg" : "bg-ink/5"}`}>
          {fill(o.board.total, { n: num(withStatus.length, lang) })}
        </Link>
        {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
          <Link key={s} href={link({ st: q.st === s ? undefined : s })} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${q.st === s ? "bg-ink text-bg" : "bg-ink/5"}`}>
            <span className={`size-2 rounded-full ${STATUS_DOT[s]}`} />
            {num(counts.get(s)!, lang)} {o.status[s]}
          </Link>
        ))}
      </div>

      {withStatus.length === 0 ? (
        <div className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-8">
          <p className="font-medium">{o.board.empty}</p>
          <p className="mt-1 text-sm text-muted">{o.board.emptyHelp}</p>
        </div>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0" data-testid="board">
          {days.map((day, i) => {
            const list = shown.filter((r) => r.day === day);
            return (
              <section key={day} className="w-[78vw] max-w-xs shrink-0 snap-start sm:w-64 lg:w-auto lg:max-w-none">
                <h2 className={`mb-2 flex items-baseline justify-between rounded-xl px-2 py-1.5 text-sm ${day === today ? "bg-accent/15 font-semibold" : "text-muted"}`}>
                  <span>{WEEKDAYS[lang][i]}</span>
                  <span className="tabular-nums">{dayLabel(day, lang, { weekday: false })}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {list.map((r) => (
                    <li key={r.s.id}>
                      <Link
                        href={link({ s: r.s.id })}
                        scroll={false}
                        className={`block rounded-2xl border p-3 text-sm transition hover:-translate-y-0.5 ${STATUS_STYLE[r.status]} ${q.s === r.s.id ? "ring-2 ring-accent" : ""}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold tabular-nums">{timeLabel(r.s.startsAt, lang)}</span>
                          <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[r.status]}`} title={o.status[r.status]} />
                        </span>
                        <span className="title mt-1 block font-medium leading-snug">{r.c.title}</span>
                        {(requested.has(r.s.id) || r.s.custom) && (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {requested.has(r.s.id) && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">{o.requests.badge}</span>}
                            {r.s.makeupOfSessionId || (r.s.custom && !r.s.originalStartsAt) ? (
                              <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px]">{o.move.makeupOf}</span>
                            ) : r.s.custom ? (
                              <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px]">{o.move.moved_tag}</span>
                            ) : null}
                          </span>
                        )}
                        <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                          <span className="truncate">{r.teacher ? pick(r.teacher, lang) : o.classes.noTeacher}</span>
                          <span className="inline-flex shrink-0 items-center gap-1">
                            <UsersThree className="size-3.5" />
                            {num(r.students, lang)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {panel && (
        <>
          <Link href={link({ s: undefined })} scroll={false} aria-label={o.board.close} className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]" />
          <aside className="fixed inset-y-0 end-0 z-50 flex w-full flex-col overflow-y-auto border-s border-line bg-bg shadow-2xl sm:w-[30rem]" data-testid="session-panel">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-bg/95 p-5 backdrop-blur">
              <div>
                <h2 className="font-display text-xl font-extrabold">{panel.title}</h2>
                <p className="mt-1 text-sm text-muted">{panel.when}</p>
                <p className="text-sm text-muted">{panel.place}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs">
                  <span className={`size-2 rounded-full ${STATUS_DOT[panel.status]}`} />
                  {o.status[panel.status]}
                </span>
              </div>
              <Link href={link({ s: undefined })} scroll={false} aria-label={o.board.close} className="grid size-10 place-items-center rounded-full hover:bg-ink/5">
                <X className="size-5" />
              </Link>
            </header>
            <div className="p-5">
              <SessionPanel key={panel.id} d={panel} o={o} lang={lang} asTeacher={false} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/sessions">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      {searchParams.then((sp) => {
        const q = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, typeof v === "string" ? v : undefined])) as Q;
        return <Board lang={lang} q={q} />;
      })}
    </Suspense>
  );
}
