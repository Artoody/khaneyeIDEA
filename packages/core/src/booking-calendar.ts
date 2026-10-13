import { and, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { appointments, availabilityExceptions, availabilityTemplates, type getDb } from "@khaneyeidea/db";
import { addDays, generateSlots, isFixedHoliday, tehranDay, weekdaySat0, zonedToUtc, type TemplateLike } from "./booking";

type Db = ReturnType<typeof getDb>;

// The admin's view of booking: open hours painted on a weekly grid, and a calendar of days with who booked what.

const CELL = 30; // the painter works in half hours
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Cell starts ("12:00", "12:30", "13:00") become contiguous ranges ("12:00"-"13:30"). */
export function mergeCells(starts: string[]): { start: string; end: string }[] {
  const mins = [...new Set(starts.filter((s) => HHMM.test(s)).map(toMin))].sort((a, b) => a - b);
  const out: { start: string; end: string }[] = [];
  for (const m of mins) {
    const last = out.at(-1);
    if (last && toMin(last.end) === m) last.end = toHHMM(m + CELL);
    else out.push({ start: toHHMM(m), end: toHHMM(m + CELL) });
  }
  return out;
}

export type PaintInput = {
  appointmentTypeId: string;
  branchId: string | null;
  slotMinutes: number;
  capacity: number;
  /** weekday 0 = Saturday ... 6 = Friday, time = start of a half-hour cell */
  cells: { weekday: number; time: string }[];
};

/**
 * Makes the weekly open hours of one appointment type (and branch) match the painted cells.
 * Only templates made by the painter are touched. A template that already has upcoming bookings is reused when
 * the new hours overlap it, and switched off (never deleted) when they do not, so no booking loses its slot.
 */
export async function paintWindows(db: Db, tenantId: string, input: PaintInput, now = new Date()) {
  const slotMinutes = Math.min(120, Math.max(15, Math.round(input.slotMinutes)));
  const capacity = Math.min(50, Math.max(1, Math.round(input.capacity)));
  const byDay = new Map<number, string[]>();
  for (const c of input.cells) {
    if (!Number.isInteger(c.weekday) || c.weekday < 0 || c.weekday > 6) continue;
    byDay.set(c.weekday, [...(byDay.get(c.weekday) ?? []), c.time]);
  }
  const wanted = [...byDay.entries()].flatMap(([weekday, times]) => mergeCells(times).map((r) => ({ weekday, ...r })));

  return db.transaction(async (tx) => {
    const where = and(
      eq(availabilityTemplates.tenantId, tenantId),
      eq(availabilityTemplates.appointmentTypeId, input.appointmentTypeId),
      eq(availabilityTemplates.painted, true),
      input.branchId ? eq(availabilityTemplates.branchId, input.branchId) : isNull(availabilityTemplates.branchId),
    );
    const existing = await tx.select().from(availabilityTemplates).where(where);
    const free = new Set(existing.map((t) => t.id));
    let created = 0;
    let updated = 0;
    for (const w of wanted) {
      const reuse = existing.find((t) => free.has(t.id) && t.weekdays[0] === w.weekday && toMin(t.startTime) < toMin(w.end) && toMin(w.start) < toMin(t.endTime));
      if (reuse) {
        free.delete(reuse.id);
        await tx.update(availabilityTemplates).set({ startTime: w.start, endTime: w.end, slotMinutes, capacity, active: true, updatedAt: new Date() }).where(eq(availabilityTemplates.id, reuse.id));
        updated++;
      } else {
        await tx.insert(availabilityTemplates).values({
          tenantId,
          appointmentTypeId: input.appointmentTypeId,
          branchId: input.branchId,
          name: "ساعت‌های باز",
          weekdays: [w.weekday],
          startTime: w.start,
          endTime: w.end,
          slotMinutes,
          capacity,
          minLeadHours: 3,
          maxDaysAhead: 45,
          painted: true,
        });
        created++;
      }
    }
    let removed = 0;
    let paused = 0;
    for (const id of free) {
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(appointments)
        .where(and(eq(appointments.templateId, id), gte(appointments.startsAt, now), ne(appointments.status, "canceled")));
      if (n > 0) {
        await tx.update(availabilityTemplates).set({ active: false }).where(eq(availabilityTemplates.id, id));
        paused++;
      } else {
        await tx.delete(availabilityTemplates).where(eq(availabilityTemplates.id, id));
        removed++;
      }
    }
    return { created, updated, removed, paused };
  });
}

/** The painted cells of one appointment type and branch, to draw the grid. */
export async function paintedCells(db: Db, tenantId: string, appointmentTypeId: string, branchId: string | null) {
  const rows = await db
    .select()
    .from(availabilityTemplates)
    .where(
      and(
        eq(availabilityTemplates.tenantId, tenantId),
        eq(availabilityTemplates.appointmentTypeId, appointmentTypeId),
        eq(availabilityTemplates.painted, true),
        eq(availabilityTemplates.active, true),
        branchId ? eq(availabilityTemplates.branchId, branchId) : isNull(availabilityTemplates.branchId),
      ),
    );
  const cells: { weekday: number; time: string }[] = [];
  for (const t of rows) for (let m = toMin(t.startTime); m < toMin(t.endTime); m += CELL) cells.push({ weekday: t.weekdays[0]!, time: toHHMM(m) });
  return { cells, slotMinutes: rows[0]?.slotMinutes ?? 60, capacity: rows[0]?.capacity ?? 1 };
}

export type CalendarBooking = { id: string; status: string; guardian: string | null; child: string | null; age: number | null; phone: string };
export type CalendarSlot = { templateId: string; startsAt: Date; endsAt: Date; time: string; capacity: number; remaining: number; bookings: CalendarBooking[] };
export type CalendarDay = { day: string; slots: CalendarSlot[]; closed: boolean };

/**
 * Every day from `from` to `to` (Tehran calendar days) that has open slots or is closed, with the bookings of each
 * slot. Today's earlier slots are included, the lead time is not applied: this is for staff, not for families.
 */
export async function calendarRange(
  db: Db,
  tenantId: string,
  q: { appointmentTypeId: string; branchId?: string | null | "any"; from: string; to: string },
  now = new Date(),
): Promise<CalendarDay[]> {
  const where = and(
    eq(availabilityTemplates.tenantId, tenantId),
    eq(availabilityTemplates.appointmentTypeId, q.appointmentTypeId),
    eq(availabilityTemplates.active, true),
    q.branchId === undefined || q.branchId === "any" ? undefined : q.branchId ? eq(availabilityTemplates.branchId, q.branchId) : isNull(availabilityTemplates.branchId),
  );
  const templates = await db.select().from(availabilityTemplates).where(where);
  if (!templates.length) return [];
  const today = tehranDay(now);
  const startOfToday = zonedToUtc(today, "00:00");
  const horizon = Math.max(0, Math.round((Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000));

  const exceptions = await db
    .select()
    .from(availabilityExceptions)
    .where(and(eq(availabilityExceptions.tenantId, tenantId), gte(availabilityExceptions.date, q.from), sql`${availabilityExceptions.date} <= ${q.to}`));
  const ids = templates.map((t) => t.id);
  const bookingRows = await db
    .select()
    .from(appointments)
    .where(and(inArray(appointments.templateId, ids), gte(appointments.startsAt, startOfToday), ne(appointments.status, "canceled")));
  const byKey = new Map<string, CalendarBooking[]>();
  for (const a of bookingRows) {
    const key = `${a.templateId}|${a.startsAt.getTime()}`;
    byKey.set(key, [...(byKey.get(key) ?? []), { id: a.id, status: a.status, guardian: a.guardianName, child: a.childFirstName, age: a.childAge, phone: a.phone }]);
  }

  const days = new Map<string, CalendarDay>();
  const dayOf = (day: string) => {
    if (!days.has(day)) days.set(day, { day, slots: [], closed: false });
    return days.get(day)!;
  };
  for (const t of templates) {
    const closedHere = new Set(exceptions.filter((e) => (e.templateId ? e.templateId === t.id : e.branchId ? e.branchId === t.branchId : true)).map((e) => e.date));
    const like: TemplateLike = { ...t, minLeadHours: 0, maxDaysAhead: horizon };
    // slots of days that are open
    for (const s of generateSlots(like, { now: startOfToday, closedDays: closedHere, booked: new Map() })) {
      if (s.day < q.from || s.day > q.to) continue;
      const bookings = byKey.get(`${t.id}|${s.startsAt.getTime()}`) ?? [];
      dayOf(s.day).slots.push({ templateId: t.id, startsAt: s.startsAt, endsAt: s.endsAt, time: s.time, capacity: t.capacity, remaining: Math.max(0, t.capacity - bookings.length), bookings });
    }
    // days that would have had slots but are closed
    for (let d = q.from; d <= q.to; d = addDays(d, 1)) {
      if (d < today) continue;
      if (!t.weekdays.includes(weekdaySat0(d))) continue;
      if (t.validFrom && d < t.validFrom) continue;
      if (t.validUntil && d > t.validUntil) continue;
      if (closedHere.has(d) || isFixedHoliday(d)) dayOf(d).closed = true;
    }
  }
  return [...days.values()].map((d) => ({ ...d, slots: d.slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()) })).sort((a, b) => a.day.localeCompare(b.day));
}
