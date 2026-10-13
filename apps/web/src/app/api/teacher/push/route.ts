import { NextResponse } from "next/server";
import { getUser } from "@/server/auth";
import { savePushSubscription } from "@khaneyeidea/core";
import { getDb } from "@khaneyeidea/db";

export async function GET() {
  return NextResponse.json({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? "" });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = (await request.json()) as { endpoint?: string; keys?: { p256dh?: string; auth?: string }; platform?: string; standalone?: boolean };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) return NextResponse.json({ error: "bad" }, { status: 400 });
  await savePushSubscription(getDb(), {
    endpoint: body.endpoint,
    tenantId: user.tenantId,
    userId: user.userId,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    platform: body.platform ?? null,
    standalone: !!body.standalone,
  });
  return NextResponse.json({ ok: true });
}
