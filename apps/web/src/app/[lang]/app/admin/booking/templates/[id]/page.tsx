import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { availabilityTemplates, getDb } from "@khaneyeidea/db";
import { previewTemplate } from "@khaneyeidea/core";
import { href, isLocale, num, type Locale } from "@/lib/i18n";
import { getAdminDict } from "@/lib/admin-i18n";
import { dayLabel, timeLabel } from "@/lib/jalali";
import { fill } from "@/lib/format";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { TemplateForm } from "@/components/admin/template-form";
import { jalaliYears, templateOptions } from "../../options";

async function Edit({ lang, id }: { lang: Locale; id: string }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const a = getAdminDict(lang);
  const t = a.booking;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [tpl] = await db.select().from(availabilityTemplates).where(and(eq(availabilityTemplates.id, id), eq(availabilityTemplates.tenantId, user.tenantId)));
  if (!tpl) notFound();
  const [options, slots] = await Promise.all([templateOptions(user.tenantId, lang), previewTemplate(db, user.tenantId, id)]);
  // Group the next week of slots by day for a compact preview.
  const days = new Map<string, typeof slots>();
  for (const s of slots) {
    if (days.size >= 6 && !days.has(s.day)) break;
    days.set(s.day, [...(days.get(s.day) ?? []), s]);
  }
  return (
    <div className="grid max-w-6xl gap-8 xl:grid-cols-[1fr_20rem]">
      <div>
        <PageHeader title={tpl.name} back={{ href: href(lang, "/app/admin/booking/templates"), label: t.navTemplates }} />
        <TemplateForm tpl={tpl} options={options} a={a} lang={lang} years={jalaliYears()} />
      </div>
      <aside className="xl:pt-[5.5rem]">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 xl:sticky xl:top-24">
          <h2 className="font-display text-lg font-bold">{t.preview}</h2>
          <p className="mt-1 text-xs text-muted">{t.previewHelp}</p>
          {days.size === 0 ? (
            <p className="mt-4 text-sm text-muted">{tpl.active ? t.previewEmpty : a.common.inactive}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4" data-testid="preview">
              {[...days].map(([day, list]) => (
                <li key={day}>
                  <p className="text-sm font-medium">{dayLabel(day, lang)}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {list.map((s) => (
                      <li
                        key={s.time}
                        title={fill(t.seats, { n: num(s.remaining, lang), c: num(s.capacity, lang) })}
                        className={`rounded-full px-2.5 py-1 text-xs tabular-nums ${s.remaining > 0 ? "bg-accent/15 text-ink" : "bg-ink/5 text-muted line-through"}`}
                      >
                        {timeLabel(s.startsAt, lang)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/booking/templates/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      {params.then(({ lang, id }) => (isLocale(lang) ? <Edit lang={lang} id={id} /> : notFound()))}
    </Suspense>
  );
}
