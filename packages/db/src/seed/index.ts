// Seeds the default tenant from curated data + docs/site-export/structured.json.
// Safe to re-run: it wipes and recreates the tenant's CONTENT tables only (dev use).
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../index";
import * as s from "../schema";
import type { Localized } from "../schema";
import { BRANCHES, COURSES, DEPARTMENTS, PAGE_BLOCKS, SAMPLE_TEACHERS } from "./data";

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
const clean = (t: string) => t.replace(/\s*-\s*$/, "").replace(/\s+/g, " ").trim();
const decodePath = (url: string) => decodeURIComponent(new URL(url).pathname);

function rankOf(title: string): string | null {
  if (title.includes("طلا")) return "gold";
  if (title.includes("نقره")) return "silver";
  if (title.includes("برنز")) return "bronze";
  if (title.includes("رتبه اول") || title.includes("مقام اول")) return "1";
  if (title.includes("رتبه دوم") || title.includes("مقام دوم")) return "2";
  if (title.includes("رتبه سوم") || title.includes("مقام سوم")) return "3";
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

  await tx.insert(s.branches).values(BRANCHES.map((b, i) => ({ tenantId, ...b, sortOrder: i })));

  const depts = await tx
    .insert(s.departments)
    .values(DEPARTMENTS.map((d, i) => ({ tenantId, slug: d.slug, title: d.title, icon: d.icon, sortOrder: i })))
    .returning();
  const deptId = new Map(depts.map((d) => [d.slug, d.id]));

  const syllabusByPath = new Map(exported.courses.map((c) => [decodePath(c.page_url), c.syllabus ?? []]));
  await tx.insert(s.courses).values(
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
  );
  await tx.insert(s.redirects).values(
    COURSES.map((c) => ({ tenantId, fromPath: c.legacyPath, toPath: `/courses/${c.slug}`, permanent: true })),
  );

  await tx.insert(s.teachers).values(
    SAMPLE_TEACHERS.map((t, i) => ({ tenantId, ...t, isSample: true, sortOrder: i })),
  );

  const achs = exported.achievements.map((a) => clean(a.title));
  await tx.insert(s.achievements).values(
    exported.achievements.map((a, i) => {
      const title = achs[i]!;
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
