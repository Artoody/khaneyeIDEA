import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { appointmentTypes, branches, getDb } from "@khaneyeidea/db";
import { addDays, calendarRange, paintedCells } from "@khaneyeidea/core";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { tehranIso } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { ClassesSkeleton, PageHeader } from "@/components/admin/ui";
import { AvailabilityEditor, type DayDTO } from "./availability-editor";

const chip = "inline-flex h-11 shrink-0 items-center rounded-full border border-line px-5 text-sm transition hover:border-ink/30 aria-[current=true]:border-ink aria-[current=true]:bg-ink aria-[current=true]:text-bg active:scale-[0.98]";

async function Calendar({ lang, typeParam, branchParam }: { lang: Locale; typeParam: string | null; branchParam: string | null }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const o = getOpsDict(lang);
  const b = o.bkc;
  const a = getAdminDict(lang);
  const db = getDb();
  const [types, places] = await Promise.all([
    db.select().from(appointmentTypes).where(and(eq(appointmentTypes.tenantId, user.tenantId), eq(appointmentTypes.active, true))).orderBy(asc(appointmentTypes.sortOrder)),
    db.select().from(branches).where(and(eq(branches.tenantId, user.tenantId), eq(branches.active, true))).orderBy(asc(branches.sortOrder)),
  ]);
  const base = href(lang, "/app/admin/booking/calendar");
  if (!types.length) {
    return (
      <>
        <PageHeader title={b.title} description={b.help} />
        <p className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{b.typesEmpty}</p>
      </>
    );
  }
  const type = types.find((t) => t.id === typeParam) ?? types[0]!;
  const branch = branchParam === "remote" ? null : (places.find((p) => p.id === branchParam) ?? (type.place === "in_person" ? (places[0] ?? null) : null));
  const branchId = branch?.id ?? null;
  const link = (t: string, br: string | null) => `${base}?t=${t}&b=${br ?? "remote"}`;

  const today = tehranIso(new Date());
  const [painted, range] = await Promise.all([
    paintedCells(db, user.tenantId, type.id, branchId),
    calendarRange(db, user.tenantId, { appointmentTypeId: type.id, branchId, from: today, to: addDays(today, 90) }),
  ]);
  const days: DayDTO[] = range.map((d) => ({
    day: d.day,
    closed: d.closed,
    slots: d.slots.map((s) => ({ templateId: s.templateId, startsAt: s.startsAt.toISOString(), capacity: s.capacity, remaining: s.remaining, bookings: s.bookings })),
  }));

  return (
    <>
      <PageHeader title={b.title} description={b.help} />
      <div className="mb-6 flex flex-col gap-4">
        {types.length > 1 && (
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={b.type}>
            <span className="me-1 shrink-0 text-sm font-medium">{b.type}</span>
            {types.map((t) => (
              <Link key={t.id} href={link(t.id, branchId)} aria-current={t.id === type.id} className={chip}>
                {pick(t.title, lang)}
              </Link>
            ))}
          </div>
        )}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={b.branch}>
          <span className="me-1 shrink-0 text-sm font-medium">{b.branch}</span>
          {places.map((p) => (
            <Link key={p.id} href={link(type.id, p.id)} aria-current={p.id === branchId} className={chip}>
              {pick(p.district, lang) || pick(p.name, lang)}
            </Link>
          ))}
          <Link href={link(type.id, null)} aria-current={branchId === null} className={chip}>
            {b.remote}
          </Link>
        </div>
      </div>
      <AvailabilityEditor
        key={`${type.id}|${branchId}`}
        lang={lang}
        b={b}
        typeId={type.id}
        branchId={branchId}
        initial={painted}
        days={days}
        today={today}
        statusLabels={a.booking.status}
        actionLabels={a.booking.actions}
      />
      <p className="mt-10 text-sm text-muted">
        <Link href={href(lang, "/app/admin/booking/templates")} className="underline underline-offset-4 hover:text-ink">
          {b.advanced}
        </Link>
      </p>
    </>
  );
}

export default function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/booking/calendar">) {
  return (
    <Suspense fallback={<ClassesSkeleton />}>
      {Promise.all([params, searchParams]).then(([{ lang }, sp]) =>
        isLocale(lang) ? <Calendar lang={lang} typeParam={typeof sp.t === "string" ? sp.t : null} branchParam={typeof sp.b === "string" ? sp.b : null} /> : notFound(),
      )}
    </Suspense>
  );
}
