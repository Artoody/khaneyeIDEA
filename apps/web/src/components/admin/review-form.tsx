"use client";

import type { siteReviews } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { saveReview } from "@/app/[lang]/app/admin/reviews/actions";
import { AdminForm, Field, inputCls, LocalizedInput, Toggle } from "./fields";
import { errorText } from "./errors";

type Review = typeof siteReviews.$inferSelect;

export function ReviewForm({ item, a, lang }: { item?: Review; a: AdminDict; lang: Locale }) {
  const t = a.review;
  return (
    <AdminForm action={saveReview} hidden={{ id: item?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <LocalizedInput label={t.author} name="authorName" value={item?.authorName} required error={e("authorName")} />
            <LocalizedInput label={t.body} name="body" value={item?.body} required multiline error={e("body")} />
            <Field label={t.status} name="status">
              <select id="status" name="status" defaultValue={item?.status ?? "pending"} className={inputCls}>
                <option value="pending">{t.pending}</option>
                <option value="published">{t.published}</option>
                <option value="rejected">{t.rejected}</option>
              </select>
            </Field>
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
