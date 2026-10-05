"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { appointmentTypes, branches, courses, getDb, users } from "@khaneyeidea/db";
import { bookSlot, findSlots, requestOtp, verifyOtp } from "@khaneyeidea/core";
import { authDeps, clientMeta, getUser, setSessionCookie } from "@/server/auth";
import { tenantId } from "@/server/content";

// Public booking actions. Nothing here trusts the client: slots are re-derived and re-checked when booking,
// and the phone is proven with a one-time code unless the visitor is already signed in.

export type SlotDTO = { templateId: string; startsAt: string; day: string; time: string; remaining: number; branchId: string | null };

const slotQuery = z.object({
  appointmentTypeId: z.uuid(),
  age: z.number().int().min(3).max(25).nullable(),
  departmentId: z.uuid().nullable(),
  courseId: z.uuid().nullable(),
});

export async function loadSlots(input: z.input<typeof slotQuery>): Promise<SlotDTO[]> {
  const q = slotQuery.parse(input);
  const slots = await findSlots(getDb(), await tenantId(), q);
  return slots.slice(0, 400).map((s) => ({
    templateId: s.templateId,
    startsAt: s.startsAt.toISOString(),
    day: s.day,
    time: s.time,
    remaining: s.remaining,
    branchId: s.branchId,
  }));
}

export type CodeResult = { ok: true; phone: string; expiresInSec: number } | { ok: false; error: string };

export async function sendBookingCode(rawPhone: string): Promise<CodeResult> {
  try {
    const { ip } = await clientMeta();
    const r = await requestOtp(await authDeps(), String(rawPhone).slice(0, 30), ip);
    return r.ok ? { ok: true, phone: r.phone, expiresInSec: r.expiresInSec } : { ok: false, error: r.reason };
  } catch (e) {
    console.error("[book] send code failed", e);
    return { ok: false, error: "unknown" };
  }
}

const confirmInput = z.object({
  templateId: z.uuid(),
  startsAt: z.iso.datetime(),
  courseId: z.uuid().nullable(),
  guardianName: z.string().trim().min(1).max(80),
  childFirstName: z.string().trim().max(40).nullable(),
  childAge: z.number().int().min(3).max(25).nullable(),
  note: z.string().trim().max(500).nullable(),
  phone: z.string().max(30).nullable(),
  code: z.string().max(12).nullable(),
  source: z.string().max(20).nullable(),
});
const SOURCES = ["site", "bale", "telegram", "instagram", "referral"] as const;

export type ConfirmResult =
  | { ok: true; booking: { startsAt: string; endsAt: string; type: { fa: string; en: string }; branch: { name: { fa: string; en: string }; address: { fa: string; en: string } | null } | null } }
  | { ok: false; error: string; step?: "code" | "time" | "contact"; signedInPhone?: string };

export async function confirmBooking(input: z.input<typeof confirmInput>): Promise<ConfirmResult> {
  const parsed = confirmInput.safeParse(input);
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.some((i) => i.path[0] === "guardianName");
    return { ok: false, error: nameIssue ? "name_required" : "unknown", step: "contact" };
  }
  const v = parsed.data;
  const db = getDb();
  const tid = await tenantId();

  // Who is booking: the signed-in user, or a phone proven with the code (which also signs them in).
  const user = await getUser();
  let userId = user?.userId ?? null;
  let phone = user?.phone ?? null;
  if (!user) {
    if (!v.phone || !v.code) return { ok: false, error: "invalid_code", step: "code" };
    const r = await verifyOtp(await authDeps(), v.phone, v.code, await clientMeta());
    if (!r.ok) return { ok: false, error: r.reason, step: r.reason === "invalid_phone" ? "contact" : "code" };
    await setSessionCookie(r.token);
    userId = r.userId;
    phone = (await db.select({ phone: users.phone }).from(users).where(eq(users.id, r.userId)))[0]?.phone ?? null;
  }
  if (!phone || !userId) return { ok: false, error: "unknown" };

  // Only a course of this tenant can be attached.
  let courseId = v.courseId;
  if (courseId) {
    const ok = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.id, courseId), eq(courses.tenantId, tid)));
    if (!ok.length) courseId = null;
  }
  const source = SOURCES.find((s) => s === v.source) ?? "site";
  const r = await bookSlot(db, tid, {
    templateId: v.templateId,
    startsAt: new Date(v.startsAt),
    phone,
    guardianName: v.guardianName,
    childFirstName: v.childFirstName,
    childAge: v.childAge,
    courseId,
    note: v.note,
    source,
    userId,
  });
  // The visitor may have just been signed in by the code: tell the client so a retry needs no new code.
  if (!r.ok) return { ok: false, error: r.reason, step: r.reason === "full" || r.reason === "slot_unavailable" ? "time" : "contact", signedInPhone: phone };

  // Remember the parent's name on their account if it has none yet.
  await db.update(users).set({ fullName: v.guardianName }).where(and(eq(users.id, userId), isNull(users.fullName)));

  const ap = r.appointment;
  const [type] = await db.select({ title: appointmentTypes.title }).from(appointmentTypes).where(eq(appointmentTypes.id, ap.appointmentTypeId));
  const [branch] = ap.branchId ? await db.select({ name: branches.name, address: branches.address }).from(branches).where(eq(branches.id, ap.branchId)) : [];
  // TODO(notifications): notify staff of the new booking through the notification center when it lands.
  return {
    ok: true,
    booking: { startsAt: ap.startsAt.toISOString(), endsAt: ap.endsAt.toISOString(), type: type!.title, branch: branch ?? null },
  };
}
