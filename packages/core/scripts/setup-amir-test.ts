/**
 * One-shot: Amirhossein Pourghasem test class for today, mock students, live session, teacher login, /link code.
 * Run: pnpm --filter @khaneyeidea/core exec tsx scripts/setup-amir-test.ts
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { and, eq, like, sql } from "drizzle-orm";
import {
  classGroups,
  classSessions,
  closeDb,
  courses,
  enrollments,
  getDb,
  siteSettings,
  students,
  teachers,
  users,
} from "@khaneyeidea/db";
import { createLinkCode, grantRole, setUserPassword } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const db = getDb();
const phone = "989120000104";
const [u] = await db.select().from(users).where(eq(users.phone, phone));
if (!u) {
  console.error("Amir user missing. Run: pnpm db:demo");
  process.exit(1);
}
await grantRole(db, u.id, "teacher", null);

let [teacher] = await db
  .select()
  .from(teachers)
  .where(and(eq(teachers.tenantId, u.tenantId), sql`${teachers.name}->>'fa' like ${"%پورقاسم%"}`));
if (!teacher) {
  [teacher] = await db
    .insert(teachers)
    .values({
      tenantId: u.tenantId,
      userId: u.id,
      name: { fa: "امیرحسین پورقاسم", en: "Amirhossein Pourghasem" },
      showOnSite: false,
    })
    .returning();
} else {
  await db.update(teachers).set({ userId: u.id }).where(eq(teachers.id, teacher.id));
  teacher = { ...teacher, userId: u.id };
}

const login = await setUserPassword(db, {
  tenantId: u.tenantId,
  userId: u.id,
  username: "amir",
  password: "teacher12",
  mustChange: false,
});
if (!login.ok) console.error("login", login);

const [course] = await db.select().from(courses).where(eq(courses.tenantId, u.tenantId)).limit(1);
if (!course) {
  console.error("no course — run seed");
  process.exit(1);
}

let [klass] = await db
  .select()
  .from(classGroups)
  .where(and(eq(classGroups.teacherId, teacher!.id), like(classGroups.title, "%تست%پورقاسم%")));
if (!klass) {
  [klass] = await db
    .select()
    .from(classGroups)
    .where(and(eq(classGroups.teacherId, teacher!.id), like(classGroups.title, "%تست%")));
}
if (!klass) {
  [klass] = await db
    .insert(classGroups)
    .values({
      tenantId: u.tenantId,
      courseId: course.id,
      teacherId: teacher!.id,
      title: "کلاس تست رباتیک (پورقاسم)",
      weekday: 0,
      startTime: "17:00",
      endTime: "18:30",
      startsOn: "2026-01-01",
      aiReportEnabled: true,
      eveNoticeEnabled: true,
      onlineUrl: "https://meet.example/amir-test",
      baleInviteUrl: "https://ble.ir/join/E8Be3xDgux",
    })
    .returning();
} else {
  await db
    .update(classGroups)
    .set({
      title: "کلاس تست رباتیک (پورقاسم)",
      aiReportEnabled: true,
      baleInviteUrl: "https://ble.ir/join/E8Be3xDgux",
      onlineUrl: "https://meet.example/amir-test",
    })
    .where(eq(classGroups.id, klass.id));
}

const names = [
  ["سارا", "تستی"],
  ["آرین", "تستی"],
  ["هستی", "تستی"],
  ["رادین", "تستی"],
];
const kids: { id: string; firstName: string }[] = [];
for (const [first, last] of names) {
  const existing = await db
    .select()
    .from(students)
    .innerJoin(enrollments, eq(enrollments.studentId, students.id))
    .where(and(eq(enrollments.classGroupId, klass!.id), eq(students.firstName, first!), eq(students.lastName, last!)));
  if (existing[0]) {
    kids.push({ id: existing[0].students.id, firstName: first! });
    continue;
  }
  const [st] = await db.insert(students).values({ tenantId: u.tenantId, firstName: first!, lastName: last! }).returning();
  await db.insert(enrollments).values({ tenantId: u.tenantId, classGroupId: klass!.id, studentId: st!.id, status: "active" });
  kids.push({ id: st!.id, firstName: first! });
}

const now = new Date();
const startsAt = new Date(now.getTime() - 20 * 60_000);
const endsAt = new Date(now.getTime() + 70 * 60_000);
await db.delete(classSessions).where(and(eq(classSessions.classGroupId, klass!.id), eq(classSessions.custom, true)));
const [session] = await db
  .insert(classSessions)
  .values({
    tenantId: u.tenantId,
    classGroupId: klass!.id,
    teacherId: teacher!.id,
    startsAt,
    endsAt,
    status: "scheduled",
    custom: true,
  })
  .returning();

const code = await createLinkCode(db, u.tenantId, "class", klass!.id);
await db.update(siteSettings).set({ reportApprovalRequired: true }).where(eq(siteSettings.tenantId, u.tenantId));

console.log(
  JSON.stringify(
    {
      teacher: teacher!.name.fa,
      username: "amir",
      password: "teacher12",
      classId: klass!.id,
      classTitle: klass!.title,
      sessionId: session!.id,
      students: kids.map((k) => k.firstName),
      linkCommand: `/link ${code.code}`,
      groupInvite: "https://ble.ir/join/E8Be3xDgux",
      teacherUrl: "http://localhost:3000/teacher/login",
      approveUrl: "http://localhost:3000/app/admin/reports",
    },
    null,
    2,
  ),
);
await closeDb();
