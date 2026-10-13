import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { Chalkboard } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { branches, chatLinks, classGroups, courses, enrollments, getDb, teachers } from "@khaneyeidea/db";
import { weekdaySat0 } from "@khaneyeidea/core";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { tehranIso, WEEKDAYS } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { ClassesSkeleton, PageHeader } from "@/components/admin/ui";
import { ClassBrowser, type ClassRow } from "@/components/ops/class-browser";

type Q = { v?: string; t?: string; m?: string; q?: string; open?: string; };

async function List({ lang, q }: { lang: Locale; q: Q }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const o = getOpsDict(lang);
  const db = getDb();
  const [rows, links, ts, bs] = await Promise.all([
    db
      .select({ c: classGroups, course: courses.title, teacher: teachers.name, branch: branches.name, n: count(enrollments.id) })
      .from(classGroups)
      .innerJoin(courses, eq(courses.id, classGroups.courseId))
      .leftJoin(teachers, eq(teachers.id, classGroups.teacherId))
      .leftJoin(branches, eq(branches.id, classGroups.branchId))
      .leftJoin(enrollments, and(eq(enrollments.classGroupId, classGroups.id), eq(enrollments.status, "active")))
      .where(eq(classGroups.tenantId, user.tenantId))
      .groupBy(classGroups.id, courses.title, teachers.name, branches.name)
      .orderBy(asc(classGroups.weekday), asc(classGroups.startTime)),
    db.select({ classGroupId: chatLinks.classGroupId, channel: chatLinks.channel }).from(chatLinks).where(eq(chatLinks.tenantId, user.tenantId)),
    db.select().from(teachers).where(eq(teachers.tenantId, user.tenantId)).orderBy(asc(teachers.sortOrder), asc(teachers.createdAt)),
    db.select().from(branches).where(eq(branches.tenantId, user.tenantId)).orderBy(asc(branches.sortOrder)),
  ]);
  const base = href(lang, "/app/admin/classes");
  const linked = new Map<string, Set<string>>();
  for (const l of links) linked.set(l.classGroupId, (linked.get(l.classGroupId) ?? new Set()).add(l.channel));
  const data: ClassRow[] = rows.map(({ c, course, teacher, branch, n }) => ({
    id: c.id,
    title: c.title,
    course: pick(course, lang),
    teacherId: c.teacherId,
    teacher: teacher ? pick(teacher, lang) : null,
    branchId: c.branchId,
    branch: branch ? pick(branch, lang) : null,
    online: c.mode === "online" || !c.branchId,
    weekday: c.weekday,
    start: c.startTime.slice(0, 5),
    end: c.endTime.slice(0, 5),
    n,
    capacity: c.capacity,
    active: c.active,
    bale: !!linked.get(c.id)?.has("bale"),
    telegram: !!linked.get(c.id)?.has("telegram"),
    href: `${base}/${c.id}`,
  }));

  return (
    <>
      <PageHeader title={o.nav.classes} description={o.classes.help} action={{ href: `${base}/new`, label: o.classes.new }} />
      {data.length === 0 ? (
        <div className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent-text">
            <Chalkboard weight="duotone" className="size-6" />
          </span>
          <p className="mt-4 font-medium">{o.classes.empty}</p>
          <Link href={`${base}/new`} className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent">
            {o.classes.new}
          </Link>
        </div>
      ) : (
        <ClassBrowser
          rows={data}
          teachers={ts.map((t) => ({ id: t.id, name: pick(t.name, lang), role: t.role ? pick(t.role, lang) : null, href: href(lang, `/app/admin/teachers/${t.id}`) }))}
          branches={bs.map((b) => ({ id: b.id, name: pick(b.name, lang) }))}
          o={o}
          lang={lang}
          weekdays={WEEKDAYS[lang]}
          base={base}
          todayWd={weekdaySat0(tehranIso(new Date()))}
          initial={q}
        />
      )}
    </>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/classes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ClassesSkeleton />}>
      {searchParams.then((sp) => {
        const g = (k: keyof Q) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
        return <List lang={lang} q={{ v: g("v"), t: g("t"), m: g("m"), q: g("q"), open: g("open") }} />;
      })}
    </Suspense>
  );
}
