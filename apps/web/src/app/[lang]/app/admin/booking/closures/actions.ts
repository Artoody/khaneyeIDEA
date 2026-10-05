"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { availabilityExceptions, branches, getDb } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { audit, optionalLocalized, text, type ActionState } from "@/server/admin";

export async function addClosure(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("schedule.manage");
  const date = text(f, "date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "validation", fieldErrors: { date: "required" } };
  const branchId = text(f, "branchId");
  if (branchId) {
    const ok = await getDb().select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.tenantId, user.tenantId)));
    if (!ok.length) return { error: "validation", fieldErrors: { branchId: "invalid" } };
  }
  const values = { tenantId: user.tenantId, date, branchId, reason: optionalLocalized(f, "reason") };
  const [row] = await getDb().insert(availabilityExceptions).values(values).returning({ id: availabilityExceptions.id });
  await audit(user.tenantId, user.userId, "create", "availability_exception", row!.id, values);
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function removeClosure(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = z.uuid().parse(f.get("id"));
  const res = await getDb()
    .delete(availabilityExceptions)
    .where(and(eq(availabilityExceptions.id, id), eq(availabilityExceptions.tenantId, user.tenantId)))
    .returning({ id: availabilityExceptions.id });
  if (res.length) await audit(user.tenantId, user.userId, "delete", "availability_exception", id);
  refresh();
}
