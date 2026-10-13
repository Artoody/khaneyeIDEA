import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { listTerms } from "@khaneyeidea/core";
import { getDb } from "@khaneyeidea/db";
import { href, isLocale, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { dayLabel } from "@/lib/jalali";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { JalaliDateInput } from "@/components/admin/jalali-date-input";
import { inputCls } from "@/components/admin/fields";
import { jalaliYears } from "../booking/options";
import { removeTerm, saveTerm } from "./actions";

async function Terms({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const o = getOpsDict(lang);
  const rows = await listTerms(getDb(), user.tenantId);
  const years = jalaliYears();
  return (
    <div className="max-w-3xl">
      <PageHeader title={o.terms.title} description={o.terms.help} />
      <form action={saveTerm} className="mt-2 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <input type="hidden" name="lang" value={lang} />
        <h2 className="font-display text-lg font-bold">{o.terms.new}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            {o.terms.nameFa}
            <input name="name.fa" required className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            {o.terms.nameEn}
            <input name="name.en" dir="ltr" className={inputCls} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <JalaliDateInput name="startsOn" value={new Date().toISOString().slice(0, 10)} label={o.terms.startsOn} years={years} />
          <JalaliDateInput name="endsOn" value={new Date().toISOString().slice(0, 10)} label={o.terms.endsOn} years={years} />
        </div>
        <button className="h-11 self-start rounded-full bg-ink px-5 text-sm font-medium text-bg">{o.terms.save}</button>
      </form>
      <ul className="mt-8 flex flex-col gap-3">
        {rows.length === 0 && <li className="text-sm text-muted">{o.terms.empty}</li>}
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{pick(t.name, lang)}</p>
              <p className="text-sm text-muted">
                {dayLabel(t.startsOn, lang, { weekday: false })} — {dayLabel(t.endsOn, lang, { weekday: false })}
              </p>
            </div>
            <a href={href(lang, `/app/admin/terms/${t.id}`)} className="text-sm text-accent-text underline">
              {o.terms.edit}
            </a>
            <form action={removeTerm}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="lang" value={lang} />
              <button aria-label={o.terms.remove} className="grid size-9 place-items-center rounded-full text-muted hover:bg-red-500/10 hover:text-red-500">
                <Trash className="size-4" />
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ lang: string }> }) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang }) => (isLocale(lang) ? <Terms lang={lang} /> : notFound()))}
    </Suspense>
  );
}
