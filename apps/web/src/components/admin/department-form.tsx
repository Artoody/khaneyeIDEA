"use client";

import type { departments } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { DEPT_ICON_KEYS } from "@/lib/dept-icons";
import { DEPT_ICONS as ICONS } from "@/components/site/dept-icon";
import { saveDepartment } from "@/app/[lang]/app/admin/departments/actions";
import { AdminForm, Field, inputCls, LocalizedInput, Toggle } from "./fields";
import { errorText } from "./errors";

type Department = typeof departments.$inferSelect;

export function DepartmentForm({ dept, a, lang }: { dept?: Department; a: AdminDict; lang: Locale }) {
  const t = a.department;
  return (
    <AdminForm action={saveDepartment} hidden={{ id: dept?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <LocalizedInput label={t.name} name="title" value={dept?.title} required error={e("title")} />
            <LocalizedInput label={t.description} name="description" value={dept?.description} multiline />
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t.icon}</legend>
              <div className="flex flex-wrap gap-2">
                {DEPT_ICON_KEYS.map((k) => {
                  const Ico = ICONS[k];
                  return (
                    <label
                      key={k}
                      title={k}
                      className="grid size-12 cursor-pointer place-items-center rounded-xl border border-line text-muted transition hover:border-ink/25 has-[:checked]:border-accent has-[:checked]:bg-accent/15 has-[:checked]:text-ink has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30"
                    >
                      <input type="radio" name="icon" value={k} defaultChecked={(dept?.icon ?? "lightbulb") === k} className="sr-only" />
                      <Ico weight="duotone" className="size-6" />
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="slug" name="slug" help={a.common.slugHelp} error={e("slug")}>
                <input id="slug" name="slug" dir="ltr" defaultValue={dept?.slug ?? ""} className={inputCls} />
              </Field>
              <Field label={a.common.order} name="sortOrder" error={e("sortOrder")}>
                <input id="sortOrder" name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={dept?.sortOrder ?? 0} className={inputCls} />
              </Field>
            </div>
            <Toggle name="active" label={a.common.active} defaultChecked={dept?.active ?? true} />
          </section>
        );
      }}
    </AdminForm>
  );
}
