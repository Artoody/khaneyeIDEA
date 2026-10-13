import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { classGroups, classSessions, enrollments, getDb, students, teachers, users } from "@khaneyeidea/db";
import { can } from "@khaneyeidea/core";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getUser } from "@/server/auth";
import { logoutAction } from "@/app/[lang]/login/actions";
import { LogoMark } from "@/components/site/logo-mark";
import { ThemeToggle } from "@/components/site/header-client";
import { toggleClassAi } from "./actions";
import { WorkForm } from "./work-form";
import { TeacherPwa } from "@/components/teacher/pwa";

const fmtTime = (d: Date) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

async function Home({ lang }: { lang: Locale }) {
  const user = await getUser();
  if (!user) redirect(href(lang, "/teacher/login"));
  if (!can(user, "session.report_own")) redirect(href(lang, "/app/no-access"));
  const db = getDb();
  const [account] = await db.select({ must: users.mustChangePassword }).from(users).where(eq(users.id, user.userId));
  if (account?.must) redirect(href(lang, "/teacher/password"));
  const [profile] = await db.select().from(teachers).where(and(eq(teachers.userId, user.userId), eq(teachers.tenantId, user.tenantId)));
  if (!profile) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <p>حساب دبیر به پروفایل وصل نیست. از مدیر بخواهید ورود را در پنل تنظیم کند.</p>
      </main>
    );
  }

  const now = new Date();
  const from = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ s: classSessions, c: classGroups })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .where(and(eq(classSessions.teacherId, profile.id), gte(classSessions.endsAt, from), lte(classSessions.startsAt, until)))
    .orderBy(asc(classSessions.startsAt));

  const live = rows.find((r) => r.s.startsAt <= now && r.s.endsAt.getTime() + 2 * 60 * 60 * 1000 >= now.getTime() && r.s.status !== "cancel_planned" && r.s.status !== "held");
  const next = rows.find((r) => r.s.startsAt > now && r.s.status === "scheduled");
  const focus = live ?? next ?? null;
  const roster = focus
    ? await db
        .select({ id: students.id, name: students.firstName })
        .from(enrollments)
        .innerJoin(students, eq(students.id, enrollments.studentId))
        .where(and(eq(enrollments.classGroupId, focus.c.id), eq(enrollments.status, "active")))
        .orderBy(asc(students.firstName))
    : [];
  const link = focus ? focus.c.onlineUrl || profile.meetingUrl : null;
  const open = !!live;

  return (
    <main className="mx-auto min-h-[100dvh] max-w-lg px-5 py-8">
      <header className="flex items-center gap-3">
        <LogoMark className="h-8 w-auto" />
        <div className="min-w-0">
          <p className="text-sm text-muted">پنل دبیر</p>
          <h1 className="truncate font-display text-xl font-extrabold">{profile.name.fa}</h1>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <Link href={href(lang, "/teacher/profile")} className="text-sm text-muted">
            پروفایل
          </Link>
          <ThemeToggle label="تغییر تم" />
          <form action={logoutAction}>
            <input type="hidden" name="lang" value={lang} />
            <button className="text-sm text-muted">خروج</button>
          </form>
        </div>
      </header>
      <TeacherPwa />
      {focus ? (
        <section className="glass mt-8 rounded-[var(--radius-card)] border border-line p-5">
          <p className="text-sm text-accent-text">{open ? "الان وقت این کلاس است" : "کلاس بعدی"}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold">{focus.c.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {fmtTime(focus.s.startsAt)} تا {fmtTime(focus.s.endsAt)}
          </p>
          {link && (
            <a href={link} className="mt-3 inline-flex text-sm text-accent-text underline" target="_blank" rel="noreferrer">
              لینک کلاس
            </a>
          )}
          <form action={toggleClassAi} className="mt-4">
            <input type="hidden" name="classId" value={focus.c.id} />
            <input type="hidden" name="lang" value={lang} />
            <button className="text-sm text-muted underline">{focus.c.aiReportEnabled ? "مرتب‌سازی هوشمند روشن است (خاموش کردن)" : "مرتب‌سازی هوشمند خاموش است (روشن کردن)"}</button>
          </form>
          {open && <WorkForm lang={lang} sessionId={focus.s.id} students={roster} aiOn={focus.c.aiReportEnabled} />}
        </section>
      ) : (
        <p className="mt-10 text-muted">کلاس بازی در دو هفته‌ی پیش رو نیست.</p>
      )}
      <ul className="mt-8 flex flex-col gap-2">
        {rows.slice(0, 12).map((r) => (
          <li key={r.s.id} className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
            <span>{r.c.title}</span>
            <span className="text-muted">{fmtTime(r.s.startsAt)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 flex justify-center gap-4 text-center text-xs text-muted">
        <Link href={href(lang, "/teacher/profile")}>پروفایل</Link>
        <Link href={href(lang, "/teacher/password")}>تغییر رمز</Link>
      </p>
    </main>
  );
}

export default function Page({ params }: PageProps<"/[lang]/teacher">) {
  return (
    <Suspense>
      {params.then(({ lang }) => (isLocale(lang) ? <Home lang={lang} /> : notFound()))}
    </Suspense>
  );
}
