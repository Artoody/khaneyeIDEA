"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { appointmentTypes, availabilityTemplates, branches, courses, departments, getDb } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, text, type ActionState } from "@/server/admin";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function saveTemplate(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("schedule.manage");
  const db = getDb();
  const tid = user.tenantId;
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const e: Record<string, string> = {};

  const name = text(f, "name");
  if (!name) e["name"] = "required";
  const startTime = text(f, "startTime") ?? "";
  const endTime = text(f, "endTime") ?? "";
  if (!HHMM.test(startTime)) e["startTime"] = "time";
  if (!HHMM.test(endTime)) e["endTime"] = "time";
  if (!e["startTime"] && !e["endTime"] && endTime <= startTime) e["endTime"] = "time_order";
  const weekdays = [...new Set(f.getAll("weekdays").map(Number))].filter((n) => Number.isInteger(n) && n >= 0 && n <= 6).sort();
  if (!weekdays.length) e["weekdays"] = "weekdays";

  const num = (k: string, min: number, max: number, required = false) => {
    const v = int(f, k);
    if (v === null) {
      if (required) e[k] = "number";
      return null;
    }
    if (Number.isNaN(v) || v < min || v > max) e[k] = "number";
    return v;
  };
  const slotMinutes = num("slotMinutes", 10, 240, true);
  const capacity = num("capacity", 1, 100, true);
  const minLeadHours = num("minLeadHours", 0, 168, true);
  const maxDaysAhead = num("maxDaysAhead", 1, 90, true);
  const ageMin = num("ageMin", 3, 25);
  const ageMax = num("ageMax", 3, 25);
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) e["ageMax"] = "number";
  const validFrom = text(f, "validFrom");
  const validUntil = text(f, "validUntil");
  if ((validFrom && !ISO.test(validFrom)) || (validUntil && !ISO.test(validUntil)) || (validFrom && validUntil && validUntil < validFrom)) e["validUntil"] = "range";

  // Every referenced row must belong to this tenant.
  const typeId = text(f, "appointmentTypeId");
  const branchId = text(f, "branchId");
  const departmentId = text(f, "departmentId");
  const courseId = text(f, "courseId");
  const owned = async (table: typeof appointmentTypes | typeof branches | typeof departments | typeof courses, rowId: string | null, key: string, required = false) => {
    if (!rowId) {
      if (required) e[key] = "required";
      return;
    }
    const rows = await db.select({ id: table.id }).from(table).where(and(eq(table.id, rowId), eq(table.tenantId, tid)));
    if (!rows.length) e[key] = "invalid";
  };
  await Promise.all([owned(appointmentTypes, typeId, "appointmentTypeId", true), owned(branches, branchId, "branchId"), owned(departments, departmentId, "departmentId"), owned(courses, courseId, "courseId")]);
  if (Object.keys(e).length) return { error: "validation", fieldErrors: e };

  const values = {
    name: name!.slice(0, 120),
    appointmentTypeId: typeId!,
    branchId,
    departmentId,
    courseId,
    ageMin,
    ageMax,
    weekdays,
    startTime,
    endTime,
    slotMinutes: slotMinutes!,
    capacity: capacity!,
    minLeadHours: minLeadHours!,
    maxDaysAhead: maxDaysAhead!,
    validFrom,
    validUntil,
    active: bool(f, "active"),
  };
  let rowId = id;
  if (id) {
    const res = await db
      .update(availabilityTemplates)
      .set(values)
      .where(and(eq(availabilityTemplates.id, id), eq(availabilityTemplates.tenantId, tid)))
      .returning({ id: availabilityTemplates.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(availabilityTemplates).values({ ...values, tenantId: tid }).returning({ id: availabilityTemplates.id });
    rowId = row!.id;
  }
  await audit(tid, user.userId, id ? "update" : "create", "availability_template", rowId, values);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/booking/templates/${rowId}`));
  refresh(); // re-render the page so the slot preview reflects the new settings
  return { ok: true, savedAt: Date.now() };
}

