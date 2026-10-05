"use client";

import type { appointmentTypes } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { saveType } from "@/app/[lang]/app/admin/booking/types/actions";
import { AdminForm, Field, inputCls, LocalizedInput, Toggle } from "./fields";
import { errorText } from "./errors";

type ApptType = typeof appointmentTypes.$inferSelect;

export function TypeForm({ item, a, lang }: { item?: ApptType; a: AdminDict; lang: Locale }) {
  const t = a.booking;
  return (
    <AdminForm action={saveType} hidden={{ id: item?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => (
        <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <LocalizedInput label={t.title} name="title" value={item?.title} required error={errorText(s.fieldErrors?.title, a)} />
          <LocalizedInput label={t.description} name="description" value={item?.description} multiline />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={t.type} name="kind">
              <select id="kind" name="kind" defaultValue={item?.kind ?? "consultation"} className={inputCls}>
                {Object.entries(t.kind).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={t.placeLabel} name="place">
              <select id="place" name="place" defaultValue={item?.place ?? "in_person"} className={inputCls}>
                {Object.entries(t.place).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={a.common.order} name="sortOrder" error={errorText(s.fieldErrors?.sortOrder, a)}>
              <input id="sortOrder" name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={item?.sortOrder ?? 0} className={inputCls} />
            </Field>
          </div>
          <Toggle name="active" label={a.common.active} defaultChecked={item?.active ?? true} />
        </section>
      )}
    </AdminForm>
  );
}
