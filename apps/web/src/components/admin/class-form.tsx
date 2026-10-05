"use client";

import type { classGroups } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { OpsDict } from "@/lib/ops-i18n";
import type { Locale } from "@/lib/i18n";
import { num } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { WEEKDAYS } from "@/lib/jalali";
import { saveClass } from "@/app/[lang]/app/admin/classes/actions";
import { AdminForm, Field, inputCls, Toggle } from "./fields";
import { errorText } from "./errors";
import { JalaliDateInput } from "./jalali-date-input";

type ClassGroup = typeof classGroups.$inferSelect;
type Opt = { id: string; label: string };

export function ClassForm({
  c,
  a,
  o,
  lang,
  years,
  options,
}: {
  c?: ClassGroup;
  a: AdminDict;
  o: OpsDict;
  lang: Locale;
  years: number[];
  options: { courses: Opt[]; teachers: Opt[]; branches: Opt[] };
}) {
  const t = o.classes;
  const sel = (name: string, value: string | null | undefined, opts: Opt[], empty?: string) => (
    <select id={name} name={name} defaultValue={value ?? ""} className={inputCls}>
      {empty !== undefined && <option value="">{empty}</option>}
      {opts.map((x) => (
        <option key={x.id} value={x.id}>
          {x.label}
        </option>
      ))}
    </select>
  );
  return (
    <AdminForm action={saveClass} hidden={{ id: c?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => (s.fieldErrors?.[k] === "time_order" ? t.timeOrder : errorText(s.fieldErrors?.[k], a));
        const synced = (s as { synced?: { added: number; removed: number } }).synced;
        return (
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <Field label={t.title} name="title" help={t.titleHelp} error={e("title")}>
              <input id="title" name="title" defaultValue={c?.title ?? ""} className={inputCls} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t.course} name="courseId" error={e("courseId")}>
                {sel("courseId", c?.courseId ?? options.courses[0]?.id, options.courses)}
              </Field>
              <Field label={t.teacher} name="teacherId" error={e("teacherId")}>
                {sel("teacherId", c?.teacherId, options.teachers, t.noTeacher)}
              </Field>
              <Field label={t.mode} name="mode">
                <select id="mode" name="mode" defaultValue={c?.mode ?? "in_person"} className={inputCls}>
                  <option value="in_person">{a.course.in_person}</option>
                  <option value="online">{a.course.online}</option>
                  <option value="hybrid">{a.course.hybrid}</option>
                </select>
              </Field>
              <Field label={t.branch} name="branchId" error={e("branchId")}>
                {sel("branchId", c?.branchId, options.branches, t.online)}
              </Field>
              <Field label={t.weekday} name="weekday" error={e("weekday")}>
                <select id="weekday" name="weekday" defaultValue={c?.weekday ?? 0} className={inputCls}>
                  {WEEKDAYS[lang].map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.capacity} name="capacity" error={e("capacity")}>
                <input id="capacity" name="capacity" inputMode="numeric" dir="ltr" defaultValue={c?.capacity ?? 8} className={inputCls} />
              </Field>
              <Field label={t.start} name="startTime" error={e("startTime")}>
                <input id="startTime" name="startTime" type="time" dir="ltr" defaultValue={c?.startTime.slice(0, 5) ?? "17:00"} className={inputCls} />
              </Field>
              <Field label={t.end} name="endTime" error={e("endTime")}>
                <input id="endTime" name="endTime" type="time" dir="ltr" defaultValue={c?.endTime.slice(0, 5) ?? "18:30"} className={inputCls} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <JalaliDateInput name="startsOn" value={c?.startsOn ?? new Date().toISOString().slice(0, 10)} label={t.startsOn} years={[years[0]! - 1, ...years]} />
                {e("startsOn") && <p className="mt-2 text-xs text-red-500">{e("startsOn")}</p>}
              </div>
              <div>
                <JalaliDateInput name="endsOn" value={c?.endsOn} label={t.endsOn} emptyLabel={t.noEnd} years={years} />
                {e("endsOn") && <p className="mt-2 text-xs text-red-500">{e("endsOn")}</p>}
              </div>
            </div>
            <Field label={t.onlineUrl} name="onlineUrl" error={e("onlineUrl")}>
              <input id="onlineUrl" name="onlineUrl" dir="ltr" placeholder="https://" defaultValue={c?.onlineUrl ?? ""} className={inputCls} />
            </Field>
            <Toggle name="active" label={t.active} defaultChecked={c?.active ?? true} />
            {synced && (synced.added > 0 || synced.removed > 0) && (
              <p className="text-sm text-muted" role="status">
                {fill(t.synced, { a: num(synced.added, lang), r: num(synced.removed, lang) })}
              </p>
            )}
          </section>
        );
      }}
    </AdminForm>
  );
}
