"use server";

import { sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getDb, pageBlocks } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { TAGS } from "@/server/content";
import { PAGE_BLOCK_KEYS } from "@/lib/page-blocks";
import { audit, localized, type ActionState } from "@/server/admin";

export async function savePageBlocks(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePermission("content.edit");
  const errors: Record<string, string> = {};
  const values = PAGE_BLOCK_KEYS.map((key) => ({ key, value: localized(f, key) }));
  for (const v of values) {
    if (!v.value.fa) errors[v.key] = "fa_required";
    if (v.value.fa.length > 600 || v.value.en.length > 600) errors[v.key] = "too_long";
  }
  if (Object.keys(errors).length) return { error: "validation", fieldErrors: errors };

  await getDb()
    .insert(pageBlocks)
    .values(values.map((v) => ({ ...v, tenantId: user.tenantId })))
    .onConflictDoUpdate({ target: [pageBlocks.tenantId, pageBlocks.key], set: { value: sql`excluded.value`, updatedAt: sql`now()` } });
  await audit(user.tenantId, user.userId, "update", "page_blocks", null, values);
  updateTag(TAGS.blocks);
  return { ok: true, savedAt: Date.now() };
}
