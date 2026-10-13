"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { num, type Locale } from "@/lib/i18n";
import { updateEnrollmentTerm } from "@/app/[lang]/app/admin/classes/actions";
import { EnrollmentPackageFields } from "./enrollment-package-fields";

/** Always-visible package progress (e.g. ۳ از ۷) with a one-tap edit for count + start date. */
export function EnrollmentPackageEdit({
  enrollmentId,
  plannedSessions,
  termStartedOn,
  sessionsUsed,
  termComplete,
  o,
  lang,
  years,
}: {
  enrollmentId: string;
  plannedSessions: number;
  termStartedOn: string | null;
  sessionsUsed: number;
  termComplete: boolean;
  o: OpsDict;
  lang: Locale;
  years: number[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="mt-1" data-testid="package-progress">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs tabular-nums ${
            termComplete ? "bg-accent/20 font-semibold text-accent-text" : "bg-ink/5 text-ink"
          }`}
        >
          {fill(o.students.packageProgress, { u: num(sessionsUsed, lang), p: num(plannedSessions, lang) })}
          {termComplete ? ` · ${o.students.packageDone}` : ""}
        </span>
        <button
          type="button"
          data-testid="package-edit"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {o.students.editPackage}
        </button>
      </div>
      {open && (
        <form
          className="mt-2 rounded-xl border border-line bg-bg p-3"
          data-testid="package-form"
          action={(fd) => {
            start(async () => {
              await updateEnrollmentTerm(fd);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="id" value={enrollmentId} />
          <EnrollmentPackageFields o={o} years={years} plannedSessions={plannedSessions} termStartedOn={termStartedOn} compact />
          <button type="submit" disabled={pending} className="mt-2 h-9 rounded-full bg-ink px-4 text-xs font-medium text-bg disabled:opacity-60">
            {o.students.savePackage}
          </button>
        </form>
      )}
    </div>
  );
}
