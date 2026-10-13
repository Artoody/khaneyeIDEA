"use client";

import { useActionState } from "react";
import { CheckCircle, CircleNotch, UserPlus, WarningCircle } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { addNewStudentToClass } from "@/app/[lang]/app/admin/classes/actions";
import { EnrollmentPackageFields } from "./enrollment-package-fields";

const box = "h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-red-500";

/** Register a new child with one parent number and put them in this class, without leaving the class page. */
export function QuickStudent({ classGroupId, o, years }: { classGroupId: string; o: OpsDict; years: number[] }) {
  const [s, action, pending] = useActionState(addNewStudentToClass, {} as Awaited<ReturnType<typeof addNewStudentToClass>>);
  const t = o.students;
  const bad = (k: string) => !!s.fieldErrors?.[k];
  return (
    <details className="mt-3 rounded-2xl border border-line p-4" data-testid="quick-student">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <UserPlus weight="duotone" className="size-5 text-accent-text" />
        {t.quick}
      </summary>
      <form action={action} key={s.savedAt} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="classGroupId" value={classGroupId} />
        <input name="firstName" placeholder={t.firstName} aria-label={t.firstName} aria-invalid={bad("firstName")} className={box} />
        <input name="lastName" placeholder={t.lastName} aria-label={t.lastName} className={box} />
        <input name="birthYear" inputMode="numeric" dir="ltr" placeholder={`${t.birthYear} 1395`} aria-label={t.birthYear} aria-invalid={bad("birthYear")} className={box} />
        <input name="guardianPhone" type="tel" dir="ltr" placeholder={t.guardianPhone} aria-label={t.guardianPhone} aria-invalid={bad("guardianPhone")} className={box} />
        <input name="guardianName" placeholder={t.guardianName} aria-label={t.guardianName} className={`${box} sm:col-span-2`} />
        <div className="sm:col-span-2">
          <EnrollmentPackageFields o={o} years={years} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-bg transition active:scale-[0.98] disabled:opacity-60">
            {pending && <CircleNotch className="size-4 animate-spin" />}
            {t.quickSave}
          </button>
          {s.ok && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400" role="status">
              <CheckCircle weight="fill" className="size-4" />
              {fill(t.quickOk, { name: s.name ?? "" })}
            </span>
          )}
          {s.error && (
            <span className="inline-flex items-center gap-1.5 text-sm text-red-500" role="alert">
              <WarningCircle weight="fill" className="size-4" />
              {s.fieldErrors?.guardianPhone ? t.phoneInvalid : s.fieldErrors?.firstName ? t.firstName : s.error}
            </span>
          )}
        </div>
      </form>
    </details>
  );
}
