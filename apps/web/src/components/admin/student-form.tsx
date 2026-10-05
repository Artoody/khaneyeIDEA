"use client";

import type { students } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { OpsDict } from "@/lib/ops-i18n";
import type { Locale } from "@/lib/i18n";
import { saveStudent } from "@/app/[lang]/app/admin/students/actions";
import { AdminForm, Field, inputCls, ListEditor, textareaCls } from "./fields";
import { errorText } from "./errors";

type Student = typeof students.$inferSelect;
export type GuardianRow = { phone: string; name: string; relation: "mother" | "father" | "other"; mediaConsent: boolean };

export function StudentForm({ s, guardians, a, o, lang }: { s?: Student; guardians: GuardianRow[]; a: AdminDict; o: OpsDict; lang: Locale }) {
  const t = o.students;
  return (
    <AdminForm action={saveStudent} hidden={{ id: s?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(st) => {
        const code = st.fieldErrors?.guardians;
        const ge = code === "phone" ? t.phoneInvalid : code === "guardian_required" ? t.guardianRequired : errorText(code, a);
        const e = (k: string) => errorText(st.fieldErrors?.[k], a);
        return (
          <>
            <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label={t.firstName} name="firstName" error={e("firstName")}>
                  <input id="firstName" name="firstName" defaultValue={s?.firstName ?? ""} className={inputCls} />
                </Field>
                <Field label={t.lastName} name="lastName">
                  <input id="lastName" name="lastName" defaultValue={s?.lastName ?? ""} className={inputCls} />
                </Field>
                <Field label={t.birthYear} name="birthYear" error={e("birthYear")}>
                  <input id="birthYear" name="birthYear" inputMode="numeric" dir="ltr" placeholder="1395" defaultValue={s?.birthYear ?? ""} className={inputCls} />
                </Field>
              </div>
              <Field label={t.notes} name="notes">
                <textarea id="notes" name="notes" defaultValue={s?.notes ?? ""} className={textareaCls} />
              </Field>
            </section>
            <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold">{t.guardians}</h2>
              <ListEditor<GuardianRow>
                name="guardians"
                initial={guardians.length ? guardians : [{ phone: "", name: "", relation: "mother", mediaConsent: false }]}
                blank={{ phone: "", name: "", relation: "father", mediaConsent: false }}
                addLabel={t.addGuardian}
                renderRow={(row, set) => (
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem] sm:items-center">
                    <input aria-label={t.guardianPhone} placeholder={t.guardianPhone} type="tel" dir="ltr" className={inputCls} value={row.phone} onChange={(ev) => set({ phone: ev.target.value })} />
                    <input aria-label={t.guardianName} placeholder={t.guardianName} className={inputCls} value={row.name} onChange={(ev) => set({ name: ev.target.value })} />
                    <select aria-label={t.relation} className={inputCls} value={row.relation} onChange={(ev) => set({ relation: ev.target.value as GuardianRow["relation"] })}>
                      {Object.entries(t.relations).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 px-1 text-sm text-muted sm:col-span-3">
                      <input type="checkbox" checked={row.mediaConsent} onChange={(ev) => set({ mediaConsent: ev.target.checked })} className="size-4 accent-[var(--accent)]" />
                      {t.mediaConsent}
                    </label>
                  </div>
                )}
              />
              {ge && (
                <p className="text-xs text-red-500" role="alert">
                  {ge}
                </p>
              )}
            </section>
          </>
        );
      }}
    </AdminForm>
  );
}
