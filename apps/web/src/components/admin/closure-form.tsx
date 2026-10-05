"use client";

import type { AdminDict } from "@/lib/admin-i18n";
import { addClosure } from "@/app/[lang]/app/admin/booking/closures/actions";
import { AdminForm, Field, inputCls, LocalizedInput } from "./fields";
import { errorText } from "./errors";
import { JalaliDateInput } from "./jalali-date-input";

export function ClosureForm({ branches, a, years }: { branches: { id: string; label: string }[]; a: AdminDict; years: number[] }) {
  const t = a.booking;
  return (
    <AdminForm action={addClosure} labels={{ save: t.addClosure, saved: a.common.saved, error: a.common.error }}>
      {(s) => (
        <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <JalaliDateInput name="date" label={t.date} years={years} />
              {s.fieldErrors?.date && <p className="mt-2 text-xs text-red-500" role="alert">{errorText(s.fieldErrors.date, a)}</p>}
            </div>
            <Field label={t.branch} name="branchId" error={errorText(s.fieldErrors?.branchId, a)}>
              <select id="branchId" name="branchId" className={inputCls}>
                <option value="">{t.allBranches}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <LocalizedInput label={t.reason} name="reason" />
        </section>
      )}
    </AdminForm>
  );
}
