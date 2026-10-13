import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { classGroups, getDb, guardians, students, users } from "@khaneyeidea/db";
import { getStudentHistory, type StudentHistoryItem } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader } from "@/components/admin/ui";
import { StudentForm, type GuardianRow } from "@/components/admin/student-form";
import { EnrollmentPackageEdit } from "@/components/ops/enrollment-package-edit";
import { EnrollmentPackageFields } from "@/components/ops/enrollment-package-fields";
import { jalaliYears } from "../../booking/options";
import { enrollStudent } from "../../classes/actions";

function statusLabel(o: ReturnType<typeof getOpsDict>, status: StudentHistoryItem["status"]) {
  switch (status) {
    case "waitlist":
      return o.students.statusWaitlist;
    case "paused":
      return o.students.statusPaused;
    case "finished":
      return o.students.statusFinished;
    case "dropped":
      return o.students.statusDropped;
    default:
      return o.students.statusActive;
  }
}

function HistoryRow({ item, lang, o }: { item: StudentHistoryItem; lang: Locale; o: ReturnType<typeof getOpsDict> }) {
  return (
    <li className="rounded-xl border border-line/80 px-3 py-2.5 text-sm">
      <Link href={href(lang, `/app/admin/classes/${item.classGroupId}`)} className="font-medium hover:text-accent-text">
        {item.classTitle}
      </Link>
      <p className="mt-1 text-xs text-muted">
        {[
          item.termName ? `${o.students.term}: ${pick(item.termName, lang)}` : null,
          item.teacherName ? `${o.students.teacher}: ${pick(item.teacherName, lang)}` : null,
          statusLabel(o, item.status),
          fill(o.students.packageProgress, { u: num(item.sessionsUsed, lang), p: num(item.plannedSessions, lang) }),
          item.termComplete ? o.students.packageDone : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {fill(o.students.sessionsHeld, { n: num(item.sessionsHeld, lang) })}
        {" · "}
        {fill(o.students.presentAbsent, { p: num(item.present, lang), a: num(item.absent, lang) })}
      </p>
    </li>
  );
}

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "students.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [s] = await db.select().from(students).where(and(eq(students.id, id), eq(students.tenantId, user.tenantId)));
  if (!s) notFound();
  const [gs, history, allClasses] = await Promise.all([
    db.select({ g: guardians, u: users }).from(guardians).innerJoin(users, eq(users.id, guardians.userId)).where(eq(guardians.studentId, id)),
    getStudentHistory(db, { tenantId: user.tenantId, studentId: id }),
    db.select().from(classGroups).where(and(eq(classGroups.tenantId, user.tenantId), eq(classGroups.active, true))).orderBy(asc(classGroups.title)),
  ]);
  const rows: GuardianRow[] = gs.map(({ g, u }) => ({
    phone: `0${u.phone.slice(2)}`,
    name: u.fullName ?? "",
    relation: (["mother", "father"].includes(g.relation ?? "") ? g.relation : "other") as GuardianRow["relation"],
    mediaConsent: g.mediaConsent,
  }));
  const inClass = new Set(history.current.map((x) => x.classGroupId));
  const open = allClasses.filter((c) => !inClass.has(c.id));
  const years = jalaliYears();
  return (
    <div className="grid max-w-6xl gap-8 xl:grid-cols-[1fr_20rem]">
      <div>
        <PageHeader title={`${s.firstName} ${s.lastName}`} back={{ href: href(lang, "/app/admin/students"), label: o.nav.students }} />
        <StudentForm s={s} guardians={rows} a={a} o={o} lang={lang} />
      </div>
      <aside className="flex flex-col gap-4 xl:pt-[5.5rem]">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">{o.students.classes}</h2>
          {history.current.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{o.students.noClasses}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {history.current.map((item) => (
                <li key={item.enrollmentId} className="rounded-xl px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link href={href(lang, `/app/admin/classes/${item.classGroupId}`)} className="min-w-0 truncate transition hover:text-accent-text">
                      {item.classTitle}
                      {item.teacherName && <span className="text-muted"> · {pick(item.teacherName, lang)}</span>}
                    </Link>
                    {item.status === "waitlist" && <Badge tone="accent">{o.classes.waitlist}</Badge>}
                    {item.status === "paused" && <Badge tone="muted">{o.students.statusPaused}</Badge>}
                  </div>
                  <EnrollmentPackageEdit
                    enrollmentId={item.enrollmentId}
                    plannedSessions={item.plannedSessions}
                    termStartedOn={item.termStartedOn}
                    sessionsUsed={item.sessionsUsed}
                    termComplete={item.termComplete}
                    o={o}
                    lang={lang}
                    years={years}
                  />
                </li>
              ))}
            </ul>
          )}
          {open.length > 0 && (
            <form action={enrollStudent} className="mt-4 flex flex-col gap-2">
              <input type="hidden" name="studentId" value={s.id} />
              <div className="flex gap-2">
                <select name="classGroupId" aria-label={o.classes.addStudent} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm">
                  {open.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <button className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-bg">{a.common.add}</button>
              </div>
              <EnrollmentPackageFields o={o} years={years} compact />
            </form>
          )}
        </section>

        {history.termsSummary.length > 0 && (
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <h2 className="font-display text-lg font-bold">{o.students.finishedTerms}</h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {history.termsSummary.map((t) => (
                <li key={t.termId} className="flex justify-between gap-2">
                  <span>{pick(t.termName, lang)}</span>
                  <span className="text-muted">{num(t.finishedEnrollments, lang)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">{o.students.history}</h2>
          {history.past.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{o.students.noHistory}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {history.past.map((item) => (
                <HistoryRow key={item.enrollmentId} item={item} lang={lang} o={o} />
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/students/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
