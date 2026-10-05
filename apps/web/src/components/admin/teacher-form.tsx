"use client";

import type { Localized, teachers } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { saveTeacher } from "@/app/[lang]/app/admin/teachers/actions";
import { AdminForm, Field, inputCls, ListEditor, LocalizedInput, Toggle } from "./fields";
import { errorText } from "./errors";

type Teacher = typeof teachers.$inferSelect;

export function TeacherForm({ teacher, a, lang }: { teacher?: Teacher; a: AdminDict; lang: Locale }) {
  const t = a.teacher;
  return (
    <AdminForm action={saveTeacher} hidden={{ id: teacher?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <LocalizedInput label={t.name} name="name" value={teacher?.name} required error={e("name")} />
            <LocalizedInput label={t.role} name="role" value={teacher?.role} />
            <LocalizedInput label={t.bio} name="bio" value={teacher?.bio} multiline />
            <Field label={t.specialties} error={e("specialties")}>
              <ListEditor<Localized>
                name="specialties"
                initial={teacher?.specialties ?? []}
                blank={{ fa: "", en: "" }}
                addLabel={t.addSpecialty}
                renderRow={(row, set) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label={`${t.specialties} FA`} dir="rtl" className={inputCls} value={row.fa} onChange={(ev) => set({ fa: ev.target.value })} />
                    <input aria-label={`${t.specialties} EN`} dir="ltr" className={inputCls} value={row.en} onChange={(ev) => set({ en: ev.target.value })} />
                  </div>
                )}
              />
            </Field>
            <Field label={a.common.order} name="sortOrder" error={e("sortOrder")}>
              <input id="sortOrder" name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={teacher?.sortOrder ?? 0} className={`${inputCls} max-w-40`} />
            </Field>
            <Toggle name="showOnSite" label={t.showOnSite} defaultChecked={teacher?.showOnSite ?? true} />
            <Toggle name="isSample" label={t.isSample} help={t.isSampleHelp} defaultChecked={teacher?.isSample ?? false} />
          </section>
        );
      }}
    </AdminForm>
  );
}
