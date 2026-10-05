"use client";

import { WarningCircle } from "@phosphor-icons/react";
import type { classGroups } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { OpsDict } from "@/lib/ops-i18n";
import type { Locale } from "@/lib/i18n";
import { num } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { WEEKDAYS } from "@/lib/jalali";
import { saveClass, type ClassState } from "@/app/[lang]/app/admin/classes/actions";
import { AdminForm, Field, inputCls, Toggle } from "./fields";
import { errorText } from "./errors";
import { JalaliDateInput } from "./jalali-date-input";
import { TimeSelect } from "@/components/ops/time-select";

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
  options: { courses: Opt[]; teachers: Opt[]; branches: Opt[]; rooms: Opt[] };
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
        const synced = (s as ClassState).synced;
        const conflicts = (s as ClassState).conflicts;
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
              <Field label={o.groups.room} name="roomId" error={e("roomId")}>
                {sel("roomId", c?.roomId, options.rooms, o.groups.noRoom)}
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
              <div>
                <TimeSelect name="startTime" value={c?.startTime.slice(0, 5) ?? "17:00"} label={t.start} />
                {e("startTime") && <p className="mt-1.5 text-xs text-red-500">{e("startTime")}</p>}
              </div>
              <div>
                <TimeSelect name="endTime" value={c?.endTime.slice(0, 5) ?? "18:30"} label={t.end} />
                {e("endTime") && <p className="mt-1.5 text-xs text-red-500">{e("endTime")}</p>}
              </div>
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
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={o.groups.baleInvite} name="baleInviteUrl" error={e("baleInviteUrl")}>
                <input id="baleInviteUrl" name="baleInviteUrl" dir="ltr" placeholder="https://ble.ir/join/…" defaultValue={c?.baleInviteUrl ?? ""} className={inputCls} />
              </Field>
              <Field label={o.groups.telegramInvite} name="telegramInviteUrl" error={e("telegramInviteUrl")}>
                <input id="telegramInviteUrl" name="telegramInviteUrl" dir="ltr" placeholder="https://t.me/+…" defaultValue={c?.telegramInviteUrl ?? ""} className={inputCls} />
              </Field>
            </div>
            {conflicts && conflicts.length > 0 && (
              <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 text-sm" role="alert" data-testid="class-conflict">
                <p className="flex items-center gap-2 font-medium">
                  <WarningCircle weight="fill" className="size-5 text-accent-text" />
                  {o.conflict.title}
                </p>
                <ul className="mt-2 list-inside list-disc text-muted">
                  {conflicts.map((x, i) => (
                    <li key={i}>{fill(x.kind === "teacher" ? o.conflict.teacher : o.conflict.room, { title: x.title })}</li>
                  ))}
                </ul>
                <label className="mt-3 flex items-center gap-2">
                  <input type="checkbox" name="force" className="size-4 accent-[var(--accent)]" />
                  {o.conflict.saveAnyway}
                </label>
              </div>
            )}
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
