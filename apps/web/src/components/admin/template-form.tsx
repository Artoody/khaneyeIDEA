"use client";

import type { availabilityTemplates } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { WEEKDAYS } from "@/lib/jalali";
import { saveTemplate } from "@/app/[lang]/app/admin/booking/templates/actions";
import { AdminForm, Field, inputCls, Toggle } from "./fields";
import { errorText } from "./errors";
import { JalaliDateInput } from "./jalali-date-input";

type Template = typeof availabilityTemplates.$inferSelect;
type Opt = { id: string; label: string };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function TemplateForm({
  tpl,
  options,
  a,
  lang,
  years,
}: {
  tpl?: Template;
  options: { types: Opt[]; branches: Opt[]; departments: Opt[]; courses: Opt[] };
  a: AdminDict;
  lang: Locale;
  years: number[];
}) {
  const t = a.booking;
  const chip =
    "flex min-w-14 cursor-pointer items-center justify-center rounded-full border border-line px-4 py-2 text-sm transition hover:border-ink/25 has-[:checked]:border-accent has-[:checked]:bg-accent/15 has-[:checked]:font-medium has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30";
  const select = (name: string, value: string | null | undefined, opts: Opt[], empty?: string) => (
    <select id={name} name={name} defaultValue={value ?? ""} className={inputCls}>
      {empty !== undefined && <option value="">{empty}</option>}
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const numField = (name: keyof Template & string, label: string, value: number | null | undefined, e: (k: string) => string | undefined) => (
    <Field label={label} name={name} error={e(name)}>
      <input id={name} name={name} inputMode="numeric" dir="ltr" defaultValue={value ?? ""} className={inputCls} />
    </Field>
  );
  return (
    <AdminForm action={saveTemplate} hidden={{ id: tpl?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <>
            <Card title={t.type}>
              <Field label={t.name} name="name" help={t.nameHelp} error={e("name")}>
                <input id="name" name="name" defaultValue={tpl?.name ?? ""} className={inputCls} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.type} name="appointmentTypeId" error={e("appointmentTypeId")}>
                  {select("appointmentTypeId", tpl?.appointmentTypeId ?? options.types[0]?.id, options.types)}
                </Field>
                <Field label={t.branch} name="branchId" error={e("branchId")}>
                  {select("branchId", tpl?.branchId, options.branches, t.noBranch)}
                </Field>
                <Field label={t.department} name="departmentId" error={e("departmentId")}>
                  {select("departmentId", tpl?.departmentId, options.departments, t.anyDepartment)}
                </Field>
                <Field label={t.course} name="courseId" error={e("courseId")}>
                  {select("courseId", tpl?.courseId, options.courses, t.anyCourse)}
                </Field>
                {numField("ageMin", t.ageMin, tpl?.ageMin, e)}
                {numField("ageMax", t.ageMax, tpl?.ageMax, e)}
              </div>
            </Card>

            <Card title={t.weekdays}>
              <fieldset>
                <legend className="sr-only">{t.weekdays}</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS[lang].map((d, i) => (
                    <label key={d} className={chip}>
                      <input type="checkbox" name="weekdays" value={i} defaultChecked={tpl?.weekdays.includes(i)} className="sr-only" />
                      {d}
                    </label>
                  ))}
                </div>
                {e("weekdays") && <p className="mt-2 text-xs text-red-500" role="alert">{e("weekdays")}</p>}
              </fieldset>
              <div className="grid gap-5 sm:grid-cols-4">
                <Field label={t.startTime} name="startTime" error={e("startTime")}>
                  <input id="startTime" name="startTime" type="time" dir="ltr" defaultValue={tpl?.startTime.slice(0, 5) ?? "16:00"} className={inputCls} />
                </Field>
                <Field label={t.endTime} name="endTime" error={e("endTime")}>
                  <input id="endTime" name="endTime" type="time" dir="ltr" defaultValue={tpl?.endTime.slice(0, 5) ?? "19:00"} className={inputCls} />
                </Field>
                {numField("slotMinutes", t.slotMinutes, tpl?.slotMinutes ?? 45, e)}
                {numField("capacity", t.capacity, tpl?.capacity ?? 4, e)}
              </div>
            </Card>

            <Card title={t.maxDays}>
              <div className="grid gap-5 sm:grid-cols-2">
                {numField("minLeadHours", t.minLead, tpl?.minLeadHours ?? 3, e)}
                {numField("maxDaysAhead", t.maxDays, tpl?.maxDaysAhead ?? 14, e)}
                <JalaliDateInput name="validFrom" value={tpl?.validFrom} label={t.validFrom} emptyLabel={t.noDate} years={years} />
                <div>
                  <JalaliDateInput name="validUntil" value={tpl?.validUntil} label={t.validUntil} emptyLabel={t.noDate} years={years} />
                  {e("validUntil") && <p className="mt-2 text-xs text-red-500" role="alert">{e("validUntil")}</p>}
                </div>
              </div>
              <Toggle name="active" label={a.common.active} defaultChecked={tpl?.active ?? true} />
            </Card>
          </>
        );
      }}
    </AdminForm>
  );
}
