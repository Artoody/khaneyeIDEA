import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, terms } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { JalaliDateInput } from "@/components/admin/jalali-date-input";
import { inputCls } from "@/components/admin/fields";
import { jalaliYears } from "../../booking/options";
import { saveTerm } from "../actions";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  if (!z.uuid().safeParse(id).success) notFound();
  const o = getOpsDict(lang);
  const [row] = await getDb()
    .select()
    .from(terms)
    .where(and(eq(terms.id, id), eq(terms.tenantId, user.tenantId)));
  if (!row) notFound();
  const years = jalaliYears();
  return (
    <div className="max-w-xl">
      <PageHeader title={pick(row.name, lang)} back={{ href: href(lang, "/app/admin/terms"), label: o.terms.title }} />
      <form action={saveTerm} className="mt-2 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="id" value={row.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            {o.terms.nameFa}
            <input name="name.fa" required defaultValue={row.name.fa} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            {o.terms.nameEn}
            <input name="name.en" dir="ltr" defaultValue={row.name.en} className={inputCls} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <JalaliDateInput name="startsOn" value={row.startsOn} label={o.terms.startsOn} years={years} />
          <JalaliDateInput name="endsOn" value={row.endsOn} label={o.terms.endsOn} years={years} />
        </div>
        <button className="h-11 self-start rounded-full bg-ink px-5 text-sm font-medium text-bg">{o.terms.save}</button>
      </form>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ lang: string; id: string }> }) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
