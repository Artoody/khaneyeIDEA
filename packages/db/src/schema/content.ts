import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, tenants, timestamps } from "./core";

// Everything in this file is edited by admins in the panel (docs/specs/SITE-CONTENT.md).
// Text fields come in fa/en pairs; English is a full second locale.

export type Localized = { fa: string; en: string };
export type PhoneEntry = { label: Localized; number: string; primary?: boolean };
export type SocialEntry = {
  kind: "instagram" | "bale" | "telegram" | "whatsapp" | "youtube" | "aparat" | "linkedin";
  url: string;
  enabled: boolean;
};
export type SeoFields = { title?: Localized; description?: Localized; image?: string };
export type MediaItem = { url: string; alt: Localized; kind: "image" | "video"; width?: number; height?: number };

export const siteSettings = pgTable("site_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: jsonb("name").$type<Localized>().notNull(),
  tagline: jsonb("tagline").$type<Localized>().notNull(),
  phones: jsonb("phones").$type<PhoneEntry[]>().notNull().default([]),
  email: text("email"),
  workingHours: jsonb("working_hours").$type<Localized>(),
  socials: jsonb("socials").$type<SocialEntry[]>().notNull().default([]),
  /** Global switch; each course can still hide its own price. */
  showPrices: boolean("show_prices").notNull().default(false),
  /** Show the live student count on the home page (only real numbers, never typed by hand). */
  showStudentCount: boolean("show_student_count").notNull().default(true),
  stats: jsonb("stats").$type<{ yearsActive?: number }>().notNull().default({}),
  seo: jsonb("seo").$type<SeoFields>().notNull().default({}),
  ...timestamps(),
});

/** Free text blocks of fixed page sections (home hero copy, about page...). Layout stays in code. */
export const pageBlocks = pgTable(
  "page_blocks",
  {
    tenantId: tenantId(),
    key: text("key").notNull(),
    value: jsonb("value").$type<Localized>().notNull(),
    ...timestamps(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);

export const branches = pgTable(
  "branches",
  {
    id: id(),
    tenantId: tenantId(),
    slug: text("slug").notNull(),
    name: jsonb("name").$type<Localized>().notNull(),
    address: jsonb("address").$type<Localized>(),
    district: jsonb("district").$type<Localized>(),
    phone: text("phone"),
    hours: jsonb("hours").$type<Localized>(),
    mapUrl: text("map_url"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    appointmentOnly: boolean("appointment_only").notNull().default(false),
    image: text("image"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex("branches_slug_uq").on(t.tenantId, t.slug)],
);

export const departments = pgTable(
  "departments",
  {
    id: id(),
    tenantId: tenantId(),
    slug: text("slug").notNull(),
    title: jsonb("title").$type<Localized>().notNull(),
    description: jsonb("description").$type<Localized>(),
    icon: text("icon"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex("departments_slug_uq").on(t.tenantId, t.slug)],
);

export const publishStatusEnum = pgEnum("publish_status", ["draft", "published"]);
export const priceVisibilityEnum = pgEnum("price_visibility", ["show", "hide", "contact"]);
export const deliveryModeEnum = pgEnum("delivery_mode", ["in_person", "online", "hybrid"]);

export const courses = pgTable(
  "courses",
  {
    id: id(),
    tenantId: tenantId(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    title: jsonb("title").$type<Localized>().notNull(),
    summary: jsonb("summary").$type<Localized>(),
    body: jsonb("body").$type<Localized>(),
    ageMin: integer("age_min"),
    ageMax: integer("age_max"),
    level: text("level"),
    prerequisites: jsonb("prerequisites").$type<Localized>(),
    durationWeeks: integer("duration_weeks"),
    sessionsCount: integer("sessions_count"),
    syllabus: jsonb("syllabus").$type<Localized[]>().notNull().default([]),
    modes: deliveryModeEnum("modes").array().notNull().default([]),
    /** Toman */
    price: integer("price"),
    priceVisibility: priceVisibilityEnum("price_visibility").notNull().default("contact"),
    coverImage: text("cover_image"),
    gallery: jsonb("gallery").$type<MediaItem[]>().notNull().default([]),
    faqs: jsonb("faqs").$type<{ q: Localized; a: Localized }[]>().notNull().default([]),
    status: publishStatusEnum("status").notNull().default("draft"),
    seo: jsonb("seo").$type<SeoFields>().notNull().default({}),
    legacyUrl: text("legacy_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex("courses_slug_uq").on(t.tenantId, t.slug), index("courses_dept_idx").on(t.departmentId)],
);

export const courseBranches = pgTable(
  "course_branches",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.branchId] })],
);

/**
 * Extra departments a course is also listed under (besides its main departmentId).
 * E.g. Arduino lives in Electronics but is also part of the Robotics path.
 */
export const courseDepartments = pgTable(
  "course_departments",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.departmentId] })],
);

export const teachers = pgTable("teachers", {
  id: id(),
  tenantId: tenantId(),
  /** Linked login account (for the teacher panel and bot), optional for site-only profiles. */
  userId: uuid("user_id"),
  name: jsonb("name").$type<Localized>().notNull(),
  role: jsonb("role").$type<Localized>(),
  bio: jsonb("bio").$type<Localized>(),
  photo: text("photo"),
  specialties: jsonb("specialties").$type<Localized[]>().notNull().default([]),
  showOnSite: boolean("show_on_site").notNull().default(true),
  /** Placeholder profile shown with a "sample" badge in the panel until replaced with real data. */
  isSample: boolean("is_sample").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
});

export const studentProjects = pgTable("student_projects", {
  id: id(),
  tenantId: tenantId(),
  title: jsonb("title").$type<Localized>().notNull(),
  description: jsonb("description").$type<Localized>(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  year: integer("year"),
  media: jsonb("media").$type<MediaItem[]>().notNull().default([]),
  /** Must be true (consent recorded for every child shown) before the project is public. */
  publishConsent: boolean("publish_consent").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
});

export const achievements = pgTable("achievements", {
  id: id(),
  tenantId: tenantId(),
  title: jsonb("title").$type<Localized>().notNull(),
  competition: text("competition"),
  year: integer("year"),
  country: jsonb("country").$type<Localized>(),
  /** e.g. "gold", "1st" */
  rank: text("rank"),
  scope: text("scope"),
  projectId: uuid("project_id").references(() => studentProjects.id, { onDelete: "set null" }),
  image: text("image"),
  certificateUrl: text("certificate_url"),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
});

export const faqs = pgTable("faqs", {
  id: id(),
  tenantId: tenantId(),
  category: text("category"),
  question: jsonb("question").$type<Localized>().notNull(),
  answer: jsonb("answer").$type<Localized>().notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
});

export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    tenantId: tenantId(),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path").notNull(),
    permanent: boolean("permanent").notNull().default(true),
  },
  (t) => [uniqueIndex("redirects_from_uq").on(t.tenantId, t.fromPath)],
);
