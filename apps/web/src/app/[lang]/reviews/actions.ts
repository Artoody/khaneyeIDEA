"use server";

import { z } from "zod";
import { getDb, siteReviews } from "@khaneyeidea/db";
import { tenantId } from "@/server/content";

export type ReviewSubmitState = { ok?: true; error?: string };

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  body: z.string().trim().min(20).max(1200),
  website: z.string().optional(), // honeypot
});

export async function submitSiteReview(_: ReviewSubmitState, form: FormData): Promise<ReviewSubmitState> {
  const parsed = schema.safeParse({
    name: form.get("name"),
    body: form.get("body"),
    website: String(form.get("website") ?? ""),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "name") return { error: "name" };
    if (issue?.path[0] === "body") return { error: "body" };
    return { error: "unknown" };
  }
  // Bots fill the hidden field; drop silently.
  if (parsed.data.website) return { ok: true };

  const tid = await tenantId();
  await getDb().insert(siteReviews).values({
    tenantId: tid,
    authorName: { fa: parsed.data.name, en: "" },
    body: { fa: parsed.data.body, en: "" },
    status: "pending",
    featured: false,
    sortOrder: 999,
  });
  return { ok: true };
}
