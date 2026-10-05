"use client";

import type { achievements } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { saveAchievement } from "@/app/[lang]/app/admin/achievements/actions";
import { AdminForm, Field, inputCls, LocalizedInput, Toggle } from "./fields";
import { errorText } from "./errors";

type Achievement = typeof achievements.$inferSelect;

export function AchievementForm({ item, a, lang }: { item?: Achievement; a: AdminDict; lang: Locale }) {
  const t = a.achievement;
  return (
    <AdminForm action={saveAchievement} hidden={{ id: item?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <LocalizedInput label={t.title} name="title" value={item?.title} required error={e("title")} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.competition} name="competition">
                <input id="competition" name="competition" dir="auto" defaultValue={item?.competition ?? ""} className={inputCls} />
              </Field>
              <Field label={t.rank} name="rank">
                <input id="rank" name="rank" dir="auto" defaultValue={item?.rank ?? ""} className={inputCls} />
              </Field>
              <Field label={t.year} name="year" error={e("year")}>
                <input id="year" name="year" inputMode="numeric" dir="ltr" defaultValue={item?.year ?? ""} className={inputCls} />
              </Field>
              <Field label={t.scope} name="scope">
                <select id="scope" name="scope" defaultValue={item?.scope ?? ""} className={inputCls}>
                  <option value="">—</option>
                  <option value="world">{t.world}</option>
                  <option value="asia">{t.asia}</option>
                  <option value="national">{t.national}</option>
                </select>
              </Field>
            </div>
            <LocalizedInput label={t.country} name="country" value={item?.country} />
            <Field label={a.common.order} name="sortOrder" error={e("sortOrder")}>
              <input id="sortOrder" name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={item?.sortOrder ?? 0} className={`${inputCls} max-w-40`} />
            </Field>
            <Toggle name="featured" label={t.featured} defaultChecked={item?.featured ?? false} />
          </section>
        );
      }}
    </AdminForm>
  );
}
