"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, terms } from "@khaneyeidea/db";
import { requirePermission } from "@/server/auth";
import { href, isLocale } from "@/lib/i18n";
import { audit, localized, text } from "@/server/admin";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function saveTerm(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = text(f, "id");
  const lang = String(f.get("lang") ?? "fa");
  const name = localized(f, "name");
  const startsOn = text(f, "startsOn") ?? "";
  const endsOn = text(f, "endsOn") ?? "";
  if (!name.fa || !ISO.test(startsOn) || !ISO.test(endsOn) || endsOn < startsOn) return;
  const db = getDb();
  const values = { name, startsOn, endsOn };
  if (id && z.uuid().safeParse(id).success) {
    const res = await db
      .update(terms)
      .set(values)
      .where(and(eq(terms.id, id), eq(terms.tenantId, user.tenantId)))
      .returning({ id: terms.id });
    if (res.length) await audit(user.tenantId, user.userId, "update", "term", id, values);
  } else {
    const [row] = await db.insert(terms).values({ ...values, tenantId: user.tenantId }).returning({ id: terms.id });
    await audit(user.tenantId, user.userId, "create", "term", row!.id, values);
  }
  refresh();
  redirect(href(isLocale(lang) ? lang : "fa", "/app/admin/terms"));
}

export async function removeTerm(f: FormData) {
  const user = await requirePermission("schedule.manage");
  const id = z.uuid().parse(f.get("id"));
  const lang = String(f.get("lang") ?? "fa");
  const db = getDb();
  const res = await db.delete(terms).where(and(eq(terms.id, id), eq(terms.tenantId, user.tenantId))).returning({ id: terms.id });
  if (res.length) await audit(user.tenantId, user.userId, "delete", "term", id);
  redirect(href(isLocale(lang) ? lang : "fa", "/app/admin/terms"));
}
