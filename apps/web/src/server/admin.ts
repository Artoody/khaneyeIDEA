import "server-only";
import { auditLog, getDb } from "@khaneyeidea/db";
import type { Localized } from "@khaneyeidea/db/schema";
import { z } from "zod";

// Shared helpers for admin server actions: form parsing, validation and audit trail.

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; savedAt?: number };

export async function audit(
  tenantId: string,
  actorUserId: string,
  action: "create" | "update" | "delete" | "reorder",
  entityType: string,
  entityId: string | null,
  diff?: unknown,
) {
  await getDb()
    .insert(auditLog)
    .values({ tenantId, actorUserId, action, entityType, entityId, diff: diff ? JSON.stringify(diff).slice(0, 20000) : null });
}

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};

/** Reads a fa/en pair posted as `${name}.fa` / `${name}.en`. */
export function localized(f: FormData, name: string): Localized {
  return { fa: str(f, `${name}.fa`), en: str(f, `${name}.en`) };
}
export function optionalLocalized(f: FormData, name: string): Localized | null {
  const v = localized(f, name);
  return v.fa || v.en ? v : null;
}
export const text = (f: FormData, k: string) => str(f, k) || null;
export const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";
export function int(f: FormData, k: string): number | null {
  const v = str(f, k).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[,٬\s]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}
/** JSON posted by client list editors in a hidden input. */
export function json<T>(f: FormData, k: string, schema: z.ZodType<T>): T {
  const raw = str(f, k);
  return schema.parse(raw ? JSON.parse(raw) : []);
}

export const localizedSchema = z.object({ fa: z.string().max(2000), en: z.string().max(2000) });
export const requiredLocalized = localizedSchema.refine((v) => v.fa.length > 0, { message: "fa_required" });

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug");

/** Converts a ZodError to per-field messages keyed by the form field name. */
export function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
