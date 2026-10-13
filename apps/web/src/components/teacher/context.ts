import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, teachers, users } from "@khaneyeidea/db";
import { can } from "@khaneyeidea/core";
import { href, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { getUser } from "@/server/auth";

/** Who is on the coach app: the session, their coach profile and the texts. Sends everyone else where they belong. */
export async function loadCoach(lang: Locale) {
  const user = await getUser();
  if (!user) redirect(href(lang, "/teacher/login"));
  if (!can(user, "session.report_own")) redirect(href(lang, "/app/no-access"));
  const db = getDb();
  const [account] = await db.select({ must: users.mustChangePassword }).from(users).where(eq(users.id, user.userId));
  if (account?.must) redirect(href(lang, "/teacher/password"));
  const [profile] = await db.select().from(teachers).where(and(eq(teachers.userId, user.userId), eq(teachers.tenantId, user.tenantId)));
  const o = getOpsDict(lang);
  return { user, profile: profile ?? null, o, t: o.tp };
}

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => [...w][0])
    .join("");
