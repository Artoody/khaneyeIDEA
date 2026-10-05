"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appointmentTypes, getDb } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { href, isLocale } from "@/lib/i18n";
import { audit, bool, int, localized, optionalLocalized, text, type ActionState } from "@/server/admin";

export async function saveType(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("schedule.manage");
  const db = getDb();
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const title = localized(f, "title");
  const sortOrder = int(f, "sortOrder");
  const e: Record<string, string> = {};
  if (!title.fa) e["title"] = "fa_required";
  if (Number.isNaN(sortOrder)) e["sortOrder"] = "number";
  if (Object.keys(e).length) return { error: "validation", fieldErrors: e };

  const values = {
    title,
    description: optionalLocalized(f, "description"),
    kind: z.enum(["trial_class", "consultation", "placement", "visit"]).catch("consultation").parse(f.get("kind")),
    place: z.enum(["in_person", "phone", "online"]).catch("in_person").parse(f.get("place")),
    active: bool(f, "active"),
    sortOrder: sortOrder ?? 0,
  };
  let rowId = id;
  if (id) {
    const res = await db.update(appointmentTypes).set(values).where(and(eq(appointmentTypes.id, id), eq(appointmentTypes.tenantId, user.tenantId))).returning({ id: appointmentTypes.id });
    if (!res.length) return { error: "not_found" };
  } else {
    const [row] = await db.insert(appointmentTypes).values({ ...values, tenantId: user.tenantId }).returning({ id: appointmentTypes.id });
    rowId = row!.id;
  }
  await audit(user.tenantId, user.userId, id ? "update" : "create", "appointment_type", rowId, values);
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/booking/types/${rowId}`));
  return { ok: true, savedAt: Date.now() };
}
