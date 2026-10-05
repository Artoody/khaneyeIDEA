"use client";

import type { PhoneEntry, SocialEntry, siteSettings } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import { saveSettings } from "@/app/[lang]/app/admin/settings/actions";
import { AdminForm, Field, inputCls, ListEditor, LocalizedInput, Toggle } from "./fields";

type Settings = typeof siteSettings.$inferSelect;
const KINDS: SocialEntry["kind"][] = ["instagram", "bale", "telegram", "whatsapp", "youtube", "aparat", "linkedin"];

function Card({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {help && <p className="mt-1 text-sm text-muted">{help}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function SettingsForm({ s, a }: { s: Settings; a: AdminDict }) {
  const t = a.settings;
  const err = (fe: Record<string, string> | undefined, k: string) => {
    const code = fe?.[k];
    if (!code) return undefined;
    if (code === "fa_required") return a.common.faRequired;
    if (code === "number") return a.common.numberInvalid;
    if (code === "https_required") return "https://…";
    return code;
  };
  return (
    <AdminForm action={saveSettings} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(state) => (
        <>
          <Card title={t.identity}>
            <LocalizedInput label={t.name} name="name" value={s.name} required error={err(state.fieldErrors, "name")} />
            <LocalizedInput label={t.tagline} name="tagline" value={s.tagline} required error={err(state.fieldErrors, "tagline")} />
          </Card>

          <Card title={t.contact}>
            <Field label={t.phones}>
              <ListEditor<PhoneEntry>
                name="phones"
                initial={s.phones}
                blank={{ label: { fa: "", en: "" }, number: "", primary: false }}
                addLabel={t.addPhone}
                renderRow={(row, set) => (
                  <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center">
                    <input aria-label={t.phoneNumber} placeholder="0912 123 4567" dir="ltr" className={inputCls} value={row.number} onChange={(e) => set({ number: e.target.value })} />
                    <input aria-label={`${t.phoneLabel} FA`} placeholder={`${t.phoneLabel} (FA)`} dir="rtl" className={inputCls} value={row.label.fa} onChange={(e) => set({ label: { ...row.label, fa: e.target.value } })} />
                    <input aria-label={`${t.phoneLabel} EN`} placeholder={`${t.phoneLabel} (EN)`} dir="ltr" className={inputCls} value={row.label.en} onChange={(e) => set({ label: { ...row.label, en: e.target.value } })} />
                    <label className="flex items-center gap-2 px-1 text-sm text-muted">
                      <input type="checkbox" checked={!!row.primary} onChange={(e) => set({ primary: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                      {t.primary}
                    </label>
                  </div>
                )}
              />
            </Field>
            <Field label={t.email} name="email" error={err(state.fieldErrors, "email")}>
              <input id="email" name="email" type="email" dir="ltr" defaultValue={s.email ?? ""} className={inputCls} />
            </Field>
            <LocalizedInput label={t.hours} name="workingHours" value={s.workingHours} />
            <Field label={t.socials} error={err(state.fieldErrors, "socials")}>
              <ListEditor<SocialEntry>
                name="socials"
                initial={s.socials}
                blank={{ kind: "instagram", url: "", enabled: true }}
                addLabel={t.addSocial}
                renderRow={(row, set) => (
                  <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
                    <select aria-label={t.socialKind} className={inputCls} value={row.kind} onChange={(e) => set({ kind: e.target.value as SocialEntry["kind"] })}>
                      {KINDS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                    <input aria-label={t.socialUrl} placeholder="https://" dir="ltr" className={inputCls} value={row.url} onChange={(e) => set({ url: e.target.value })} />
                    <label className="flex items-center gap-2 px-1 text-sm text-muted">
                      <input type="checkbox" checked={row.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                      {a.common.active}
                    </label>
                  </div>
                )}
              />
            </Field>
          </Card>

          <Card title={t.display}>
            <Toggle name="showPrices" label={t.showPrices} help={t.showPricesHelp} defaultChecked={s.showPrices} />
            <Toggle name="showStudentCount" label={t.showStudentCount} help={t.showStudentCountHelp} defaultChecked={s.showStudentCount} />
            <Field label={t.yearsActive} name="yearsActive" error={err(state.fieldErrors, "yearsActive")}>
              <input id="yearsActive" name="yearsActive" inputMode="numeric" dir="ltr" defaultValue={s.stats.yearsActive ?? ""} className={`${inputCls} max-w-40`} />
            </Field>
          </Card>

          <Card title={t.seo}>
            <LocalizedInput label={t.seoTitle} name="seoTitle" value={s.seo.title} />
            <LocalizedInput label={t.seoDescription} name="seoDescription" value={s.seo.description} multiline />
          </Card>
        </>
      )}
    </AdminForm>
  );
}
