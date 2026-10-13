import { eq } from "drizzle-orm";
import { pushSubscriptions, type getDb } from "@khaneyeidea/db";

type Db = ReturnType<typeof getDb>;

export type PushPayload = { title: string; body: string; url: string; tag: string };
export type PushDeliver = (sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload) => Promise<"ok" | "gone" | "fail">;

export async function savePushSubscription(
  db: Db,
  row: { endpoint: string; tenantId: string; userId: string; p256dh: string; auth: string; platform?: string | null; standalone?: boolean },
) {
  await db
    .insert(pushSubscriptions)
    .values({ ...row, standalone: row.standalone ?? false, failCount: 0 })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: row.userId, tenantId: row.tenantId, p256dh: row.p256dh, auth: row.auth, platform: row.platform ?? null, standalone: row.standalone ?? false, failCount: 0 },
    });
}

/** Sends to every subscription of the user. Gone endpoints (404/410) are deleted. */
export async function sendPush(db: Db, userId: string, payload: PushPayload, deliver: PushDeliver) {
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  for (const s of subs) {
    const result = await deliver({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload).catch(() => "fail" as const);
    if (result === "gone") await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
    else if (result === "ok") {
      sent++;
      await db.update(pushSubscriptions).set({ lastOkAt: new Date(), failCount: 0 }).where(eq(pushSubscriptions.endpoint, s.endpoint));
    } else {
      await db.update(pushSubscriptions).set({ failCount: s.failCount + 1 }).where(eq(pushSubscriptions.endpoint, s.endpoint));
    }
  }
  return { sent };
}

/** web-push delivery. Returns fail when VAPID keys are not configured (development without push). */
export async function deliverWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<"ok" | "gone" | "fail"> {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return "fail";
  const webpush = await import("web-push");
  webpush.setVapidDetails(subject, pub, priv);
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: "high" },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push] send failed", status ?? (e instanceof Error ? e.message : e));
    return "fail";
  }
}
