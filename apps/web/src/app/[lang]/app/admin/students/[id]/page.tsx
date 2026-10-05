import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { classGroups, enrollments, getDb, guardians, students, users } from "@khaneyeidea/db";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { WEEKDAYS } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { Badge, ListSkeleton, PageHeader } from "@/components/admin/ui";
import { StudentForm, type GuardianRow } from "@/components/admin/student-form";
import { enrollStudent } from "../../classes/actions";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "students.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [s] = await db.select().from(students).where(and(eq(students.id, id), eq(students.tenantId, user.tenantId)));
  if (!s) notFound();
  const [gs, enrolled, allClasses] = await Promise.all([
    db.select({ g: guardians, u: users }).from(guardians).innerJoin(users, eq(users.id, guardians.userId)).where(eq(guardians.studentId, id)),
    db
      .select({ e: enrollments, c: classGroups })
      .from(enrollments)
      .innerJoin(classGroups, eq(classGroups.id, enrollments.classGroupId))
      .where(and(eq(enrollments.studentId, id), inArray(enrollments.status, ["active", "waitlist"]))),
    db.select().from(classGroups).where(and(eq(classGroups.tenantId, user.tenantId), eq(classGroups.active, true))).orderBy(asc(classGroups.title)),
  ]);
  const rows: GuardianRow[] = gs.map(({ g, u }) => ({
    phone: `0${u.phone.slice(2)}`,
    name: u.fullName ?? "",
    relation: (["mother", "father"].includes(g.relation ?? "") ? g.relation : "other") as GuardianRow["relation"],
    mediaConsent: g.mediaConsent,
  }));
  const inClass = new Set(enrolled.map((x) => x.c.id));
  const open = allClasses.filter((c) => !inClass.has(c.id));
  return (
    <div className="grid max-w-6xl gap-8 xl:grid-cols-[1fr_20rem]">
      <div>
        <PageHeader title={`${s.firstName} ${s.lastName}`} back={{ href: href(lang, "/app/admin/students"), label: o.nav.students }} />
        <StudentForm s={s} guardians={rows} a={a} o={o} lang={lang} />
      </div>
      <aside className="xl:pt-[5.5rem]">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">{o.students.classes}</h2>
          {enrolled.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{o.students.noClasses}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {enrolled.map(({ e, c }) => (
                <li key={e.id}>
                  <Link href={href(lang, `/app/admin/classes/${c.id}`)} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition hover:bg-ink/5">
                    <span>
                      {c.title} <span className="text-muted">· {WEEKDAYS[lang][c.weekday]}</span>
                    </span>
                    {e.status === "waitlist" && <Badge tone="accent">{o.classes.waitlist}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {open.length > 0 && (
            <form action={enrollStudent} className="mt-4 flex gap-2">
              <input type="hidden" name="studentId" value={s.id} />
              <select name="classGroupId" aria-label={o.classes.addStudent} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm">
                {open.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <button className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-bg">{a.common.add}</button>
            </form>
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
