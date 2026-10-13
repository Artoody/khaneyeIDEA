import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { classGroups, getDb, guardians, students, users } from "@khaneyeidea/db";
import { getEnrollmentTermDetail, getStudentHistory } from "@khaneyeidea/core";
import { href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { StudentForm, type GuardianRow } from "@/components/admin/student-form";
import { EnrollmentPackageFields } from "@/components/ops/enrollment-package-fields";
import { StudentTermCard } from "@/components/ops/student-term-card";
import { jalaliYears } from "../../booking/options";
import { enrollStudent } from "../../classes/actions";

async function Edit({ lang, id, openEnrollmentId }: { lang: Locale; id: string; openEnrollmentId: string | null }) {
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

  const allItems = [...history.current, ...history.past];
  const details = (
    await Promise.all(allItems.map((item) => getEnrollmentTermDetail(db, { tenantId: user.tenantId, studentId: id, enrollmentId: item.enrollmentId })))
  ).filter((d): d is NonNullable<typeof d> => !!d);
  const detailOf = new Map(details.map((d) => [d.item.enrollmentId, d]));

  const rows: GuardianRow[] = gs.map(({ g, u }) => ({
    phone: `0${u.phone.slice(2)}`,
    name: u.fullName ?? "",
    relation: (["mother", "father"].includes(g.relation ?? "") ? g.relation : "other") as GuardianRow["relation"],
    mediaConsent: g.mediaConsent,
  }));
  const inClass = new Set(history.current.map((x) => x.classGroupId));
  const open = allClasses.filter((c) => !inClass.has(c.id));
  const years = jalaliYears();
  const defaultOpen = openEnrollmentId && detailOf.has(openEnrollmentId) ? openEnrollmentId : (history.current[0]?.enrollmentId ?? null);

  return (
    <div className="grid max-w-6xl gap-8 xl:grid-cols-[1fr_minmax(20rem,26rem)]">
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
              {history.current.map((item) => {
                const detail = detailOf.get(item.enrollmentId);
                if (!detail) return null;
                return (
                  <li key={item.enrollmentId}>
                    <StudentTermCard detail={detail} lang={lang} o={o} years={years} open={item.enrollmentId === defaultOpen} editable />
                  </li>
                );
              })}
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
              {history.past.map((item) => {
                const detail = detailOf.get(item.enrollmentId);
                if (!detail) return null;
                return (
                  <li key={item.enrollmentId}>
                    <StudentTermCard
                      detail={detail}
                      lang={lang}
                      o={o}
                      years={years}
                      open={item.enrollmentId === openEnrollmentId && !history.current.some((c) => c.enrollmentId === openEnrollmentId)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/app/admin/students/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {Promise.all([params, searchParams]).then(([{ lang, id }, sp]) => {
        if (!isLocale(lang)) notFound();
        const e = typeof sp.e === "string" && z.uuid().safeParse(sp.e).success ? sp.e : null;
        return <Edit lang={lang} id={id} openEnrollmentId={e} />;
      })}
    </Suspense>
  );
}
