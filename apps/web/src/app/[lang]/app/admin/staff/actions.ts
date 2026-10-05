"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { branches, getDb, teachers, userRoles, users } from "@khaneyeidea/db";
import { findOrCreateUser, grantRole, normalizeIranMobile } from "@khaneyeidea/core";
import { requirePermission } from "@/server/auth";
import { audit, text, type ActionState } from "@/server/admin";

const STAFF_ROLES = ["owner", "admin", "content_manager", "teacher"] as const;

export async function addStaff(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await requirePermission("users.manage");
  const db = getDb();
  const e: Record<string, string> = {};
  const role = z.enum(STAFF_ROLES).safeParse(f.get("role"));
  if (!role.success) e["role"] = "required";
  const branchId = text(f, "branchId");
  const teacherId = text(f, "teacherId");
  if (branchId) {
    const ok = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.tenantId, me.tenantId)));
    if (!ok.length) e["branchId"] = "invalid";
  }
  if (teacherId) {
    const ok = await db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.id, teacherId), eq(teachers.tenantId, me.tenantId)));
    if (!ok.length) e["teacherId"] = "invalid";
  }
  const phone = String(f.get("phone") ?? "");
  if (!normalizeIranMobile(phone)) e["phone"] = "phone";
  if (Object.keys(e).length || !role.success) return { error: "validation", fieldErrors: e };
  // Owners are global; a branch scope only applies to admins and teachers.
  const scope = role.data === "admin" || role.data === "teacher" ? branchId : null;

  const result = await db.transaction(async (tx) => {
    const user = (await findOrCreateUser(tx, me.tenantId, phone, text(f, "name")))!;
    await grantRole(tx, user.id, role.data, scope);
    if (role.data === "teacher" && teacherId) {
      // One login per coach profile.
      await tx.update(teachers).set({ userId: null }).where(and(eq(teachers.tenantId, me.tenantId), eq(teachers.userId, user.id), ne(teachers.id, teacherId)));
      await tx.update(teachers).set({ userId: user.id }).where(and(eq(teachers.id, teacherId), eq(teachers.tenantId, me.tenantId)));
    }
    return { userId: user.id };
  });
  await audit(me.tenantId, me.userId, "create", "user_role", result.userId, { role: role.data, branchId: scope, teacherId });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function removeRole(f: FormData) {
  const me = await requirePermission("users.manage");
  const id = z.uuid().parse(f.get("id"));
  const db = getDb();
  const [row] = await db
    .select({ r: userRoles, tenantId: users.tenantId })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(userRoles.id, id), eq(users.tenantId, me.tenantId)));
  if (!row) return;
  if (row.r.role === "owner") {
    const owners = await db
      .select({ id: userRoles.id })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(eq(users.tenantId, me.tenantId), eq(userRoles.role, "owner")));
    if (owners.length <= 1) return; // never lock the academy out
  }
  await db.delete(userRoles).where(eq(userRoles.id, id));
  if (row.r.role === "teacher") {
    const left = await db.select({ id: userRoles.id }).from(userRoles).where(and(eq(userRoles.userId, row.r.userId), inArray(userRoles.role, ["teacher"])));
    if (!left.length) await db.update(teachers).set({ userId: null }).where(and(eq(teachers.tenantId, me.tenantId), eq(teachers.userId, row.r.userId)));
  }
  await audit(me.tenantId, me.userId, "delete", "user_role", row.r.userId, { role: row.r.role, branchId: row.r.branchId });
  refresh();
}
