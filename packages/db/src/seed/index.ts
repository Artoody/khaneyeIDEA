// Seeds the default tenant from curated data + docs/site-export/structured.json.
// Safe to re-run: it wipes and recreates the tenant's CONTENT tables only (dev use).
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../index";
import * as s from "../schema";
import type { Localized } from "../schema";
import { ALSO_IN, APPOINTMENT_TYPES, BRANCHES, COURSES, DEPARTMENTS, PAGE_BLOCKS, SAMPLE_TEACHERS } from "./data";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

type Exported = {
  courses: { name: string; syllabus: string[] | null; page_url: string }[];
  achievements: { title: string; year: number | null; competition: string | null; country: string | null }[];
  student_projects: { title: string; description: string | null }[];
  contact: { phones: string[]; emails: string[] };
};
const exported: Exported = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../../docs/site-export/structured.json", import.meta.url)), "utf8"),
);

const L = (fa: string, en = ""): Localized => ({ fa, en });
// Titles from the old WordPress export sometimes carry Markdown image-link remnants: "title](https://...jpg)".
const clean = (t: string) =>
  t
    .replace(/^!\[/, "")
    .replace(/\]\(https?:\/\/\S*\)?.*$/, "")
    .replace(/\s*[-–]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
/** A cleaned title that is only a caption fragment (e.g. "رتبه ها شدند)") is not an achievement. */
const isFragment = (t: string) => t.length < 12 || /^[^(]*\)$/.test(t);
const decodePath = (url: string) => decodeURIComponent(new URL(url).pathname);

function rankOf(title: string): string | null {
  if (title.includes("طلا")) return "gold";
  if (title.includes("نقره")) return "silver";
  if (title.includes("برنز")) return "bronze";
  const place = /(?:رتبه|مقام)\s*(?:ی\s*)?(اول|دوم|سوم)/.exec(title)?.[1];
  if (place) return { اول: "1", دوم: "2", سوم: "3" }[place]!;
  return null;
}
function scopeOf(title: string): string | null {
  if (title.includes("جهانی")) return "world";
  if (title.includes("آسیا")) return "asia";
  if (title.includes("کشوری") || title.includes("ملی")) return "national";
  return null;
}

const db = getDb();
const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";

let [tenant] = await db.select().from(s.tenants).where(eq(s.tenants.slug, slug));
if (!tenant) [tenant] = await db.insert(s.tenants).values({ slug, name: "Idea House Academy" }).returning();
const tenantId = tenant!.id;

await db.transaction(async (tx) => {
  for (const table of [s.achievements, s.studentProjects, s.faqs, s.redirects, s.pageBlocks, s.teachers, s.courses, s.departments, s.branches]) {
    await tx.delete(table).where(eq(table.tenantId, tenantId));
  }
  await tx.delete(s.siteSettings).where(eq(s.siteSettings.tenantId, tenantId));

  await tx.insert(s.siteSettings).values({
    tenantId,
    name: L("خانه ایده", "Idea House Academy"),
    tagline: L("آموزشگاه رباتیک، برنامه‌نویسی و هوش مصنوعی", "Robotics, programming and AI academy"),
    phones: exported.contact.phones.map((number, i) => ({
      label: i === 0 ? L("پذیرش", "Admissions") : L("دپارتمان‌ها", "Departments"),
      number,
      primary: i === 0,
    })),
    email: exported.contact.emails[0] ?? null,
    socials: [
      { kind: "instagram", url: "https://www.instagram.com/khane_ide_academy/", enabled: true },
      { kind: "whatsapp", url: "https://wa.me/989913535191", enabled: true },
      { kind: "bale", url: "", enabled: false },
      { kind: "telegram", url: "", enabled: false },
    ],
    showPrices: false,
    showStudentCount: true,
    stats: { yearsActive: 15 },
    seo: {
      title: L("خانه ایده | آموزشگاه رباتیک، برنامه‌نویسی و هوش مصنوعی", "Idea House Academy | Robotics, Coding & AI for Kids"),
      description: L(PAGE_BLOCKS["home.hero.subtitle"]!.fa, PAGE_BLOCKS["home.hero.subtitle"]!.en),
    },
  });

  await tx.insert(s.pageBlocks).values(Object.entries(PAGE_BLOCKS).map(([key, value]) => ({ tenantId, key, value })));

  const branchRows = await tx.insert(s.branches).values(BRANCHES.map((b, i) => ({ tenantId, ...b, sortOrder: i }))).returning({ id: s.branches.id });

  const depts = await tx
    .insert(s.departments)
    .values(DEPARTMENTS.map((d, i) => ({ tenantId, slug: d.slug, title: d.title, icon: d.icon, sortOrder: i })))
    .returning();
  const deptId = new Map(depts.map((d) => [d.slug, d.id]));

  const syllabusByPath = new Map(exported.courses.map((c) => [decodePath(c.page_url), c.syllabus ?? []]));
  const courseRows = await tx.insert(s.courses).values(
    COURSES.map((c, i) => ({
      tenantId,
      slug: c.slug,
      departmentId: c.dept ? deptId.get(c.dept) : null,
      title: c.title,
      modes: c.modes,
      syllabus: (syllabusByPath.get(c.legacyPath) ?? []).map((item) => L(item)),
      status: c.published ? ("published" as const) : ("draft" as const),
      priceVisibility: "contact" as const,
      legacyUrl: c.legacyPath,
      sortOrder: i,
    })),
  ).returning({ id: s.courses.id, slug: s.courses.slug, modes: s.courses.modes });
  const courseId = new Map(courseRows.map((c) => [c.slug, c.id]));

  // Courses that are also part of another path (the Robotics path spans programming, electronics, design and invention).
  const extra = Object.entries(ALSO_IN).flatMap(([dept, slugs]) =>
    slugs.filter((slug) => courseId.has(slug)).map((slug) => ({ courseId: courseId.get(slug)!, departmentId: deptId.get(dept)! })),
  );
  if (extra.length) await tx.insert(s.courseDepartments).values(extra);

  // In-person courses start out offered at every branch; the admin narrows this per course.
  const offered = courseRows.filter((c) => c.modes.some((m) => m !== "online")).flatMap((c) => branchRows.map((b) => ({ courseId: c.id, branchId: b.id })));
  if (offered.length) await tx.insert(s.courseBranches).values(offered);
  await tx.insert(s.redirects).values(
    COURSES.map((c) => ({ tenantId, fromPath: c.legacyPath, toPath: `/courses/${c.slug}`, permanent: true })),
  );

  await tx.insert(s.teachers).values(
    SAMPLE_TEACHERS.map((t, i) => ({ tenantId, ...t, isSample: true, sortOrder: i })),
  );

  // Drop caption fragments and duplicates (the export lists some photos twice, thumbnail and full size).
  const seen = new Set<string>();
  const achs = exported.achievements
    .map((a) => ({ ...a, title: clean(a.title) }))
    .filter((a) => {
      const key = `${a.year}|${a.title}`;
      if (isFragment(a.title) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  await tx.insert(s.achievements).values(
    achs.map((a, i) => {
      const title = a.title;
      const rank = rankOf(title);
      const scope = scopeOf(title);
      return {
        tenantId,
        title: L(title),
        competition: a.competition,
        year: a.year,
        country: a.country ? L(a.country) : null,
        rank,
        scope,
        featured: scope === "world" && (rank === "1" || rank === "gold"),
        sortOrder: i,
      };
    }),
  );

  // Appointment types are generic (the academy's schedule lives in templates the admin creates).
  // Never wiped: bookings reference them.
  const existingTypes = await tx.select({ id: s.appointmentTypes.id }).from(s.appointmentTypes).where(eq(s.appointmentTypes.tenantId, tenantId));
  if (!existingTypes.length) await tx.insert(s.appointmentTypes).values(APPOINTMENT_TYPES.map((t, i) => ({ tenantId, ...t, sortOrder: i })));

  await tx.insert(s.studentProjects).values(
    exported.student_projects.map((p, i) => ({
      tenantId,
      title: L(clean(p.title)),
      description: p.description ? L(clean(p.description)) : null,
      year: Number(p.description?.match(/(20\d\d)/)?.[1]) || null,
      publishConsent: false,
      sortOrder: i,
    })),
  );
});

const count = async (t: typeof s.courses | typeof s.achievements | typeof s.studentProjects | typeof s.branches) =>
  (await db.select().from(t).where(eq(t.tenantId, tenantId))).length;
console.log(
  `seeded tenant "${slug}": ${await count(s.branches)} branches, ${await count(s.courses)} courses, ` +
    `${await count(s.achievements)} achievements, ${await count(s.studentProjects)} projects`,
);
await closeDb();
