// The admin's painted open hours, the calendar of bookings, and the notice that tells admins about a new booking.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appointments, appointmentTypes, availabilityTemplates, closeDb, getDb, messengerAccounts, tenants, userRoles, users } from "@khaneyeidea/db";
import { bookSlot, calendarRange, findSlots, handleBookingCallback, mergeCells, notifyNewBookings, paintedCells, paintWindows, tehranDay, addDays, type Messenger } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

describe("mergeCells", () => {
  it("joins touching half hours and keeps gaps", () => {
    expect(mergeCells(["12:00", "12:30", "13:00", "15:00"])).toEqual([
      { start: "12:00", end: "13:30" },
      { start: "15:00", end: "15:30" },
    ]);
    expect(mergeCells(["bad", "25:00"])).toEqual([]);
  });
});

function fake(channel: "bale" | "telegram" = "bale") {
  const sent: { chatId: string; text: string; buttons?: unknown }[] = [];
  const edited: string[] = [];
  const m: Messenger = {
    channel,
    async send(chatId, text, buttons) {
      sent.push({ chatId, text, buttons });
      return `m${sent.length}`;
    },
    async edit(_c, _m, text) {
      edited.push(text);
    },
    async remove() {
      return true;
    },
  };
  return { m, sent, edited };
}

describe("painted hours, calendar and booking notices", () => {
  const db = getDb();
  let tenantId = "";
  let typeId = "";
  let adminId = "";
  const now = new Date();

  beforeAll(async () => {
    const [t] = await db.insert(tenants).values({ slug: `cal-${Date.now()}`, name: "cal" }).returning();
    tenantId = t!.id;
    const [ty] = await db.insert(appointmentTypes).values({ tenantId, kind: "consultation", title: { fa: "مشاوره", en: "Consultation" } }).returning();
    typeId = ty!.id;
    const [a] = await db.insert(users).values({ tenantId, phone: `989${String(Date.now()).slice(-9)}`, fullName: "مدیر" }).returning();
    adminId = a!.id;
    await db.insert(userRoles).values({ userId: adminId, role: "admin" });
  });
  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await closeDb();
  });

  it("painting Thursday 12 to 13 makes one hour slot every Thursday and nothing else", async () => {
    const r = await paintWindows(db, tenantId, { appointmentTypeId: typeId, branchId: null, slotMinutes: 60, capacity: 1, cells: [{ weekday: 5, time: "12:00" }, { weekday: 5, time: "12:30" }] }, now);
    expect(r).toMatchObject({ created: 1, removed: 0, paused: 0 });
    const slots = await findSlots(db, tenantId, { appointmentTypeId: typeId, branchId: null }, now);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.time === "12:00")).toBe(true);
    expect(new Set(slots.map((s) => new Date(`${s.day}T12:00:00Z`).getUTCDay()))).toEqual(new Set([4])); // Thursday
    const cells = await paintedCells(db, tenantId, typeId, null);
    expect(cells.cells).toEqual([{ weekday: 5, time: "12:00" }, { weekday: 5, time: "12:30" }]);
  });

  it("shows bookings on the calendar and keeps them when the hours are repainted", async () => {
    const slot = (await findSlots(db, tenantId, { appointmentTypeId: typeId, branchId: null }, now))[0]!;
    const phone = `9${String(Date.now()).slice(-9)}`;
    const booked = await bookSlot(db, tenantId, { templateId: slot.templateId, startsAt: slot.startsAt, phone, guardianName: "خانم نمونه", childFirstName: "آوا", childAge: 8 }, now);
    expect(booked.ok).toBe(true);
    const cal = await calendarRange(db, tenantId, { appointmentTypeId: typeId, from: tehranDay(now), to: addDays(tehranDay(now), 20) }, now);
    const day = cal.find((d) => d.day === slot.day)!;
    expect(day.slots[0]!.bookings[0]).toMatchObject({ guardian: "خانم نمونه", child: "آوا" });
    expect(day.slots[0]!.remaining).toBe(0);

    // Thursday 12-13 becomes Thursday 12:30-14:00: same template (overlap), the booking still counts
    const [before] = await db.select().from(availabilityTemplates).where(and(eq(availabilityTemplates.tenantId, tenantId), eq(availabilityTemplates.painted, true)));
    const r = await paintWindows(db, tenantId, { appointmentTypeId: typeId, branchId: null, slotMinutes: 60, capacity: 1, cells: [{ weekday: 5, time: "12:30" }, { weekday: 5, time: "13:00" }] }, now);
    expect(r).toMatchObject({ created: 0, updated: 1 });
    const [after] = await db.select().from(availabilityTemplates).where(and(eq(availabilityTemplates.tenantId, tenantId), eq(availabilityTemplates.painted, true)));
    expect(after!.id).toBe(before!.id);

    // Erasing everything pauses a template that still has an upcoming booking instead of deleting it
    const gone = await paintWindows(db, tenantId, { appointmentTypeId: typeId, branchId: null, slotMinutes: 60, capacity: 1, cells: [] }, now);
    expect(gone).toMatchObject({ paused: 1, removed: 0 });
    expect(await findSlots(db, tenantId, { appointmentTypeId: typeId, branchId: null }, now)).toEqual([]);
  });

  it("tells admins in the messenger once, with buttons, and the buttons work for admins only", async () => {
    await db.insert(messengerAccounts).values({ userId: adminId, channel: "bale", chatId: "ADM1" });
    const [row] = await db.select().from(appointments).where(eq(appointments.tenantId, tenantId));
    await db.update(appointments).set({ notifiedAt: null }).where(eq(appointments.id, row!.id));
    const bale = fake("bale");
    const first = await notifyNewBookings(db, { bale: bale.m }, null, new Date());
    expect(first.told).toBe(1);
    expect(bale.sent).toHaveLength(1);
    expect(bale.sent[0]!.text).toContain("رزرو تازه");
    expect(bale.sent[0]!.text).toContain("خانم نمونه");
    expect((await notifyNewBookings(db, { bale: bale.m }, null, new Date())).told).toBe(0);
    expect(bale.sent).toHaveLength(1);

    const stranger = await handleBookingCallback(db, { bale: bale.m }, { channel: "bale", chatId: "NOBODY", messageId: "1", data: `bkok:${row!.id}` });
    expect(stranger?.toast).toContain("فقط مدیر");
    const ok = await handleBookingCallback(db, { bale: bale.m }, { channel: "bale", chatId: "ADM1", messageId: "1", data: `bkok:${row!.id}` });
    expect(ok).toEqual({});
    expect((await db.select().from(appointments).where(eq(appointments.id, row!.id)))[0]!.status).toBe("confirmed");
    const again = await handleBookingCallback(db, { bale: bale.m }, { channel: "bale", chatId: "ADM1", messageId: "1", data: `bkok:${row!.id}` });
    expect(again?.toast).toContain("قبلاً");
    expect(await handleBookingCallback(db, { bale: bale.m }, { channel: "bale", chatId: "ADM1", messageId: "1", data: `sess:x` })).toBeNull();
  });

  it("keeps trying while nobody can be reached, and never announces old bookings", async () => {
    const [row] = await db.select().from(appointments).where(eq(appointments.tenantId, tenantId));
    await db.update(appointments).set({ notifiedAt: null, status: "booked" }).where(eq(appointments.id, row!.id));
    await db.delete(messengerAccounts).where(eq(messengerAccounts.userId, adminId));
    const quiet = fake();
    expect((await notifyNewBookings(db, { bale: quiet.m }, null, new Date())).told).toBe(0);
    expect((await db.select().from(appointments).where(eq(appointments.id, row!.id)))[0]!.notifiedAt).toBeNull(); // released for the next tick
    expect((await notifyNewBookings(db, { bale: quiet.m }, null, new Date(Date.now() + 2 * 24 * 3_600_000))).told).toBe(0);
    expect((await db.select().from(appointments).where(eq(appointments.id, row!.id)))[0]!.notifiedAt).not.toBeNull(); // too old, closed silently
  });
});
