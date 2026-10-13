import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";
import { addDays, effectiveStatus } from "@khaneyeidea/core";
import { href, isLocale, num, type Locale } from "@/lib/i18n";
import { dayLabel, tehranIso, WEEKDAYS } from "@/lib/jalali";
import { loadSessionDetail, loadWeek, weekStart } from "@/server/sessions";
import { loadCoach } from "@/components/teacher/context";
import { TeacherShell } from "@/components/teacher/shell";
import { SessionItem } from "@/components/teacher/session-item";
import { SessionSheet } from "@/components/teacher/sheet";
import { SessionPanel } from "@/components/ops/session-panel";
import { panelData } from "@/components/ops/panel-data";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function Week({ lang, selected, week: weekParam, day: dayParam }: { lang: Locale; selected: string | null; week: string | null; day: string | null }) {
  const { user, profile, o, t } = await loadCoach(lang);
  if (!profile) {
    return (
      <TeacherShell lang={lang} t={t} active="week">
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{t.profile.noLink}</p>
      </TeacherShell>
    );
  }
  const today = tehranIso(new Date());
  const thisWeek = weekStart(today);
  const start = weekParam && ISO.test(weekParam) ? weekStart(weekParam) : thisWeek;
  const rows = (await loadWeek(user.tenantId, start, {}, profile.id)).map((r) => ({ ...r, status: effectiveStatus(r.s) }));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  // The chosen day: the one in the address, else today if it has classes, else the next day that does.
  const busy = new Set(rows.map((r) => r.day));
  const chosen = dayParam && days.includes(dayParam) ? dayParam : busy.has(today) ? today : (days.find((d) => d >= today && busy.has(d)) ?? rows[0]?.day ?? (days.includes(today) ? today : days[0]!));
  const list = rows.filter((r) => r.day === chosen);

  const base = href(lang, "/teacher/week");
  const link = (p: { w?: string; d?: string; s?: string }) => {
    const q = new URLSearchParams();
    const w = p.w ?? (start === thisWeek ? undefined : start);
    if (w) q.set("w", w);
    if (p.d) q.set("d", p.d);
    if (p.s) q.set("s", p.s);
    return q.size ? `${base}?${q}` : base;
  };

  const detail = selected && z.uuid().safeParse(selected).success ? await loadSessionDetail(selected) : null;
  const panel = detail && detail.s.teacherId === profile.id && detail.s.tenantId === user.tenantId ? panelData(detail, lang, o) : null;
  const nav = "grid size-11 place-items-center rounded-full border border-line transition hover:border-ink/30 active:scale-95";

  return (
    <TeacherShell lang={lang} t={t} active="week">
      <h1 className="font-display text-[1.7rem] font-extrabold leading-tight tracking-tight">{t.weekTitle}</h1>
      <div className="mt-4 flex items-center gap-2">
        <Link href={link({ w: addDays(start, -7) })} aria-label={t.prevWeek} className={nav}>
          <CaretRight className="size-5 ltr:rotate-180" />
        </Link>
        <Link href={base} aria-current={start === thisWeek ? "page" : undefined} className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm text-muted transition aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg">
          {t.thisWeek}
        </Link>
        <Link href={link({ w: addDays(start, 7) })} aria-label={t.nextWeek} className={nav}>
          <CaretLeft className="size-5 ltr:rotate-180" />
        </Link>
        <span className="ms-2 truncate text-sm text-muted">
          {dayLabel(start, lang, { weekday: false })} - {dayLabel(addDays(start, 6), lang, { weekday: false })}
        </span>
      </div>

      <div className="-mx-4 mt-5 overflow-x-auto px-4 pb-1" data-testid="day-chips">
        <div className="flex gap-2" role="tablist" aria-label={t.weekTitle}>
          {days.map((d, i) => {
            const n = rows.filter((r) => r.day === d).length;
            return (
              <Link
                key={d}
                href={link({ d })}
                scroll={false}
                role="tab"
                aria-selected={d === chosen}
                className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-0.5 rounded-2xl border border-line px-3 py-2.5 text-center transition active:scale-95 aria-selected:border-ink aria-selected:bg-ink aria-selected:text-bg"
              >
                <span className="text-xs opacity-75">{WEEKDAYS[lang][i]}</span>
                <span className="font-display text-lg font-extrabold leading-none tabular-nums">{dayLabel(d, lang, { weekday: false }).split(" ")[0]}</span>
                <span className={`mt-1 h-1.5 w-5 rounded-full ${n ? (d === chosen ? "bg-accent" : "bg-accent/70") : "bg-transparent"}`} aria-label={num(n, lang)} />
                {d === today && <span className="sr-only">{o.cb.today}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="mt-6" data-testid="week">
        <h2 className="mb-3 font-display text-lg font-bold">
          {WEEKDAYS[lang][days.indexOf(chosen)]} <span className="text-base font-normal text-muted">{dayLabel(chosen, lang, { weekday: false })}</span>
        </h2>
        {list.length ? (
          <ul className="flex flex-col gap-2.5">
            {list.map((r, i) => (
              <li key={r.s.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                <SessionItem r={r} lang={lang} o={o} to={link({ d: chosen, s: r.s.id })} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-5 text-sm text-muted">{rows.length ? t.noDay : t.noWeek}</p>
        )}
      </section>

      {panel && (
        <SessionSheet closeHref={link({ d: chosen })} closeLabel={o.board.close} title={panel.title} when={panel.when}>
          <SessionPanel key={panel.id} d={panel} o={o} lang={lang} asTeacher />
        </SessionSheet>
      )}
    </TeacherShell>
  );
}

function WeekSkeleton() {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-2xl px-4 pt-20" aria-busy="true">
      <div className="h-8 w-48 rounded-xl bg-ink/[0.08]" />
      <div className="mt-5 flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[4.5rem] w-[4.25rem] shrink-0 rounded-2xl bg-ink/[0.06]" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rise relative mt-3 h-[4.5rem] overflow-hidden rounded-2xl bg-ink/[0.045]" style={{ "--i": i } as React.CSSProperties}>
          <div className="shimmer size-full" style={{ animationDelay: `${i * 160}ms` }} />
        </div>
      ))}
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/[lang]/teacher/week">) {
  return (
    <Suspense fallback={<WeekSkeleton />}>
      {Promise.all([params, searchParams]).then(([{ lang }, sp]) =>
        isLocale(lang) ? <Week lang={lang} selected={typeof sp.s === "string" ? sp.s : null} week={typeof sp.w === "string" ? sp.w : null} day={typeof sp.d === "string" ? sp.d : null} /> : notFound(),
      )}
    </Suspense>
  );
}
