import { and, eq, gt, isNull } from "drizzle-orm";
import { chatLinks, classGroups, linkCodes, messengerAccounts, users, type getDb } from "@khaneyeidea/db";

type Db = ReturnType<typeof getDb>;
export type BotChannel = "bale" | "telegram";

// One-time codes that connect a bot chat to the platform. A teacher (or parent) links their own chat with
// /start CODE in a private chat; an admin links a class group with /link CODE posted in that group.

const TTL_MIN = { user: 60, class: 30 } as const;
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

export async function createLinkCode(db: Db, tenantId: string, kind: "user" | "class", refId: string, now = new Date()) {
  for (let i = 0; i < 6; i++) {
    const code = newCode();
    const [row] = await db
      .insert(linkCodes)
      .values({ tenantId, code, kind, refId, expiresAt: new Date(now.getTime() + TTL_MIN[kind] * 60_000) })
      .onConflictDoNothing()
      .returning({ code: linkCodes.code, expiresAt: linkCodes.expiresAt });
    if (row) return row;
  }
  throw new Error("could not create a link code");
}

/** Marks a live code used (atomically) and returns it, or null if unknown, expired or already used. */
async function take(db: Db, code: string, kind: "user" | "class", now: Date) {
  const [row] = await db
    .update(linkCodes)
    .set({ usedAt: now })
    .where(and(eq(linkCodes.code, code.trim()), eq(linkCodes.kind, kind), isNull(linkCodes.usedAt), gt(linkCodes.expiresAt, now)))
    .returning();
  return row ?? null;
}

/** /start CODE in a private chat: this chat now belongs to that user for this channel. */
export async function redeemUserCode(db: Db, p: { code: string; channel: BotChannel; chatId: string; username?: string | null; now?: Date }) {
  const row = await take(db, p.code, "user", p.now ?? new Date());
  if (!row) return { ok: false as const };
  const [u] = await db.select().from(users).where(eq(users.id, row.refId));
  if (!u) return { ok: false as const };
  await db.transaction(async (tx) => {
    // a chat belongs to one account; a user has one chat per channel
    await tx.delete(messengerAccounts).where(and(eq(messengerAccounts.channel, p.channel), eq(messengerAccounts.chatId, p.chatId)));
    await tx.delete(messengerAccounts).where(and(eq(messengerAccounts.userId, u.id), eq(messengerAccounts.channel, p.channel)));
    await tx.insert(messengerAccounts).values({ userId: u.id, channel: p.channel, chatId: p.chatId, username: p.username ?? null });
  });
  return { ok: true as const, userId: u.id, name: u.fullName };
}

/** /link CODE in a group: that group is now the class's group for this channel. */
export async function redeemClassCode(db: Db, p: { code: string; channel: BotChannel; chatId: string; now?: Date }) {
  const row = await take(db, p.code, "class", p.now ?? new Date());
  if (!row) return { ok: false as const };
  const [c] = await db.select().from(classGroups).where(eq(classGroups.id, row.refId));
  if (!c) return { ok: false as const };
  await db
    .insert(chatLinks)
    .values({ tenantId: c.tenantId, classGroupId: c.id, channel: p.channel, chatId: p.chatId })
    .onConflictDoUpdate({ target: [chatLinks.classGroupId, chatLinks.channel], set: { chatId: p.chatId, linkedAt: new Date() } });
  return { ok: true as const, classId: c.id, title: c.title };
}
