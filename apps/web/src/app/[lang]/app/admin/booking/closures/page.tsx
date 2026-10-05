import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { availabilityExceptions, availabilityTemplates, branches, getDb } from "@khaneyeidea/db";
import { isLocale, pick, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { dayLabel, tehranIso } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader, RowList } from "@/components/admin/ui";
import { ClosureForm } from "@/components/admin/closure-form";
import { removeClosure } from "./actions";
import { jalaliYears, templateOptions } from "../options";

async function Closures({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const t = a.booking;
  const [rows, options] = await Promise.all([
    getDb()
      .select({ e: availabilityExceptions, branch: branches.name, template: availabilityTemplates.name })
      .from(availabilityExceptions)
      .leftJoin(branches, eq(branches.id, availabilityExceptions.branchId))
      .leftJoin(availabilityTemplates, eq(availabilityTemplates.id, availabilityExceptions.templateId))
      .where(and(eq(availabilityExceptions.tenantId, user.tenantId), gte(availabilityExceptions.date, tehranIso(new Date()))))
      .orderBy(asc(availabilityExceptions.date)),
    templateOptions(user.tenantId, lang),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title={t.navClosures} description={t.closuresHelp} />
      <ClosureForm branches={options.branches} a={a} years={jalaliYears()} />
      <div className="mt-10">
        {rows.length === 0 ? (
          <p className="text-muted">{t.noClosures}</p>
        ) : (
          <RowList>
            {rows.map(({ e, branch, template }) => (
              <li key={e.id} className="flex min-h-16 items-center gap-4 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{dayLabel(e.date, lang, { weekday: true, year: true })}</span>
                  <span className="block truncate text-sm text-muted">
                    {[template ?? (branch ? pick(branch, lang) : t.allBranches), pick(e.reason, lang)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <form action={removeClosure}>
                  <input type="hidden" name="id" value={e.id} />
                  <button aria-label={a.common.remove} className="grid size-10 place-items-center rounded-full text-red-500 transition hover:bg-red-500/10">
                    <Trash className="size-5" />
                  </button>
                </form>
              </li>
            ))}
          </RowList>
        )}
      </div>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/booking/closures">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Closures lang={lang} />
    </Suspense>
  );
}
