// Development only: sample classes, teacher logins, students, parents and a few weeks of sessions, so the session
// board and the teacher/parent panels can be tried. Every demo student's surname is "(نمونه)".
//   pnpm db:demo            (adds demo data; safe to run again)
// Sign in as a demo teacher: 09120000101..   demo parent: 09350000001..   (code = OTP_DEV_CODE, e.g. 1234)
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { and, asc, eq, like } from "drizzle-orm";
import {
  attendance,
  branches,
  classGroups,
  classSessions,
  closeDb,
  courses,
  enrollments,
  getDb,
  guardians,
  homework,
  sessionReports,
  students,
  teachers,
  tenants,
} from "@khaneyeidea/db";
import { addDays, classDays, findOrCreateUser, grantRole, sessionTimes, syncClassSessions, tehranDay } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
if (process.env.NODE_ENV === "production") {
  console.error("db:demo is for development only.");
  process.exit(1);
}

const db = getDb();
const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";
const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
if (!tenant) throw new Error("run pnpm db:migrate && pnpm db:seed first");
const tid = tenant.id;

const existing = await db.select({ id: classGroups.id }).from(classGroups).where(and(eq(classGroups.tenantId, tid), like(classGroups.title, "%(نمونه)%")));
if (existing.length) {
  console.log("Demo data already exists. Nothing to do.");
  await closeDb();
  process.exit(0);
}

const coaches = await db.select().from(teachers).where(eq(teachers.tenantId, tid)).orderBy(asc(teachers.sortOrder));
const brs = await db.select().from(branches).where(eq(branches.tenantId, tid)).orderBy(asc(branches.sortOrder));
const crs = await db.select().from(courses).where(and(eq(courses.tenantId, tid), eq(courses.status, "published"))).orderBy(asc(courses.sortOrder));
const course = (s: string) => crs.find((c) => c.slug === s) ?? crs[0]!;

// Teacher logins linked to the sample coach profiles.
for (const [i, coach] of coaches.entries()) {
  const u = (await findOrCreateUser(db, tid, `0912000010${i + 1}`, coach.name.fa))!;
  await grantRole(db, u.id, "teacher", null);
  await db.update(teachers).set({ userId: u.id }).where(eq(teachers.id, coach.id));
}

const today = tehranDay(new Date());
const start = addDays(today, -21);
const plan = [
  { title: "رباتیک ۱، شنبه‌ها (نمونه)", course: "robotics", weekday: 0, start: "16:00", end: "17:30" },
  { title: "پایتون نوجوانان، یکشنبه‌ها (نمونه)", course: "python", weekday: 1, start: "17:00", end: "18:30" },
  { title: "آردوینو، دوشنبه‌ها (نمونه)", course: "arduino", weekday: 2, start: "16:30", end: "18:00" },
  { title: "هوش مصنوعی، سه‌شنبه‌ها (نمونه)", course: "ai", weekday: 3, start: "18:00", end: "19:30" },
  { title: "رباتیک ۲، چهارشنبه‌ها (نمونه)", course: "robotics", weekday: 4, start: "16:00", end: "17:30" },
  { title: "بازی‌سازی آنلاین، پنجشنبه‌ها (نمونه)", course: "game-dev", weekday: 5, start: "10:00", end: "11:30" },
];
const names = ["آوا", "کیان", "نیلا", "آرتین", "ترانه", "بردیا", "هستی", "پارسا", "یسنا", "رادین", "ملیکا", "سام", "دلارام", "آرسام", "روژان", "ماهان"];

const kids = [];
for (const [i, first] of names.entries()) {
  const [kid] = await db.insert(students).values({ tenantId: tid, firstName: first, lastName: "(نمونه)", birthYear: 1393 + (i % 7) }).returning();
  const parent = (await findOrCreateUser(db, tid, `09350000${String(i + 1).padStart(3, "0")}`, `والد ${first}`))!;
  await grantRole(db, parent.id, "parent", null);
  await db.insert(guardians).values({ studentId: kid!.id, userId: parent.id, relation: i % 2 ? "father" : "mother" });
  kids.push(kid!);
}

const reports = ["ساخت شاسی ربات و آشنایی با موتورها", "برنامه‌نویسی حسگر فاصله و تست مسیر", "حلقه‌ها و شرط‌ها با مثال‌های بازی", "پروژه‌ی چراغ راهنمایی با LED"];
for (const [i, p] of plan.entries()) {
  const online = p.course === "game-dev";
  const [c] = await db
    .insert(classGroups)
    .values({
      tenantId: tid,
      courseId: course(p.course).id,
      teacherId: coaches[i % coaches.length]?.id ?? null,
      branchId: online ? null : brs[i % brs.length]?.id ?? null,
      title: p.title,
      weekday: p.weekday,
      startTime: p.start,
      endTime: p.end,
      capacity: 8,
      mode: online ? "online" : "in_person",
      onlineUrl: online ? "https://meet.example.com/demo" : null,
      startsOn: start,
    })
    .returning();
  const roster = kids.filter((_, k) => (k + i) % 3 !== 0).slice(0, 7);
  await db.insert(enrollments).values(roster.map((k) => ({ tenantId: tid, classGroupId: c!.id, studentId: k.id, status: "active" as const, startedOn: start })));
  // Past sessions: held with attendance and a report (last one left for the teacher to answer).
  const past = classDays(c!, start, addDays(today, -1));
  for (const [j, day] of past.entries()) {
    const { startsAt, endsAt } = sessionTimes(c!, day);
    const answered = j < past.length - 1;
    const [s] = await db
      .insert(classSessions)
      .values({ tenantId: tid, classGroupId: c!.id, teacherId: c!.teacherId, startsAt, endsAt, status: answered ? "held" : "scheduled" })
      .returning();
    if (!answered) continue;
    await db.insert(attendance).values(roster.map((k, n) => ({ sessionId: s!.id, studentId: k.id, status: (n + j) % 6 === 0 ? ("absent" as const) : ("present" as const) })));
    await db.insert(sessionReports).values({ sessionId: s!.id, summary: reports[(i + j) % reports.length]!, channel: "web" });
    await db.insert(homework).values({ sessionId: s!.id, text: "کامل کردن پروژه‌ی جلسه و آوردن سؤال‌ها" });
  }
  await syncClassSessions(db, tid, c!.id);
}

console.log(`Demo: ${plan.length} classes, ${kids.length} students, ${coaches.length} teacher logins.`);
console.log("Teacher login: 09120000101   Parent login: 09350000001   (code: OTP_DEV_CODE)");
await closeDb();
