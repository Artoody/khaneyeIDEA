"use client";

import type { AdminDict } from "@/lib/admin-i18n";
import type { OpsDict } from "@/lib/ops-i18n";
import { addStaff } from "@/app/[lang]/app/admin/staff/actions";
import { AdminForm, Field, inputCls } from "./fields";
import { errorText } from "./errors";

type Opt = { id: string; label: string };

export function StaffForm({ a, o, branches, teachers }: { a: AdminDict; o: OpsDict; branches: Opt[]; teachers: Opt[] }) {
  const t = o.staff;
  return (
    <AdminForm action={addStaff} labels={{ save: t.add, saved: t.added, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => (s.fieldErrors?.[k] === "phone" ? o.students.phoneInvalid : errorText(s.fieldErrors?.[k], a));
        return (
          <section className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-5">
            <Field label={t.phone} name="phone" error={e("phone")}>
              <input id="phone" name="phone" type="tel" dir="ltr" placeholder="0912 123 4567" className={inputCls} />
            </Field>
            <Field label={t.name} name="name">
              <input id="name" name="name" className={inputCls} />
            </Field>
            <Field label={t.role} name="role" error={e("role")}>
              <select id="role" name="role" defaultValue="teacher" className={inputCls}>
                {(["teacher", "admin", "content_manager", "owner"] as const).map((r) => (
                  <option key={r} value={r}>{t.roles[r]}</option>
                ))}
              </select>
            </Field>
            <Field label={t.branch} name="branchId" error={e("branchId")}>
              <select id="branchId" name="branchId" className={inputCls}>
                <option value="">{t.allBranches}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </Field>
            <Field label={t.teacherProfile} name="teacherId" error={e("teacherId")}>
              <select id="teacherId" name="teacherId" className={inputCls}>
                <option value="">{t.noProfile}</option>
                {teachers.map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
            </Field>
          </section>
        );
      }}
    </AdminForm>
  );
}
