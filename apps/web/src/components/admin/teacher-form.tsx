"use client";

import { useState } from "react";
import type { Localized, teachers } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { saveTeacher } from "@/app/[lang]/app/admin/teachers/actions";
import { AdminForm, Field, inputCls, ListEditor, LocalizedInput, Toggle } from "./fields";
import { errorText } from "./errors";

type Teacher = typeof teachers.$inferSelect;

export function TeacherForm({ teacher, a, lang }: { teacher?: Teacher; a: AdminDict; lang: Locale }) {
  const t = a.teacher;
  const [preview, setPreview] = useState<string | null>(teacher?.photo ?? null);
  return (
    <AdminForm action={saveTeacher} hidden={{ id: teacher?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => {
          const code = s.fieldErrors?.[k];
          if (code === "photo_type") return t.photoType;
          if (code === "photo_size") return t.photoSize;
          return errorText(code, a);
        };
        return (
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <LocalizedInput label={t.name} name="name" value={teacher?.name} required error={e("name")} />
            <LocalizedInput label={t.role} name="role" value={teacher?.role} />
            <LocalizedInput label={t.bio} name="bio" value={teacher?.bio} multiline />
            <Field label={t.specialties} error={e("specialties")}>
              <ListEditor<Localized>
                name="specialties"
                initial={teacher?.specialties ?? []}
                blank={{ fa: "", en: "" }}
                addLabel={t.addSpecialty}
                renderRow={(row, set) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label={`${t.specialties} FA`} dir="rtl" className={inputCls} value={row.fa} onChange={(ev) => set({ fa: ev.target.value })} />
                    <input aria-label={`${t.specialties} EN`} dir="ltr" className={inputCls} value={row.en} onChange={(ev) => set({ en: ev.target.value })} />
                  </div>
                )}
              />
            </Field>
            <Field label={t.photo} help={t.photoHelp} error={e("photo")}>
              <input type="hidden" name="photo" value={teacher?.photo ?? ""} />
              <div className="flex flex-wrap items-start gap-4">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="size-24 rounded-2xl object-cover ring-1 ring-line" />
                ) : (
                  <span className="grid size-24 place-items-center rounded-2xl bg-ink/5 text-xs text-muted">{t.noPhoto}</span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    id="photoFile"
                    name="photoFile"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={`${inputCls} cursor-pointer file:me-3 file:rounded-full file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-sm file:font-medium`}
                    onChange={(ev) => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      setPreview(URL.createObjectURL(file));
                    }}
                  />
                  {(preview || teacher?.photo) && (
                    <label className="inline-flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        name="clearPhoto"
                        onChange={(ev) => {
                          if (ev.target.checked) {
                            setPreview(null);
                            const input = document.getElementById("photoFile") as HTMLInputElement | null;
                            if (input) input.value = "";
                          } else {
                            setPreview(teacher?.photo ?? null);
                          }
                        }}
                      />
                      {t.clearPhoto}
                    </label>
                  )}
                </div>
              </div>
            </Field>
            <Field label={t.meetingUrl} name="meetingUrl" help={t.meetingUrlHelp} error={e("meetingUrl")}>
              <input id="meetingUrl" name="meetingUrl" dir="ltr" defaultValue={teacher?.meetingUrl ?? ""} placeholder="https://" className={inputCls} />
            </Field>
            <Toggle name="showOnSite" label={t.showOnSite} defaultChecked={teacher?.showOnSite ?? true} />
            <Toggle name="isSample" label={t.isSample} help={t.isSampleHelp} defaultChecked={teacher?.isSample ?? false} />
          </section>
        );
      }}
    </AdminForm>
  );
}
