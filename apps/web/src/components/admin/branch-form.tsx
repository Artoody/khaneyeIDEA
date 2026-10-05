"use client";

import type { branches } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { saveBranch } from "@/app/[lang]/app/admin/branches/actions";
import { AdminForm, Field, inputCls, LocalizedInput, Toggle } from "./fields";
import { errorText } from "./errors";

type Branch = typeof branches.$inferSelect;

export function BranchForm({ branch, a, lang }: { branch?: Branch; a: AdminDict; lang: Locale }) {
  const t = a.branch;
  return (
    <AdminForm
      action={saveBranch}
      hidden={{ id: branch?.id ?? "", lang }}
      labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}
    >
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <LocalizedInput label={t.name} name="name" value={branch?.name} required error={e("name")} />
            <LocalizedInput label={t.district} name="district" value={branch?.district} />
            <LocalizedInput label={t.address} name="address" value={branch?.address} multiline />
            <LocalizedInput label={t.hours} name="hours" value={branch?.hours} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.phone} name="phone">
                <input id="phone" name="phone" dir="ltr" defaultValue={branch?.phone ?? ""} className={inputCls} />
              </Field>
              <Field label={t.mapUrl} name="mapUrl" error={e("mapUrl")}>
                <input id="mapUrl" name="mapUrl" dir="ltr" placeholder="https://" defaultValue={branch?.mapUrl ?? ""} className={inputCls} />
              </Field>
              <Field label="slug" name="slug" help={a.common.slugHelp} error={e("slug")}>
                <input id="slug" name="slug" dir="ltr" defaultValue={branch?.slug ?? ""} className={inputCls} />
              </Field>
              <Field label={a.common.order} name="sortOrder" error={e("sortOrder")}>
                <input id="sortOrder" name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={branch?.sortOrder ?? 0} className={`${inputCls} max-w-32`} />
              </Field>
            </div>
            <Toggle name="appointmentOnly" label={t.appointmentOnly} defaultChecked={branch?.appointmentOnly} />
            <Toggle name="active" label={t.active} defaultChecked={branch?.active ?? true} />
          </section>
        );
      }}
    </AdminForm>
  );
}
