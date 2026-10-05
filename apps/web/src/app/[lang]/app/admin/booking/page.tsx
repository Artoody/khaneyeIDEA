import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { CalendarBlank, Phone } from "@phosphor-icons/react/dist/ssr";
import { appointments, appointmentTypes, branches, courses, getDb } from "@khaneyeidea/db";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict, type AdminDict } from "@/lib/admin-i18n";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader } from "@/components/admin/ui";
import { setBookingStatus } from "./actions";

const TABS = ["upcoming", "past", "canceled"] as const;
type Tab = (typeof TABS)[number];

const localPhone = (p: string) => `0${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8)}`;
const tone = { booked: "accent", confirmed: "success", attended: "success", no_show: "muted", canceled: "muted" } as const;
const ACTIONS: Record<string, string[]> = {
  booked: ["confirmed", "canceled"],
  confirmed: ["attended", "no_show", "canceled"],
  attended: [],
  no_show: [],
  canceled: [],
};

function StatusButtons({ id, status, a, past }: { id: string; status: string; a: AdminDict; past: boolean }) {
  // Before the meeting: confirm or cancel. After it: came / no-show.
  const list = past ? (status === "booked" || status === "confirmed" ? ["attended", "no_show"] : []) : ACTIONS[status] ?? [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((s) => (
        <form key={s} action={setBookingStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={s} />
          <button
            className={`h-9 rounded-full border px-3.5 text-sm transition active:scale-[0.98] ${
              s === "canceled" ? "border-line text-red-500 hover:border-red-500/50" : s === "confirmed" || s === "attended" ? "border-accent/60 bg-accent/15 hover:bg-accent/25" : "border-line hover:border-ink/30"
            }`}
          >
            {a.booking.actions[s === "confirmed" ? "confirm" : s === "canceled" ? "cancel" : s]}
          </button>
        </form>
      ))}
    </div>
  );
}

async function Board({ lang, tab }: { lang: Locale; tab: Tab }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const t = a.booking;
  const now = new Date();
  const where = and(
    eq(appointments.tenantId, user.tenantId),
    tab === "canceled" ? eq(appointments.status, "canceled") : ne(appointments.status, "canceled"),
    tab === "upcoming" ? gte(appointments.endsAt, now) : tab === "past" ? lt(appointments.endsAt, now) : undefined,
  );
  const rows = await getDb()
    .select({ ap: appointments, type: appointmentTypes.title, branch: branches.name, course: courses.title })
    .from(appointments)
    .innerJoin(appointmentTypes, eq(appointmentTypes.id, appointments.appointmentTypeId))
    .leftJoin(branches, eq(branches.id, appointments.branchId))
    .leftJoin(courses, eq(courses.id, appointments.courseId))
    .where(where)
    .orderBy(tab === "upcoming" ? asc(appointments.startsAt) : desc(appointments.startsAt))
    .limit(300);

  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = tehranIso(r.ap.startsAt);
    days.set(d, [...(days.get(d) ?? []), r]);
  }
  const today = tehranIso(now);
  const base = href(lang, "/app/admin/booking");

  return (
    <>
      <PageHeader title={t.navBookings} />
      <nav className="mb-6 flex gap-1.5" aria-label={t.navBookings}>
        {TABS.map((x) => (
          <Link
            key={x}
            href={x === "upcoming" ? base : `${base}?tab=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className="rounded-full border border-line px-4 py-1.5 text-sm text-muted transition hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg"
          >
            {t[x]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <div className="flex max-w-xl flex-col items-start gap-2 rounded-[var(--radius-card)] border border-dashed border-line p-8">
          <CalendarBlank weight="duotone" className="size-8 text-accent-text" />
          <p className="font-medium">{t.noBookings}</p>
          <p className="text-sm text-muted">{t.noBookingsHelp}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {[...days].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                {dayLabel(day, lang)}
                {day === today && <Badge tone="accent">{lang === "fa" ? "امروز" : "Today"}</Badge>}
                <span className="text-sm font-normal text-muted">({num(list.length, lang)})</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                {list.map(({ ap, type, branch, course }) => (
                  <li key={ap.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[6rem_1fr_auto] lg:items-center" data-testid="booking-row">
                    <div className="font-display text-xl font-extrabold tabular-nums">{timeLabel(ap.startsAt, lang)}</div>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {pick(type, lang)}
                        {course && <span className="text-muted"> · {pick(course, lang)}</span>}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <span>{branch ? pick(branch, lang) : t.online}</span>
                        {(ap.childFirstName || ap.childAge) && (
                          <span>
                            {t.child}: {ap.childFirstName ?? ""} {ap.childAge ? `${num(ap.childAge, lang)} ${t.age}` : ""}
                          </span>
                        )}
                        {ap.guardianName && (
                          <span>
                            {t.guardian}: {ap.guardianName}
                          </span>
                        )}
                        <a href={`tel:+${ap.phone}`} className="inline-flex items-center gap-1 text-ink hover:text-accent-text" dir="ltr">
                          <Phone className="size-4" />
                          {num(localPhone(ap.phone), lang)}
                        </a>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone={tone[ap.status]}>{t.status[ap.status]}</Badge>
                        <Badge tone="neutral">{t.source[ap.source]}</Badge>
                      </div>
                      {ap.note && <p className="mt-2 text-sm text-ink/80">{ap.note}</p>}
                    </div>
                    <StatusButtons id={ap.id} status={ap.status} a={a} past={ap.endsAt < now} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/booking">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      {searchParams.then(({ tab }) => (
        <Board lang={lang} tab={TABS.find((x) => x === tab) ?? "upcoming"} />
      ))}
    </Suspense>
  );
}
