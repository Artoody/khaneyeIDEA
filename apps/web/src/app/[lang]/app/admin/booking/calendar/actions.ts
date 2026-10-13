"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { appointmentTypes, availabilityExceptions, availabilityTemplates, branches, getDb } from "@khaneyeidea/db";
import { paintWindows, weekdaySat0 } from "@khaneyeidea/core";
import { requirePermission } from "@/server/auth";
import { audit } from "@/server/admin";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export type CalState = { ok?: true; error?: string; paused?: number; at?: number };

const target = z.object({ typeId: z.uuid(), branchId: z.uuid().nullable() });

/** The type and branch must belong to this tenant: ids come from the client. */
async function ownTarget(tenantId: string, t: z.infer<typeof target>) {
  const db = getDb();
  const [ty] = await db.select({ id: appointmentTypes.id }).from(appointmentTypes).where(and(eq(appointmentTypes.id, t.typeId), eq(appointmentTypes.tenantId, tenantId)));
  if (!ty) return false;
  if (t.branchId) {
    const [b] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, t.branchId), eq(branches.tenantId, tenantId)));
    if (!b) return false;
  }
  return true;
}

const paintInput = target.extend({
  slotMinutes: z.number().int().min(15).max(120),
  capacity: z.number().int().min(1).max(50),
  cells: z.array(z.object({ weekday: z.number().int().min(0).max(6), time: z.string().regex(HHMM) })).max(7 * 48),
});

/** Makes the weekly open hours of one type and place equal to the painted grid. */
export async function savePainted(input: z.input<typeof paintInput>): Promise<CalState> {
  const user = await requirePermission("schedule.manage");
  const p = paintInput.safeParse(input);
  if (!p.success || !(await ownTarget(user.tenantId, p.data))) return { error: "invalid" };
  const r = await paintWindows(getDb(), user.tenantId, { appointmentTypeId: p.data.typeId, branchId: p.data.branchId, slotMinutes: p.data.slotMinutes, capacity: p.data.capacity, cells: p.data.cells });
  await audit(user.tenantId, user.userId, "update", "availability_painter", p.data.typeId, { branchId: p.data.branchId, cells: p.data.cells.length, ...r });
  refresh();
  return { ok: true, paused: r.paused, at: Date.now() };
}

const dayInput = target.extend({ day: z.string().regex(ISO) });

/** Closes (or reopens) one date for every open-hours template of this type and place. */
export async function setDayClosed(input: z.input<typeof dayInput> & { closed: boolean }): Promise<CalState> {
  const user = await requirePermission("schedule.manage");
  const p = dayInput.safeParse(input);
  if (!p.success || !(await ownTarget(user.tenantId, p.data))) return { error: "invalid" };
  const db = getDb();
  const templates = await db
    .select({ id: availabilityTemplates.id })
    .from(availabilityTemplates)
    .where(
      and(
        eq(availabilityTemplates.tenantId, user.tenantId),
        eq(availabilityTemplates.appointmentTypeId, p.data.typeId),
        p.data.branchId ? eq(availabilityTemplates.branchId, p.data.branchId) : isNull(availabilityTemplates.branchId),
      ),
    );
  const ids = templates.map((t) => t.id);
  if (!ids.length) return { ok: true };
  if (input.closed) {
    const have = await db.select({ t: availabilityExceptions.templateId }).from(availabilityExceptions).where(and(eq(availabilityExceptions.tenantId, user.tenantId), eq(availabilityExceptions.date, p.data.day), inArray(availabilityExceptions.templateId, ids)));
    const done = new Set(have.map((h) => h.t));
    const rows = ids.filter((id) => !done.has(id)).map((templateId) => ({ tenantId: user.tenantId, date: p.data.day, templateId }));
    if (rows.length) await db.insert(availabilityExceptions).values(rows);
  } else {
    await db.delete(availabilityExceptions).where(and(eq(availabilityExceptions.tenantId, user.tenantId), eq(availabilityExceptions.date, p.data.day), inArray(availabilityExceptions.templateId, ids)));
  }
  await audit(user.tenantId, user.userId, "update", "availability_day", p.data.typeId, { day: p.data.day, closed: input.closed });
  refresh();
  return { ok: true, at: Date.now() };
}

const extraInput = dayInput.extend({
  start: z.string().regex(HHMM),
  end: z.string().regex(HHMM),
  slotMinutes: z.number().int().min(15).max(120),
  capacity: z.number().int().min(1).max(50),
});

/** Extra open hours for one date only. */
export async function addDateWindow(input: z.input<typeof extraInput>): Promise<CalState> {
  const user = await requirePermission("schedule.manage");
  const p = extraInput.safeParse(input);
  if (!p.success || !(await ownTarget(user.tenantId, p.data)) || p.data.end <= p.data.start) return { error: "invalid" };
  const v = p.data;
  const [row] = await getDb()
    .insert(availabilityTemplates)
    .values({
      tenantId: user.tenantId,
      appointmentTypeId: v.typeId,
      branchId: v.branchId,
      name: "ساعت ویژه",
      weekdays: [weekdaySat0(v.day)],
      startTime: v.start,
      endTime: v.end,
      slotMinutes: v.slotMinutes,
      capacity: v.capacity,
      minLeadHours: 1,
      maxDaysAhead: 90,
      validFrom: v.day,
      validUntil: v.day,
    })
    .returning({ id: availabilityTemplates.id });
  await audit(user.tenantId, user.userId, "create", "availability_template", row!.id, v);
  refresh();
  return { ok: true, at: Date.now() };
}
