import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { appointments, appointmentTypes, branches, messengerAccounts, userRoles, users, type getDb } from "@khaneyeidea/db";
import { notifyAdmins, type Messengers } from "./followup";
import { sendPush, type PushDeliver } from "./push";

type Db = ReturnType<typeof getDb>;

const fmtDay = (d: Date) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long" }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const localPhone = (p: string) => `0${p.slice(2)}`;
const DAY = 24 * 3_600_000;

/**
 * Tells the admins (Bale, Telegram, web push) about bookings nobody has announced yet, with confirm and cancel
 * buttons. A booking is claimed before sending so two bot processes never announce it twice; if nobody could be
 * reached the claim is released and the next tick tries again. Bookings older than a day are never announced.
 */
export async function notifyNewBookings(db: Db, ms: Messengers, deliver: PushDeliver | null, now = new Date()) {
  const rows = await db
    .select({ a: appointments, type: appointmentTypes.title, branch: branches.name })
    .from(appointments)
    .innerJoin(appointmentTypes, eq(appointmentTypes.id, appointments.appointmentTypeId))
    .leftJoin(branches, eq(branches.id, appointments.branchId))
    .where(and(isNull(appointments.notifiedAt), ne(appointments.status, "canceled")));
  let told = 0;
  for (const r of rows) {
    const a = r.a;
    if (a.createdAt.getTime() < now.getTime() - DAY) {
      await db.update(appointments).set({ notifiedAt: now }).where(and(eq(appointments.id, a.id), isNull(appointments.notifiedAt)));
      continue;
    }
    const [claim] = await db.update(appointments).set({ notifiedAt: now }).where(and(eq(appointments.id, a.id), isNull(appointments.notifiedAt))).returning({ id: appointments.id });
    if (!claim) continue;
    const place = r.branch ? r.branch.fa : "آنلاین یا تلفنی";
    const lines = [
      `رزرو تازه: ${r.type.fa}`,
      `${fmtDay(a.startsAt)}، ساعت ${fmtTime(a.startsAt)}${place ? ` (${place})` : ""}`,
      `والد: ${a.guardianName ?? "-"}، تلفن ${localPhone(a.phone)}`,
      a.childFirstName || a.childAge ? `کودک: ${[a.childFirstName, a.childAge ? `${a.childAge} ساله` : null].filter(Boolean).join("، ")}` : null,
      a.note ? `یادداشت: ${a.note}` : null,
    ].filter(Boolean) as string[];
    const text = lines.join("\n");
    let reached = await notifyAdmins(db, ms, a.tenantId, "booking_new", text, [[{ text: "تأیید", data: `bkok:${a.id}` }, { text: "لغو", data: `bkno:${a.id}` }]]);
    if (deliver) {
      const admins = await db
        .selectDistinct({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(users, eq(users.id, userRoles.userId))
        .where(and(inArray(userRoles.role, ["owner", "admin"]), eq(users.tenantId, a.tenantId)));
      for (const u of admins) reached += (await sendPush(db, u.userId, { title: "رزرو تازه", body: `${r.type.fa}، ${fmtDay(a.startsAt)} ${fmtTime(a.startsAt)}`, url: "/app/admin/booking", tag: `booking-${a.id}` }, deliver).catch(() => ({ sent: 0 }))).sent;
    }
    if (reached > 0) told++;
    else await db.update(appointments).set({ notifiedAt: null }).where(eq(appointments.id, a.id));
  }
  return { told };
}

/** The confirm / cancel buttons under a booking notice. Only admins may press them. */
export async function handleBookingCallback(
  db: Db,
  ms: Messengers,
  p: { channel: "bale" | "telegram"; chatId: string; messageId: string; data: string },
): Promise<{ toast?: string } | null> {
  const [op, id] = p.data.split(":");
  if ((op !== "bkok" && op !== "bkno") || !id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const [acc] = await db.select().from(messengerAccounts).where(and(eq(messengerAccounts.channel, p.channel), eq(messengerAccounts.chatId, p.chatId)));
  const roles = acc ? await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, acc.userId)) : [];
  if (!roles.some((x) => x.role === "owner" || x.role === "admin")) return { toast: "فقط مدیر می‌تواند رزرو را تأیید یا لغو کند." };
  const me = ms[p.channel]!;
  const [cur] = await db.select().from(appointments).where(eq(appointments.id, id));
  if (!cur) return { toast: "این رزرو پیدا نشد." };
  if (op === "bkok") {
    const [won] = await db.update(appointments).set({ status: "confirmed" }).where(and(eq(appointments.id, id), eq(appointments.status, "booked"))).returning({ id: appointments.id });
    if (!won) return { toast: "این رزرو قبلاً تعیین تکلیف شده." };
    await me.edit(p.chatId, p.messageId, `تأیید شد ✓\n${fmtDay(cur.startsAt)}، ${fmtTime(cur.startsAt)}`);
    return {};
  }
  const [won] = await db
    .update(appointments)
    .set({ status: "canceled", canceledAt: new Date() })
    .where(and(eq(appointments.id, id), inArray(appointments.status, ["booked", "confirmed"])))
    .returning({ id: appointments.id });
  if (!won) return { toast: "این رزرو قبلاً تعیین تکلیف شده." };
  await me.edit(p.chatId, p.messageId, `لغو شد. وقت دوباره آزاد است.\n${fmtDay(cur.startsAt)}، ${fmtTime(cur.startsAt)}`);
  return {};
}
