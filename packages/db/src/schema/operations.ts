import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { channelEnum, id, tenantId, timestamps, users } from "./core";
import { branches, courses, deliveryModeEnum, teachers, type Localized } from "./content";

/** Academy-wide teaching term (e.g. پاییز ۱۴۰۴). Classes optionally belong to one. */
export const terms = pgTable(
  "terms",
  {
    id: id(),
    tenantId: tenantId(),
    name: jsonb("name").$type<Localized>().notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    ...timestamps(),
  },
  (t) => [index("terms_tenant_start_idx").on(t.tenantId, t.startsOn)],
);

export const rooms = pgTable("rooms", {
  id: id(),
  tenantId: tenantId(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  capacity: integer("capacity"),
  active: boolean("active").notNull().default(true),
});

export const students = pgTable("students", {
  id: id(),
  tenantId: tenantId(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthYear: integer("birth_year"),
  /** Optional login for older students. Younger children live under their guardian's account. */
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  ...timestamps(),
});

export const guardians = pgTable(
  "guardians",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    relation: text("relation"),
    /** Consent to show this child in public project photos. */
    mediaConsent: boolean("media_consent").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.userId] })],
);

/** A recurring class: course + teacher + place + weekly slot. */
export const classGroups = pgTable(
  "class_groups",
  {
    id: id(),
    tenantId: tenantId(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
    termId: uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** 0 = Saturday ... 6 = Friday (Iranian week) */
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    mode: deliveryModeEnum("mode").notNull().default("in_person"),
    capacity: integer("capacity").notNull().default(8),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    onlineUrl: text("online_url"),
    /** Invite links of the class groups (shown to staff and sent to new students); the bot-linked chat is in chat_links. */
    baleInviteUrl: text("bale_invite_url"),
    telegramInviteUrl: text("telegram_invite_url"),
    /** Polish the teacher's notes into a report through the AI provider. Off means a fixed template. */
    aiReportEnabled: boolean("ai_report_enabled").notNull().default(false),
    /** Post the evening-before notice that this class will be held. */
    eveNoticeEnabled: boolean("eve_notice_enabled").notNull().default(true),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("class_groups_teacher_idx").on(t.teacherId),
    index("class_groups_weekday_idx").on(t.tenantId, t.weekday),
    index("class_groups_term_idx").on(t.termId),
  ],
);

/** Bale / Telegram group linked to a class. */
export const chatLinks = pgTable(
  "chat_links",
  {
    id: id(),
    tenantId: tenantId(),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    chatId: text("chat_id").notNull(),
    inviteLink: text("invite_link"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("chat_links_class_channel_uq").on(t.classGroupId, t.channel)],
);

export const enrollmentStatusEnum = pgEnum("enrollment_status", ["active", "waitlist", "paused", "dropped", "finished"]);

export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    tenantId: tenantId(),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: enrollmentStatusEnum("status").notNull().default("active"),
    startedOn: date("started_on"),
    /** Set when status becomes finished or dropped. */
    endedOn: date("ended_on"),
    /** Package size for this student's term in the class (usually 6 or 7). */
    plannedSessions: smallint("planned_sessions").notNull().default(7),
    /** When counting held sessions toward the package starts. Falls back to startedOn. */
    termStartedOn: date("term_started_on"),
    ...timestamps(),
  },
  (t) => [
    // One open seat per student per class; finished/dropped rows stay for history and allow re-enroll.
    uniqueIndex("enrollment_open_uq")
      .on(t.classGroupId, t.studentId)
      .where(sql`status IN ('active', 'waitlist', 'paused')`),
    index("enrollments_student_idx").on(t.studentId),
  ],
);

// Session lifecycle, see docs/specs/SESSION-LIFECYCLE.md
export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "cancel_planned",
  "awaiting_teacher",
  "held_incomplete",
  "held",
  "not_held",
  "needs_makeup",
]);

export const classSessions = pgTable(
  "class_sessions",
  {
    id: id(),
    tenantId: tenantId(),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: sessionStatusEnum("status").notNull().default("scheduled"),
    notHeldReason: text("not_held_reason"),
    needsMakeup: boolean("needs_makeup").notNull().default(false),
    makeupOfSessionId: uuid("makeup_of_session_id"),
    /** Moved to another time or added as a makeup: off the weekly pattern, so schedule syncing leaves it alone. */
    custom: boolean("custom").notNull().default(false),
    /** The weekly slot this session was moved away from (so syncing does not re-create that slot). */
    originalStartsAt: timestamp("original_starts_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("class_sessions_slot_uq").on(t.classGroupId, t.startsAt),
    index("class_sessions_time_idx").on(t.tenantId, t.startsAt),
  ],
);

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "excused"]);

export const attendance = pgTable(
  "attendance",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    isMakeup: boolean("is_makeup").notNull().default(false),
    /** Teacher mark for class engagement, 0–5. Only for present students. */
    activityScore: smallint("activity_score"),
    /** Teacher mark for homework / practice, 0–3. Only for present students. */
    homeworkScore: smallint("homework_score"),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.studentId] })],
);

export const reportStatusEnum = pgEnum("report_status", ["draft", "pending_approval", "approved", "published", "rejected"]);

export const sessionReports = pgTable("session_reports", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => classSessions.id, { onDelete: "cascade" }),
  /** Text that was actually posted, or the latest draft while still unpublished. */
  summary: text("summary").notNull(),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  status: reportStatusEnum("status").notNull().default("published"),
  rawText: text("raw_text"),
  voiceKey: text("voice_key"),
  aiText: text("ai_text"),
  finalText: text("final_text"),
  submittedByUserId: uuid("submitted_by_user_id"),
  approvedByUserId: uuid("approved_by_user_id"),
  channel: channelEnum("channel"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const homework = pgTable("homework", {
  id: id(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => classSessions.id, { onDelete: "cascade" }),
  text: text("text"),
  rawText: text("raw_text"),
  aiText: text("ai_text"),
  voiceKey: text("voice_key"),
  attachments: jsonb("attachments").$type<{ url: string; name: string }[]>().notNull().default([]),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentNotes = pgTable(
  "student_notes",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.studentId] })],
);

/** Progress of the post-class bot conversation with the teacher. */
export const sessionCheckins = pgTable("session_checkins", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => classSessions.id, { onDelete: "cascade" }),
  step: text("step").notNull().default("asked"),
  /** The channel whose answer won; the other channel's prompt is deleted or edited. */
  answeredChannel: channelEnum("answered_channel"),
  draft: jsonb("draft").$type<Record<string, unknown>>().notNull().default({}),
  firstAskedAt: timestamp("first_asked_at", { withTimezone: true }),
  remindedAt: timestamp("reminded_at", { withTimezone: true }),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  ...timestamps(),
});

export const outboundStateEnum = pgEnum("outbound_state", ["sent", "deleted", "edited", "failed"]);

/** Every bot message we may need to delete or edit later. */
export const outboundMessages = pgTable(
  "outbound_messages",
  {
    id: id(),
    tenantId: tenantId(),
    channel: channelEnum("channel").notNull(),
    chatId: text("chat_id").notNull(),
    messageId: text("message_id").notNull(),
    kind: text("kind").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    state: outboundStateEnum("state").notNull().default("sent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outbound_ref_idx").on(t.refType, t.refId)],
);

export const announcementStatusEnum = pgEnum("announcement_status", ["draft", "scheduled", "sent", "canceled", "failed"]);

export const scheduledAnnouncements = pgTable("scheduled_announcements", {
  id: id(),
  tenantId: tenantId(),
  sessionId: uuid("session_id").references(() => classSessions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
  /** group/parents pick the audience. kind distinguishes a class report from a cancellation or the evening notice. */
  targets: jsonb("targets").$type<{ group: boolean; parents: boolean; kind?: "notice" | "report" | "eve" }>().notNull(),
  status: announcementStatusEnum("status").notNull().default("draft"),
  aiDrafted: boolean("ai_drafted").notNull().default(false),
  approvedByUserId: uuid("approved_by_user_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps(),
});

export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected"]);

export const cancellationRequests = pgTable("cancellation_requests", {
  id: id(),
  tenantId: tenantId(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => classSessions.id, { onDelete: "cascade" }),
  requestedByUserId: uuid("requested_by_user_id").notNull(),
  reason: text("reason"),
  status: requestStatusEnum("status").notNull().default("pending"),
  decidedByUserId: uuid("decided_by_user_id"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One-time codes that connect a bot chat to something in the platform:
 * - kind "user": a teacher or parent opens the bot with /start CODE to link their account;
 * - kind "class": an admin posts /link CODE in a Bale or Telegram group to attach it to a class.
 */
export const linkCodes = pgTable(
  "link_codes",
  {
    id: id(),
    tenantId: tenantId(),
    code: text("code").notNull(),
    kind: text("kind").$type<"user" | "class">().notNull(),
    refId: uuid("ref_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("link_codes_code_uq").on(t.code)],
);

/** Browser push subscriptions for the teacher (and admin) web app. Endpoint is the push service URL. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    platform: text("platform"),
    standalone: boolean("standalone").notNull().default(false),
    failCount: integer("fail_count").notNull().default(0),
    lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/**
 * A question in a class group that tagged the teacher. Reminded in private until the teacher replies in that group.
 */
export const groupMentions = pgTable(
  "group_mentions",
  {
    id: id(),
    tenantId: tenantId(),
    channel: channelEnum("channel").notNull(),
    chatId: text("chat_id").notNull(),
    messageId: text("message_id").notNull(),
    classGroupId: uuid("class_group_id").references(() => classGroups.id, { onDelete: "set null" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    snippet: text("snippet"),
    askedAt: timestamp("asked_at", { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("group_mentions_msg_uq").on(t.channel, t.chatId, t.messageId), index("group_mentions_open_idx").on(t.teacherId, t.answeredAt)],
);
