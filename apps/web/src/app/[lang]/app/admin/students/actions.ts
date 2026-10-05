"use server";

import { and, eq, notInArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, guardians, students } from "@khaneyeidea/db";
import { findOrCreateUser, grantRole, normalizeIranMobile } from "@khaneyeidea/core";
import { requirePermission } from "@/server/auth";
import { href, isLocale } from "@/lib/i18n";
import { audit, int, json, text, type ActionState } from "@/server/admin";

const guardianRow = z.object({
  phone: z.string().max(30),
  name: z.string().max(80),
  relation: z.enum(["mother", "father", "other"]).catch("other"),
  mediaConsent: z.boolean(),
});

export async function saveStudent(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("students.manage");
  const db = getDb();
  const tid = user.tenantId;
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const e: Record<string, string> = {};

  const firstName = text(f, "firstName");
  if (!firstName) e["firstName"] = "required";
  const birthYear = int(f, "birthYear");
  if (Number.isNaN(birthYear) || (birthYear !== null && (birthYear < 1370 || birthYear > 1420))) e["birthYear"] = "number";
  let rows: z.infer<typeof guardianRow>[] = [];
  try {
    rows = json(f, "guardians", z.array(guardianRow).max(4)).filter((g) => g.phone.trim());
  } catch {
    e["guardians"] = "invalid";
  }
  if (rows.some((g) => !normalizeIranMobile(g.phone))) e["guardians"] = "phone";
  if (!rows.length && !e["guardians"]) e["guardians"] = "guardian_required";
  if (Object.keys(e).length) return { error: "validation", fieldErrors: e };

  const values = {
    firstName: firstName!.slice(0, 40),
    lastName: (text(f, "lastName") ?? "").slice(0, 60),
    birthYear,
    notes: text(f, "notes")?.slice(0, 2000) ?? null,
  };
  const studentId = await db.transaction(async (tx) => {
    let sid = id;
    if (sid) {
      const res = await tx.update(students).set(values).where(and(eq(students.id, sid), eq(students.tenantId, tid))).returning({ id: students.id });
      if (!res.length) return null;
    } else {
      const [row] = await tx.insert(students).values({ ...values, tenantId: tid }).returning({ id: students.id });
      sid = row!.id;
    }
    // Parents: an account per mobile number (they sign in with it), linked to this child.
    const keep: string[] = [];
    for (const g of rows) {
      const parent = (await findOrCreateUser(tx, tid, g.phone, g.name))!;
      await grantRole(tx, parent.id, "parent", null);
      keep.push(parent.id);
      await tx
        .insert(guardians)
        .values({ studentId: sid, userId: parent.id, relation: g.relation, mediaConsent: g.mediaConsent })
        .onConflictDoUpdate({ target: [guardians.studentId, guardians.userId], set: { relation: g.relation, mediaConsent: g.mediaConsent } });
    }
    await tx.delete(guardians).where(and(eq(guardians.studentId, sid), notInArray(guardians.userId, keep)));
    return sid;
  });
  if (!studentId) return { error: "not_found" };
  // Audit without children's details beyond the first name.
  await audit(tid, user.userId, id ? "update" : "create", "student", studentId, { firstName: values.firstName, guardians: rows.length });
  if (!id) redirect(href(isLocale(lang) ? lang : "fa", `/app/admin/students/${studentId}`));
  refresh();
  return { ok: true, savedAt: Date.now() };
}
