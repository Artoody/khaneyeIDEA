import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { X } from "@phosphor-icons/react/dist/ssr";
import { branches, getDb, teachers, userRoles, users } from "@khaneyeidea/db";
import { isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader, RowList } from "@/components/admin/ui";
import { StaffForm } from "@/components/admin/staff-form";
import { removeRole } from "./actions";

const localPhone = (p: string) => `0${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8)}`;

async function Staff({ lang }: { lang: Locale }) {
  const me = await requirePermissionPage(lang, "users.manage");
  const a = getAdminDict(lang);
  const o = getOpsDict(lang);
  const db = getDb();
  const [roles, brs, profiles] = await Promise.all([
    db
      .select({ r: userRoles, u: users })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(users.tenantId, me.tenantId))
      .orderBy(asc(users.fullName)),
    db.select().from(branches).where(eq(branches.tenantId, me.tenantId)).orderBy(asc(branches.sortOrder)),
    db.select().from(teachers).where(eq(teachers.tenantId, me.tenantId)).orderBy(asc(teachers.sortOrder)),
  ]);
  const staff = roles.filter((x) => x.r.role !== "parent" && x.r.role !== "student");
  const people = [...new Map(staff.map((x) => [x.u.id, x.u])).values()];
  const branchName = new Map(brs.map((b) => [b.id, pick(b.name, lang)]));
  const profileOf = new Map(profiles.filter((p) => p.userId).map((p) => [p.userId!, pick(p.name, lang)]));
  return (
    <div className="max-w-5xl">
      <PageHeader title={o.nav.staff} description={o.staff.help} />
      <StaffForm a={a} o={o} branches={brs.map((b) => ({ id: b.id, label: pick(b.name, lang) }))} teachers={profiles.map((p) => ({ id: p.id, label: pick(p.name, lang) }))} />
      <div className="mt-8">
        <RowList>
          {people.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {u.fullName ?? "-"} {u.id === me.userId && <span className="text-sm text-muted">({o.staff.self})</span>}
                </span>
                <span className="block text-sm text-muted" dir="ltr">
                  {num(localPhone(u.phone), lang)}
                  {profileOf.get(u.id) && <span dir="auto"> · {profileOf.get(u.id)}</span>}
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {staff
                  .filter((x) => x.u.id === u.id)
                  .map(({ r }) => (
                    <form key={r.id} action={removeRole} className="inline-flex">
                      <input type="hidden" name="id" value={r.id} />
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 py-1 pe-1 ps-3 text-sm">
                        {o.staff.roles[r.role]}
                        {r.branchId && <span className="text-muted">· {branchName.get(r.branchId)}</span>}
                        <button aria-label={o.staff.remove} className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-red-500/10 hover:text-red-500">
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </form>
                  ))}
              </span>
            </li>
          ))}
        </RowList>
      </div>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/staff">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Staff lang={lang} />
    </Suspense>
  );
}
