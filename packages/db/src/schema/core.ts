import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Every business table carries tenant_id so the platform can later serve other academies (SaaS).
export const id = () => uuid("id").primaryKey().defaultRandom();
export const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });
export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const tenants = pgTable("tenants", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps(),
});

export const roleEnum = pgEnum("role", ["owner", "admin", "content_manager", "teacher", "parent", "student"]);
export const channelEnum = pgEnum("channel", ["bale", "telegram", "sms", "web"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    tenantId: tenantId(),
    /** E.164 without "+", e.g. 989121234567 */
    phone: text("phone").notNull(),
    fullName: text("full_name"),
    locale: text("locale").notNull().default("fa"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_tenant_phone_uq").on(t.tenantId, t.phone)],
);

/** A user may hold several roles; branchId narrows admin/teacher roles to one branch (null = all branches). */
export const userRoles = pgTable(
  "user_roles",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    branchId: uuid("branch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_roles_user_idx").on(t.userId)],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: id(),
    tenantId: tenantId(),
    phone: text("phone").notNull(),
    ip: text("ip"),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_phone_idx").on(t.tenantId, t.phone, t.createdAt), index("otp_ip_idx").on(t.ip, t.createdAt)],
);

/** Server-side sessions. The cookie holds a random token; only its SHA-256 is stored. */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

/** Link between a platform user and their Bale / Telegram chat. */
export const messengerAccounts = pgTable(
  "messenger_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    chatId: text("chat_id").notNull(),
    username: text("username"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channel] }), uniqueIndex("messenger_chat_uq").on(t.channel, t.chatId)],
);

export const notificationModeEnum = pgEnum("notification_mode", ["instant", "digest", "off"]);

/** Per-user choice of which events to hear about, how, and when (admin notification center). */
export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    mode: notificationModeEnum("mode").notNull().default("instant"),
    channels: text("channels")
      .array()
      .notNull()
      .default(sql`'{bale}'::text[]`),
    quietStart: text("quiet_start"),
    quietEnd: text("quiet_end"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventKey] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    tenantId: tenantId(),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    diff: text("diff"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.tenantId, t.entityType, t.entityId)],
);
