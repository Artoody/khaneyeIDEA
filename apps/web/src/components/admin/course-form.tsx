"use client";

import type { courses, Localized } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { saveCourse } from "@/app/[lang]/app/admin/courses/actions";
import { AdminForm, Field, inputCls, ListEditor, LocalizedInput } from "./fields";
import { errorText } from "./errors";

type Course = typeof courses.$inferSelect;
type Opt = { id: string; label: string };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function NumberField({ name, label, value, error }: { name: string; label: string; value: number | null | undefined; error?: string }) {
  return (
    <Field label={label} name={name} error={error}>
      <input id={name} name={name} inputMode="numeric" dir="ltr" defaultValue={value ?? ""} className={inputCls} />
    </Field>
  );
}

export function CourseForm({
  course,
  branchIds,
  departments,
  branches,
  a,
  lang,
}: {
  course?: Course;
  branchIds: string[];
  departments: Opt[];
  branches: Opt[];
  a: AdminDict;
  lang: Locale;
}) {
  const t = a.course;
  const chip =
    "flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm transition has-[:checked]:border-accent has-[:checked]:bg-accent/15 hover:border-ink/25";
  return (
    <AdminForm action={saveCourse} hidden={{ id: course?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <>
            <Card title={t.basics}>
              <LocalizedInput label={t.title} name="title" value={course?.title} required error={e("title")} />
              <LocalizedInput label={t.summary} name="summary" value={course?.summary} multiline />
              <LocalizedInput label={t.body} name="body" value={course?.body} multiline />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.department} name="departmentId" error={e("departmentId")}>
                  <select id="departmentId" name="departmentId" defaultValue={course?.departmentId ?? ""} className={inputCls}>
                    <option value="">{t.none}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t.status} name="status">
                  <select id="status" name="status" defaultValue={course?.status ?? "draft"} className={inputCls}>
                    <option value="published">{a.common.published}</option>
                    <option value="draft">{a.common.draft}</option>
                  </select>
                </Field>
                <Field label="slug" name="slug" help={a.common.slugHelp} error={e("slug")}>
                  <input id="slug" name="slug" dir="ltr" defaultValue={course?.slug ?? ""} className={inputCls} />
                </Field>
                <NumberField name="sortOrder" label={a.common.order} value={course?.sortOrder} error={e("sortOrder")} />
              </div>
            </Card>

            <Card title={t.details}>
              <div className="grid gap-5 sm:grid-cols-4">
                <NumberField name="ageMin" label={t.ageMin} value={course?.ageMin} error={e("ageMin")} />
                <NumberField name="ageMax" label={t.ageMax} value={course?.ageMax} error={e("ageMax")} />
                <NumberField name="sessionsCount" label={t.sessions} value={course?.sessionsCount} error={e("sessionsCount")} />
                <NumberField name="durationWeeks" label={t.weeks} value={course?.durationWeeks} error={e("durationWeeks")} />
              </div>
              <Field label={t.level} name="level">
                <input id="level" name="level" defaultValue={course?.level ?? ""} className={inputCls} />
              </Field>
              <LocalizedInput label={t.prerequisites} name="prerequisites" value={course?.prerequisites} />
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t.modes}</legend>
                <div className="flex flex-wrap gap-2">
                  {(["in_person", "online", "hybrid"] as const).map((m) => (
                    <label key={m} className={chip}>
                      <input type="checkbox" name="modes" value={m} defaultChecked={course?.modes.includes(m)} className="sr-only" />
                      {t[m]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t.branches}</legend>
                <div className="flex flex-wrap gap-2">
                  {branches.map((b) => (
                    <label key={b.id} className={chip}>
                      <input type="checkbox" name="branchIds" value={b.id} defaultChecked={branchIds.includes(b.id)} className="sr-only" />
                      {b.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </Card>

            <Card title={t.price}>
              <div className="grid gap-5 sm:grid-cols-2">
                <NumberField name="price" label={t.price} value={course?.price} error={e("price")} />
                <Field label={t.priceVisibility} name="priceVisibility">
                  <select id="priceVisibility" name="priceVisibility" defaultValue={course?.priceVisibility ?? "contact"} className={inputCls}>
                    <option value="show">{t.show}</option>
                    <option value="contact">{t.contact}</option>
                    <option value="hide">{t.hide}</option>
                  </select>
                </Field>
              </div>
            </Card>

            <Card title={t.syllabus}>
              <ListEditor<Localized>
                name="syllabus"
                initial={course?.syllabus ?? []}
                blank={{ fa: "", en: "" }}
                addLabel={t.addSyllabus}
                renderRow={(row, set) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label="FA" dir="rtl" className={inputCls} value={row.fa} onChange={(ev) => set({ fa: ev.target.value })} />
                    <input aria-label="EN" dir="ltr" className={inputCls} value={row.en} onChange={(ev) => set({ en: ev.target.value })} />
                  </div>
                )}
              />
            </Card>

            <Card title="SEO">
              <LocalizedInput label="Title" name="seoTitle" value={course?.seo.title} />
              <LocalizedInput label="Description" name="seoDescription" value={course?.seo.description} multiline />
            </Card>
          </>
        );
      }}
    </AdminForm>
  );
}
