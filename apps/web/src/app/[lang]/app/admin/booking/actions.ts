"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { appointments, getDb } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { audit } from "@/server/admin";

// Allowed status changes. A canceled booking stays canceled (its seat may already be taken again).
const NEXT: Record<string, readonly ("confirmed" | "canceled" | "attended" | "no_show")[]> = {
  booked: ["confirmed", "canceled", "attended", "no_show"],
  confirmed: ["canceled", "attended", "no_show"],
  attended: ["no_show"],
  no_show: ["attended"],
  canceled: [],
};

export async function setBookingStatus(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = z.uuid().parse(f.get("id"));
  const status = z.enum(["confirmed", "canceled", "attended", "no_show"]).parse(f.get("status"));
  const db = getDb();
  const from = Object.keys(NEXT).filter((s) => NEXT[s]!.includes(status)) as (typeof appointments.$inferSelect)["status"][];
  const res = await db
    .update(appointments)
    .set({ status, canceledAt: status === "canceled" ? new Date() : null })
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, user.tenantId), inArray(appointments.status, from)))
    .returning({ id: appointments.id });
  if (res.length) await audit(user.tenantId, user.userId, "update", "appointment", id, { status });
  refresh();
}
