import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, smallint, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps, users } from "./core";
import { branches, courses, departments, type Localized } from "./content";

// Booking (proposal 4.2): the admin defines a time template once and the system offers the slots.
// Every booking also records where it came from, so the admin can see which channel brings people.

export const appointmentKindEnum = pgEnum("appointment_kind", ["trial_class", "consultation", "placement", "visit"]);
/** Where the meeting happens. Phone and online meetings have no branch. */
export const appointmentPlaceEnum = pgEnum("appointment_place", ["in_person", "phone", "online"]);

export const appointmentTypes = pgTable("appointment_types", {
  id: id(),
  tenantId: tenantId(),
  kind: appointmentKindEnum("kind").notNull(),
  place: appointmentPlaceEnum("place").notNull().default("in_person"),
  title: jsonb("title").$type<Localized>().notNull(),
  description: jsonb("description").$type<Localized>(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
});

export const availabilityTemplates = pgTable(
  "availability_templates",
  {
    id: id(),
    tenantId: tenantId(),
    appointmentTypeId: uuid("appointment_type_id")
      .notNull()
      .references(() => appointmentTypes.id, { onDelete: "cascade" }),
    /** Internal label shown in the panel, e.g. "Robotics trial, ages 7-9, Gholhak". */
    name: text("name").notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    /** Optional narrowing: a template for one department or one course. */
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    ageMin: smallint("age_min"),
    ageMax: smallint("age_max"),
    /** 0 = Saturday ... 6 = Friday (Iranian week). */
    weekdays: smallint("weekdays").array().notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    slotMinutes: smallint("slot_minutes").notNull().default(45),
    capacity: smallint("capacity").notNull().default(1),
    minLeadHours: smallint("min_lead_hours").notNull().default(3),
    maxDaysAhead: smallint("max_days_ahead").notNull().default(14),
    validFrom: date("valid_from"),
    validUntil: date("valid_until"),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("availability_templates_tenant_idx").on(t.tenantId, t.active)],
);

/** A closed day: for every branch (branchId null), one branch, or one template. */
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: id(),
    tenantId: tenantId(),
    date: date("date").notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => availabilityTemplates.id, { onDelete: "cascade" }),
    reason: jsonb("reason").$type<Localized>(),
    ...timestamps(),
  },
  (t) => [index("availability_exceptions_date_idx").on(t.tenantId, t.date)],
);

export const appointmentStatusEnum = pgEnum("appointment_status", ["booked", "confirmed", "canceled", "attended", "no_show"]);
export const leadSourceEnum = pgEnum("lead_source", ["site", "bale", "telegram", "instagram", "referral", "phone", "admin"]);

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    tenantId: tenantId(),
    templateId: uuid("template_id").references(() => availabilityTemplates.id, { onDelete: "set null" }),
    appointmentTypeId: uuid("appointment_type_id")
      .notNull()
      .references(() => appointmentTypes.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("booked"),
    source: leadSourceEnum("source").notNull().default("site"),
    /** The account that booked (parents are signed in by the phone code). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Normalized mobile, 98XXXXXXXXXX. */
    phone: text("phone").notNull(),
    guardianName: text("guardian_name"),
    /** Children's data is minimized: first name and age only, no surname, no school. */
    childFirstName: text("child_first_name"),
    childAge: smallint("child_age"),
    note: text("note"),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("appointments_slot_idx").on(t.templateId, t.startsAt),
    index("appointments_tenant_time_idx").on(t.tenantId, t.startsAt),
    index("appointments_phone_idx").on(t.tenantId, t.phone),
    // The same phone cannot hold two live bookings in one slot.
    uniqueIndex("appointments_one_per_phone_slot_uq")
      .on(t.templateId, t.startsAt, t.phone)
      .where(sql`status <> 'canceled'`),
  ],
);
