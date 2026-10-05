// Booking against a real Postgres, in a throwaway tenant: capacity under concurrency, duplicates, limits.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appointments, appointmentTypes, availabilityExceptions, availabilityTemplates, closeDb, getDb, tenants } from "@khaneyeidea/db";
import { bookSlot, findSlots, MAX_ACTIVE_PER_PHONE, zonedToUtc } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const now = new Date("2026-10-03T05:30:00Z"); // Sat 09:00 Tehran
let tenantId: string;
let typeId: string;
let templateId: string;
const at = (day: string, time: string) => zonedToUtc(day, time);

beforeAll(async () => {
  const db = getDb();
  const [t] = await db.insert(tenants).values({ slug: `test-book-${Date.now()}`, name: "test" }).returning();
  tenantId = t!.id;
  const [ty] = await db.insert(appointmentTypes).values({ tenantId, kind: "trial_class", title: { fa: "کلاس آزمایشی", en: "Trial" } }).returning();
  typeId = ty!.id;
  const [tp] = await db
    .insert(availabilityTemplates)
    .values({ tenantId, appointmentTypeId: typeId, name: "test", weekdays: [0, 2], startTime: "16:00", endTime: "18:00", slotMinutes: 60, capacity: 2, ageMin: 7, ageMax: 9 })
    .returning();
  templateId = tp!.id;
});
afterAll(async () => {
  await getDb().delete(tenants).where(eq(tenants.id, tenantId));
  await closeDb();
});

describe("findSlots", () => {
  it("lists open slots matching the child's age", async () => {
    const slots = await findSlots(getDb(), tenantId, { appointmentTypeId: typeId, age: 8 }, now);
    expect(slots[0]!.startsAt.toISOString()).toBe(at("2026-10-03", "16:00").toISOString());
    expect(slots.every((s) => s.remaining === 2)).toBe(true);
    expect(await findSlots(getDb(), tenantId, { appointmentTypeId: typeId, age: 12 }, now)).toEqual([]);
  });
  it("hides a closed day", async () => {
    const db = getDb();
    const [e] = await db.insert(availabilityExceptions).values({ tenantId, date: "2026-10-05" }).returning();
    const slots = await findSlots(db, tenantId, { appointmentTypeId: typeId }, now);
    expect(slots.some((s) => s.day === "2026-10-05")).toBe(false);
    await db.delete(availabilityExceptions).where(eq(availabilityExceptions.id, e!.id));
  });
});

describe("bookSlot", () => {
  it("never overbooks under concurrent requests", async () => {
    const startsAt = at("2026-10-03", "17:00");
    const phones = ["09120000011", "09120000012", "09120000013", "09120000014", "09120000015", "09120000016"];
    const results = await Promise.all(phones.map((phone) => bookSlot(getDb(), tenantId, { templateId, startsAt, phone, childAge: 8 }, now)));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "full")).toBe(true);
    const slots = await findSlots(getDb(), tenantId, { appointmentTypeId: typeId }, now);
    expect(slots.find((s) => s.startsAt.getTime() === startsAt.getTime())!.remaining).toBe(0);
  });

  it("rejects times that are not real slots", async () => {
    const r = await bookSlot(getDb(), tenantId, { templateId, startsAt: at("2026-10-03", "16:30"), phone: "09120000021" }, now);
    expect(r).toEqual({ ok: false, reason: "slot_unavailable" });
    const past = await bookSlot(getDb(), tenantId, { templateId, startsAt: at("2026-10-03", "16:00"), phone: "09120000021" }, new Date("2026-10-03T12:00:00Z"));
    expect(past).toEqual({ ok: false, reason: "slot_unavailable" }); // inside the lead time
  });

  it("rejects a second booking of the same slot by one phone", async () => {
    const startsAt = at("2026-10-05", "16:00");
    expect((await bookSlot(getDb(), tenantId, { templateId, startsAt, phone: "09120000031" }, now)).ok).toBe(true);
    expect(await bookSlot(getDb(), tenantId, { templateId, startsAt, phone: "+989120000031" }, now)).toEqual({ ok: false, reason: "duplicate" });
  });

  it(`limits one phone to ${MAX_ACTIVE_PER_PHONE} upcoming bookings`, async () => {
    const phone = "09120000041";
    const times = [at("2026-10-05", "17:00"), at("2026-10-10", "16:00"), at("2026-10-10", "17:00"), at("2026-10-12", "16:00")];
    const rs = [];
    for (const startsAt of times) rs.push(await bookSlot(getDb(), tenantId, { templateId, startsAt, phone }, now));
    expect(rs.slice(0, 3).every((r) => r.ok)).toBe(true);
    expect(rs[3]).toEqual({ ok: false, reason: "too_many" });
  });

  it("frees the seat when a booking is canceled", async () => {
    const db = getDb();
    const startsAt = at("2026-10-12", "17:00");
    const a = await bookSlot(db, tenantId, { templateId, startsAt, phone: "09120000051" }, now);
    const b = await bookSlot(db, tenantId, { templateId, startsAt, phone: "09120000052" }, now);
    expect(a.ok && b.ok).toBe(true);
    expect((await bookSlot(db, tenantId, { templateId, startsAt, phone: "09120000053" }, now)).ok).toBe(false);
    if (a.ok) await db.update(appointments).set({ status: "canceled" }).where(eq(appointments.id, a.appointment.id));
    expect((await bookSlot(db, tenantId, { templateId, startsAt, phone: "09120000053" }, now)).ok).toBe(true);
  });

  it("stores only minimal child data and the source", async () => {
    const r = await bookSlot(
      getDb(),
      tenantId,
      { templateId, startsAt: at("2026-10-17", "16:00"), phone: "09120000061", childFirstName: "  آوا ", childAge: 8, source: "instagram" },
      now,
    );
    expect(r.ok && r.appointment.childFirstName).toBe("آوا");
    expect(r.ok && r.appointment.source).toBe("instagram");
    expect(r.ok && r.appointment.phone).toBe("989120000061");
  });

  it("refuses inactive templates", async () => {
    const db = getDb();
    await db.update(availabilityTemplates).set({ active: false }).where(eq(availabilityTemplates.id, templateId));
    expect(await bookSlot(db, tenantId, { templateId, startsAt: at("2026-10-17", "17:00"), phone: "09120000071" }, now)).toEqual({ ok: false, reason: "slot_unavailable" });
    await db.update(availabilityTemplates).set({ active: true }).where(eq(availabilityTemplates.id, templateId));
    // and the same slot books fine once active again (so the refusal above was about the template)
    expect((await bookSlot(db, tenantId, { templateId, startsAt: at("2026-10-17", "17:00"), phone: "09120000071" }, now)).ok).toBe(true);
  });
});
