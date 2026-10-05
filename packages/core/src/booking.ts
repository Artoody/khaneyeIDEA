import { and, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import { appointments, appointmentTypes, availabilityExceptions, availabilityTemplates, type getDb } from "@khaneyeidea/db";
import { normalizeIranMobile } from "./phone";

type Db = ReturnType<typeof getDb>;
type Reader = Pick<Db, "select">;

// Booking engine. Admins define recurring templates; this module turns them into concrete slots in
// Asia/Tehran time and books them with capacity enforced inside a transaction.

export const TZ = "Asia/Tehran";
/** One phone can hold at most this many upcoming bookings (anti-abuse, real families rarely need more). */
export const MAX_ACTIVE_PER_PHONE = 3;

/**
 * Official holidays fixed in the solar (Jalali) calendar, as "month-day". Lunar holidays move every year,
 * so the admin adds those as closed days.
 */
export const FIXED_HOLIDAYS = new Set(["1-1", "1-2", "1-3", "1-4", "1-12", "1-13", "3-14", "3-15", "11-22", "12-29"]);

// ---------- time helpers (calendar days are "YYYY-MM-DD" strings in Tehran) ----------

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const jalaliFmt = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { timeZone: "UTC", month: "numeric", day: "numeric" });

function zoneParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year!, mo: +p.month!, d: +p.day!, h: +p.hour!, mi: +p.minute!, s: +p.second! };
}
function offsetMs(d: Date) {
  const p = zoneParts(d);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

/** The instant of a Tehran wall-clock time. */
export function zonedToUtc(day: string, hhmm: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMs(new Date(guess));
  const second = offsetMs(new Date(t));
  if (guess - second !== t) t = guess - second;
  return new Date(t);
}

/** The Tehran calendar day of an instant. */
export function tehranDay(d: Date): string {
  const p = zoneParts(d);
  return `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Saturday ... 6 = Friday. */
export function weekdaySat0(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1) % 7;
}

export function isFixedHoliday(day: string): boolean {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const p = Object.fromEntries(jalaliFmt.formatToParts(new Date(Date.UTC(y, m - 1, d, 12))).map((x) => [x.type, x.value]));
  return FIXED_HOLIDAYS.has(`${p.month}-${p.day}`);
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// ---------- slot generation (pure) ----------

export type TemplateLike = {
  id: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacity: number;
  minLeadHours: number;
  maxDaysAhead: number;
  validFrom: string | null;
  validUntil: string | null;
};

export type Slot = { templateId: string; day: string; time: string; startsAt: Date; endsAt: Date; remaining: number; capacity: number };

/**
 * Concrete slots of one template from today (Tehran) through maxDaysAhead days.
 * Skips other weekdays, days outside the valid range, closed days, fixed holidays and slots inside the lead time.
 */
export function generateSlots(t: TemplateLike, opts: { now: Date; closedDays?: Set<string>; booked?: Map<number, number> }): Slot[] {
  const out: Slot[] = [];
  const earliest = opts.now.getTime() + t.minLeadHours * 3_600_000;
  const today = tehranDay(opts.now);
  const start = toMin(t.startTime);
  const end = toMin(t.endTime);
  if (t.slotMinutes <= 0 || end <= start) return out;
  for (let i = 0; i <= t.maxDaysAhead; i++) {
    const day = addDays(today, i);
    if (t.validFrom && day < t.validFrom) continue;
    if (t.validUntil && day > t.validUntil) continue;
    if (!t.weekdays.includes(weekdaySat0(day))) continue;
    if (opts.closedDays?.has(day) || isFixedHoliday(day)) continue;
    for (let m = start; m + t.slotMinutes <= end; m += t.slotMinutes) {
      const time = toHHMM(m);
      const startsAt = zonedToUtc(day, time);
      if (startsAt.getTime() < earliest) continue;
      const taken = opts.booked?.get(startsAt.getTime()) ?? 0;
      out.push({
        templateId: t.id,
        day,
        time,
        startsAt,
        endsAt: new Date(startsAt.getTime() + t.slotMinutes * 60_000),
        remaining: Math.max(0, t.capacity - taken),
        capacity: t.capacity,
      });
    }
  }
  return out;
}

/** Which templates fit what the family asked for. Unset template fields mean "any". */
export function templateFits(
  t: { ageMin: number | null; ageMax: number | null; courseId: string | null; departmentId: string | null; branchId: string | null },
  q: { age?: number | null; courseId?: string | null; departmentId?: string | null; branchId?: string | null },
): boolean {
  if (q.age != null && ((t.ageMin != null && q.age < t.ageMin) || (t.ageMax != null && q.age > t.ageMax))) return false;
  if (q.courseId && t.courseId && t.courseId !== q.courseId) return false;
  if (q.departmentId && t.departmentId && t.departmentId !== q.departmentId) return false;
  if (q.branchId !== undefined && q.branchId !== null && t.branchId !== q.branchId) return false;
  return true;
}

// ---------- database ----------

type TemplateRow = typeof availabilityTemplates.$inferSelect;
const asLike = (t: TemplateRow): TemplateLike => t;

async function closedDaysFor(db: Reader, tenantId: string, templates: TemplateRow[], from: string, to: string) {
  const rows = await db
    .select()
    .from(availabilityExceptions)
    .where(and(eq(availabilityExceptions.tenantId, tenantId), gte(availabilityExceptions.date, from), sql`${availabilityExceptions.date} <= ${to}`));
  const byTemplate = new Map<string, Set<string>>();
  for (const t of templates) {
    const set = new Set<string>();
    for (const e of rows) {
      const applies = e.templateId ? e.templateId === t.id : e.branchId ? e.branchId === t.branchId : true;
      if (applies) set.add(e.date);
    }
    byTemplate.set(t.id, set);
  }
  return byTemplate;
}

async function bookedCounts(db: Db, templateIds: string[], from: Date) {
  const map = new Map<string, Map<number, number>>();
  if (!templateIds.length) return map;
  const rows = await db
    .select({ templateId: appointments.templateId, startsAt: appointments.startsAt, n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(inArray(appointments.templateId, templateIds), gte(appointments.startsAt, from), ne(appointments.status, "canceled")))
    .groupBy(appointments.templateId, appointments.startsAt);
  for (const r of rows) {
    if (!r.templateId) continue;
    if (!map.has(r.templateId)) map.set(r.templateId, new Map());
    map.get(r.templateId)!.set(r.startsAt.getTime(), r.n);
  }
  return map;
}

export type OpenSlot = Slot & { branchId: string | null; templateName: string };

/** Open slots for an appointment type that fit the request, sorted by time. */
export async function findSlots(
  db: Db,
  tenantId: string,
  q: { appointmentTypeId: string; age?: number | null; courseId?: string | null; departmentId?: string | null; branchId?: string | null },
  now = new Date(),
): Promise<OpenSlot[]> {
  const templates = (
    await db
      .select({ t: availabilityTemplates })
      .from(availabilityTemplates)
      .innerJoin(appointmentTypes, eq(appointmentTypes.id, availabilityTemplates.appointmentTypeId))
      .where(
        and(
          eq(availabilityTemplates.tenantId, tenantId),
          eq(availabilityTemplates.appointmentTypeId, q.appointmentTypeId),
          eq(availabilityTemplates.active, true),
          eq(appointmentTypes.active, true),
        ),
      )
  )
    .map((r) => r.t)
    .filter((t) => templateFits(t, q));
  if (!templates.length) return [];
  const today = tehranDay(now);
  const horizon = addDays(today, Math.max(...templates.map((t) => t.maxDaysAhead)));
  const [closed, booked] = await Promise.all([
    closedDaysFor(db, tenantId, templates, today, horizon),
    bookedCounts(db, templates.map((t) => t.id), now),
  ]);
  return templates
    .flatMap((t) =>
      generateSlots(asLike(t), { now, closedDays: closed.get(t.id), booked: booked.get(t.id) }).map((s) => ({ ...s, branchId: t.branchId, templateName: t.name })),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export type BookInput = {
  templateId: string;
  startsAt: Date;
  phone: string;
  guardianName?: string | null;
  childFirstName?: string | null;
  childAge?: number | null;
  courseId?: string | null;
  note?: string | null;
  source?: (typeof appointments.$inferInsert)["source"];
  userId?: string | null;
};
export type BookResult =
  | { ok: true; appointment: typeof appointments.$inferSelect }
  | { ok: false; reason: "invalid_phone" | "slot_unavailable" | "full" | "duplicate" | "too_many" };

/**
 * Books one seat. The slot is re-derived from the template (so only real, open slots can be booked) and the
 * seat count is checked under a per-slot advisory lock, so two parents cannot take the last seat at once.
 */
export async function bookSlot(db: Db, tenantId: string, input: BookInput, now = new Date()): Promise<BookResult> {
  const phone = normalizeIranMobile(input.phone);
  if (!phone) return { ok: false, reason: "invalid_phone" };
  const startMs = input.startsAt.getTime();
  if (!Number.isFinite(startMs)) return { ok: false, reason: "slot_unavailable" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${input.templateId}|${startMs}`}, 0))`);
    const [t] = await tx
      .select({ t: availabilityTemplates, typeActive: appointmentTypes.active })
      .from(availabilityTemplates)
      .innerJoin(appointmentTypes, eq(appointmentTypes.id, availabilityTemplates.appointmentTypeId))
      .where(and(eq(availabilityTemplates.id, input.templateId), eq(availabilityTemplates.tenantId, tenantId)));
    if (!t || !t.t.active || !t.typeActive) return { ok: false as const, reason: "slot_unavailable" as const };
    const tpl = t.t;

    const day = tehranDay(input.startsAt);
    const closed = (await closedDaysFor(tx, tenantId, [tpl], day, day)).get(tpl.id);
    const [{ n: taken } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.templateId, tpl.id), eq(appointments.startsAt, input.startsAt), ne(appointments.status, "canceled")));
    const slot = generateSlots(asLike(tpl), { now, closedDays: closed, booked: new Map([[startMs, taken]]) }).find(
      (s) => s.startsAt.getTime() === startMs,
    );
    if (!slot) return { ok: false as const, reason: "slot_unavailable" as const };
    if (slot.remaining <= 0) return { ok: false as const, reason: "full" as const };

    const mine = await tx
      .select({ templateId: appointments.templateId, startsAt: appointments.startsAt })
      .from(appointments)
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.phone, phone), gte(appointments.startsAt, now), ne(appointments.status, "canceled")));
    if (mine.some((m) => m.templateId === tpl.id && m.startsAt.getTime() === startMs)) return { ok: false as const, reason: "duplicate" as const };
    if (mine.length >= MAX_ACTIVE_PER_PHONE) return { ok: false as const, reason: "too_many" as const };

    const [appointment] = await tx
      .insert(appointments)
      .values({
        tenantId,
        templateId: tpl.id,
        appointmentTypeId: tpl.appointmentTypeId,
        branchId: tpl.branchId,
        courseId: input.courseId ?? tpl.courseId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        phone,
        guardianName: input.guardianName?.trim().slice(0, 80) || null,
        childFirstName: input.childFirstName?.trim().slice(0, 40) || null,
        childAge: input.childAge ?? null,
        note: input.note?.trim().slice(0, 500) || null,
        source: input.source ?? "site",
        userId: input.userId ?? null,
      })
      .returning();
    return { ok: true as const, appointment: appointment! };
  });
}

/** Upcoming live bookings of one phone (for "you already have a booking" hints and the parent portal). */
export async function upcomingFor(db: Db, tenantId: string, rawPhone: string, now = new Date()) {
  const phone = normalizeIranMobile(rawPhone);
  if (!phone) return [];
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.phone, phone),
        gte(appointments.startsAt, now),
        or(eq(appointments.status, "booked"), eq(appointments.status, "confirmed")),
      ),
    )
    .orderBy(appointments.startsAt);
}

/** Next slots of one template with live seat counts, for the admin preview. */
export async function previewTemplate(db: Db, tenantId: string, templateId: string, now = new Date()): Promise<Slot[]> {
  const [t] = await db
    .select()
    .from(availabilityTemplates)
    .where(and(eq(availabilityTemplates.id, templateId), eq(availabilityTemplates.tenantId, tenantId)));
  if (!t) return [];
  const today = tehranDay(now);
  const [closed, booked] = await Promise.all([closedDaysFor(db, tenantId, [t], today, addDays(today, t.maxDaysAhead)), bookedCounts(db, [t.id], now)]);
  return generateSlots(t, { now, closedDays: closed.get(t.id), booked: booked.get(t.id) });
}
