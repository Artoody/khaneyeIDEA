"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { branches, getDb, rooms } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { audit, int, text } from "@/server/admin";

export async function addRoom(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const branchId = z.uuid().parse(f.get("branchId"));
  const name = text(f, "name")?.slice(0, 80);
  if (!name) return;
  const capacity = int(f, "capacity");
  const db = getDb();
  const [b] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.tenantId, user.tenantId)));
  if (!b) return;
  const [row] = await db
    .insert(rooms)
    .values({ tenantId: user.tenantId, branchId, name, capacity: capacity && capacity > 0 ? capacity : null })
    .returning({ id: rooms.id });
  await audit(user.tenantId, user.userId, "create", "room", row!.id, { branchId, name });
  refresh();
}

/** Classes that used the room keep running (their room is cleared by the database). */
export async function removeRoom(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = z.uuid().parse(f.get("id"));
  const res = await getDb().delete(rooms).where(and(eq(rooms.id, id), eq(rooms.tenantId, user.tenantId))).returning({ id: rooms.id });
  if (res.length) await audit(user.tenantId, user.userId, "delete", "room", id);
  refresh();
}
