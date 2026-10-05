"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb, siteSettings } from "@khaneyeidea/db";
import { normalizeIranMobile } from "@khaneyeidea/core";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { audit, bool, fieldErrors, int, json, localized, localizedSchema, optionalLocalized, text, type ActionState } from "@/server/admin";

const phoneRow = z.object({ label: localizedSchema, number: z.string(), primary: z.boolean().optional() });
const socialRow = z.object({
  kind: z.enum(["instagram", "bale", "telegram", "whatsapp", "youtube", "aparat", "linkedin"]),
  url: z.string().max(300),
  enabled: z.boolean(),
});

export async function saveSettings(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const errors: Record<string, string> = {};

  const name = localized(f, "name");
  const tagline = localized(f, "tagline");
  if (!name.fa) errors["name"] = "fa_required";
  if (!tagline.fa) errors["tagline"] = "fa_required";

  let phones: z.infer<typeof phoneRow>[] = [];
  let socials: z.infer<typeof socialRow>[] = [];
  try {
    phones = json(f, "phones", z.array(phoneRow).max(10));
    socials = json(f, "socials", z.array(socialRow).max(12));
  } catch (e) {
    if (e instanceof z.ZodError) Object.assign(errors, fieldErrors(e));
    else errors["phones"] = "invalid";
  }
  // Normalize phones: mobile numbers to 09..., landlines kept as typed digits.
  phones = phones
    .filter((p) => p.number.trim())
    .map((p) => {
      const m = normalizeIranMobile(p.number);
      return { ...p, number: m ? `0${m.slice(2)}` : p.number.replace(/[^\d+]/g, "") };
    });
  for (const s of socials) {
    if (s.url && !/^https:\/\//.test(s.url)) errors["socials"] = "https_required";
  }

  const email = text(f, "email");
  if (email && !z.email().safeParse(email).success) errors["email"] = "email";
  const years = int(f, "yearsActive");
  if (Number.isNaN(years) || (years !== null && (years < 0 || years > 100))) errors["yearsActive"] = "number";

  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  const values = {
    name,
    tagline,
    phones,
    email,
    workingHours: optionalLocalized(f, "workingHours"),
    socials,
    showPrices: bool(f, "showPrices"),
    showStudentCount: bool(f, "showStudentCount"),
    stats: years !== null ? { yearsActive: years } : {},
    seo: { title: localized(f, "seoTitle"), description: localized(f, "seoDescription") },
  };
  await getDb().update(siteSettings).set(values).where(eq(siteSettings.tenantId, user.tenantId));
  await audit(user.tenantId, user.userId, "update", "site_settings", user.tenantId, values);
  updateTag(TAGS.settings);
  updateTag(TAGS.stats);
  return { ok: true, savedAt: Date.now() };
}
