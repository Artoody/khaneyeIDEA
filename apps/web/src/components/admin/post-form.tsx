"use client";

import type { posts } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { savePost } from "@/app/[lang]/app/admin/posts/actions";
import { AdminForm, Field, inputCls, LocalizedInput, textareaCls } from "./fields";
import { errorText } from "./errors";
import { JalaliDateInput } from "./jalali-date-input";

type Post = typeof posts.$inferSelect;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function PostForm({ post, a, lang, years }: { post?: Post; a: AdminDict; lang: Locale; years: number[] }) {
  const t = a.post;
  const iso = post?.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : null;
  return (
    <AdminForm action={savePost} hidden={{ id: post?.id ?? "", lang }} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => {
        const e = (k: string) => errorText(s.fieldErrors?.[k], a);
        return (
          <>
            <Card title={t.content}>
              <LocalizedInput label={t.title} name="title" value={post?.title} required error={e("title")} />
              <LocalizedInput label={t.excerpt} name="excerpt" value={post?.excerpt} multiline help={t.excerptHelp} />
              <Field label={`${t.body} (فارسی)`} name="body.fa" help={t.bodyHelp} error={e("body")}>
                <textarea id="body.fa" name="body.fa" dir="rtl" defaultValue={post?.body.fa ?? ""} className={`${textareaCls} min-h-[28rem] font-mono text-[14px]`} />
              </Field>
              <Field label={`${t.body} (English)`} name="body.en">
                <textarea id="body.en" name="body.en" dir="ltr" defaultValue={post?.body.en ?? ""} className={`${textareaCls} min-h-40 font-mono text-[14px]`} />
              </Field>
            </Card>
            <Card title={t.publishing}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="slug" name="slug" help={a.common.slugHelp} error={e("slug")}>
                  <input id="slug" name="slug" dir="ltr" defaultValue={post?.slug ?? ""} className={inputCls} />
                </Field>
                <Field label={a.course.status} name="status">
                  <select id="status" name="status" defaultValue={post?.status ?? "draft"} className={inputCls}>
                    <option value="published">{a.common.published}</option>
                    <option value="draft">{a.common.draft}</option>
                  </select>
                </Field>
                <JalaliDateInput name="publishedAt" value={iso} label={t.date} years={[years[0]! - 2, years[0]! - 1, ...years]} />
                <Field label={t.cover} name="coverImage" help={t.coverHelp} error={e("coverImage")}>
                  <input id="coverImage" name="coverImage" dir="ltr" defaultValue={post?.coverImage ?? ""} className={inputCls} />
                </Field>
              </div>
            </Card>
            <Card title="SEO">
              <LocalizedInput label="Title" name="seoTitle" value={post?.seo.title} />
              <LocalizedInput label="Description" name="seoDescription" value={post?.seo.description} multiline />
            </Card>
          </>
        );
      }}
    </AdminForm>
  );
}
