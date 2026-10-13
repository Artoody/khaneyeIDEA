"use client";

import type { OpsDict } from "@/lib/ops-i18n";
import { JalaliDateInput } from "@/components/admin/jalali-date-input";

/** Hidden/shown fields for plannedSessions (6|7) and termStartedOn — used on enroll and edit. */
export function EnrollmentPackageFields({
  o,
  years,
  plannedSessions = 7,
  termStartedOn,
  compact,
}: {
  o: OpsDict;
  years: number[];
  plannedSessions?: number;
  termStartedOn?: string | null;
  compact?: boolean;
}) {
  const start = termStartedOn ?? new Date().toISOString().slice(0, 10);
  if (compact) {
    return (
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {o.students.plannedSessions}
          <select name="plannedSessions" defaultValue={plannedSessions === 6 ? 6 : 7} className="h-9 rounded-xl border border-line bg-bg px-2 text-sm text-ink">
            <option value={6}>{o.students.sessions6}</option>
            <option value={7}>{o.students.sessions7}</option>
          </select>
        </label>
        <div className="min-w-[12rem]">
          <JalaliDateInput name="termStartedOn" value={start} label={o.students.termStartedOn} years={years} />
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm">
        {o.students.plannedSessions}
        <select name="plannedSessions" defaultValue={plannedSessions === 6 ? 6 : 7} className="h-10 rounded-xl border border-line bg-bg px-3 text-sm">
          <option value={6}>{o.students.sessions6}</option>
          <option value={7}>{o.students.sessions7}</option>
        </select>
      </label>
      <JalaliDateInput name="termStartedOn" value={start} label={o.students.termStartedOn} years={years} />
    </div>
  );
}
