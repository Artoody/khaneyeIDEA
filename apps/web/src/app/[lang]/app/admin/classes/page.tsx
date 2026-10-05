import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { Chalkboard, Monitor, TelegramLogo, MapPin, UserCircle, Link as LinkIcon } from "@phosphor-icons/react/dist/ssr";
import { branches, chatLinks, classGroups, courses, enrollments, getDb, teachers } from "@khaneyeidea/db";
import { weekdaySat0 } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { tehranIso, WEEKDAYS } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader } from "@/components/admin/ui";
import { AutoSubmitSelect } from "@/components/ops/auto-submit";

type Q = { t?: string; m?: string };

async function List({ lang, q }: { lang: Locale; q: Q }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  const db = getDb();
  const teacherId = q.t && z.uuid().safeParse(q.t).success ? q.t : null;
  const mode = q.m === "online" || q.m === "in_person" ? q.m : null;
  const [rows, links, ts] = await Promise.all([
    db
      .select({ c: classGroups, course: courses.title, teacher: teachers.name, branch: branches.name, n: count(enrollments.id) })
      .from(classGroups)
      .innerJoin(courses, eq(courses.id, classGroups.courseId))
      .leftJoin(teachers, eq(teachers.id, classGroups.teacherId))
      .leftJoin(branches, eq(branches.id, classGroups.branchId))
      .leftJoin(enrollments, and(eq(enrollments.classGroupId, classGroups.id), eq(enrollments.status, "active")))
      .where(and(eq(classGroups.tenantId, user.tenantId), teacherId ? eq(classGroups.teacherId, teacherId) : undefined))
      .groupBy(classGroups.id, courses.title, teachers.name, branches.name)
      .orderBy(asc(classGroups.weekday), asc(classGroups.startTime)),
    db.select({ classGroupId: chatLinks.classGroupId, channel: chatLinks.channel }).from(chatLinks).where(eq(chatLinks.tenantId, user.tenantId)),
    db.select().from(teachers).where(eq(teachers.tenantId, user.tenantId)).orderBy(asc(teachers.sortOrder)),
  ]);
  const shown = rows.filter((r) => (mode === "online" ? r.c.mode === "online" : mode === "in_person" ? r.c.mode !== "online" : true));
  const linked = new Map<string, Set<string>>();
  for (const l of links) linked.set(l.classGroupId, (linked.get(l.classGroupId) ?? new Set()).add(l.channel));
  const base = href(lang, "/app/admin/classes");
  const t = (s: string) => num(s.slice(0, 5), lang);
  const todayIdx = weekdaySat0(tehranIso(new Date()));

  return (
    <>
      <PageHeader title={o.nav.classes} description={o.classes.help} action={{ href: `${base}/new`, label: o.classes.new }} />
      <form action={base} className="mb-6 flex flex-wrap gap-2">
        <AutoSubmitSelect name="t" defaultValue={teacherId ?? ""} aria-label={o.classes.teacher} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
          <option value="">
            {o.classes.teacher}: {o.board.all}
          </option>
          {ts.map((x) => (
            <option key={x.id} value={x.id}>
              {pick(x.name, lang)}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="m" defaultValue={mode ?? ""} aria-label={o.classes.mode} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
          <option value="">
            {o.classes.mode}: {o.board.all}
          </option>
          <option value="in_person">{a.course.in_person}</option>
          <option value="online">{a.course.online}</option>
        </AutoSubmitSelect>
      </form>

      {shown.length === 0 ? (
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
        <div className="grid items-start gap-x-8 gap-y-9 xl:grid-cols-2" data-testid="class-days">
          {WEEKDAYS[lang].map((name, wd) => {
            const day = shown.filter((r) => r.c.weekday === wd);
            if (!day.length) return null;
            return (
              <section key={wd}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  {name}
                  {wd === todayIdx && <Badge tone="accent">{lang === "fa" ? "امروز" : "Today"}</Badge>}
                  <span className="text-sm font-normal text-muted">{num(day.length, lang)}</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {day.map(({ c, course, teacher, branch, n }) => {
                    const ch = linked.get(c.id);
                    const full = n >= c.capacity;
                    return (
                      <Link
                        key={c.id}
                        href={`${base}/${c.id}`}
                        className={`group flex flex-col gap-3 rounded-[var(--radius-card)] border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/60 ${c.active ? "border-line" : "border-dashed border-line opacity-60"}`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="font-display text-2xl font-black tabular-nums leading-none">
                            {t(c.startTime)}
                            <span className="mx-1 text-base font-normal text-muted">-</span>
                            {t(c.endTime)}
                          </span>
                          <Badge tone={full ? "accent" : "neutral"}>{fill(o.classes.seats, { n: num(n, lang), c: num(c.capacity, lang) })}</Badge>
                        </span>
                        <span>
                          <span className="block font-semibold leading-snug">{c.title}</span>
                          <span className="mt-0.5 block truncate text-sm text-muted">{pick(course, lang)}</span>
                        </span>
                        <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <UserCircle weight="duotone" className="size-4" />
                            {teacher ? pick(teacher, lang) : o.classes.noTeacher}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            {branch ? <MapPin weight="duotone" className="size-4" /> : <Monitor weight="duotone" className="size-4" />}
                            {branch ? pick(branch, lang) : o.classes.online}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 border-t border-line pt-3 text-xs">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${ch?.has("bale") ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-ink/5 text-muted"}`}>
                            <LinkIcon className="size-3.5" />
                            {o.connect.bale}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${ch?.has("telegram") ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-ink/5 text-muted"}`}>
                            <TelegramLogo className="size-3.5" />
                            {o.connect.telegram}
                          </span>
                          {!c.active && <Badge tone="muted">{a.common.inactive}</Badge>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/classes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      {searchParams.then((sp) => (
        <List lang={lang} q={{ t: typeof sp.t === "string" ? sp.t : undefined, m: typeof sp.m === "string" ? sp.m : undefined }} />
      ))}
    </Suspense>
  );
}
