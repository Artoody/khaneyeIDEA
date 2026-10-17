"use client";

import type { partners } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { savePartner } from "@/app/[lang]/app/admin/partners/actions";
import { AdminForm, Field, inputCls, LocalizedInput, Toggle } from "./fields";
import { errorText } from "./errors";

type Partner = typeof partners.$inferSelect;

export function PartnerForm({ item, a, lang }: { item?: Partner; a: AdminDict; lang: Locale }) {
  const t = a.partner;
  return (
    <AdminForm action={savePartner} hidden={{ id: item?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <LocalizedInput label={t.name} name="name" value={item?.name} required error={e("name")} />
            <Field label={t.logoUrl} name="logoUrl" error={e("logoUrl")} help={t.logoHelp}>
              <input id="logoUrl" name="logoUrl" dir="ltr" defaultValue={item?.logoUrl ?? ""} className={inputCls} required />
            </Field>
            <Field label={t.url} name="url">
              <input id="url" name="url" dir="ltr" defaultValue={item?.url ?? ""} className={inputCls} />
            </Field>
            <Field label={a.common.order} name="sortOrder" error={e("sortOrder")}>
              <input id="sortOrder" name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={item?.sortOrder ?? 0} className={`${inputCls} max-w-40`} />
            </Field>
            <Toggle name="active" label={a.common.active} defaultChecked={item?.active ?? true} />
          </section>
        );
      }}
    </AdminForm>
  );
}
