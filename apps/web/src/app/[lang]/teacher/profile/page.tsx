import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, teachers } from "@khaneyeidea/db";
import { can } from "@khaneyeidea/core";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { getUser } from "@/server/auth";
import { ProfileForm } from "../profile-form";

async function Profile({ lang, saved }: { lang: Locale; saved: boolean }) {
  const user = await getUser();
  if (!user) redirect(href(lang, "/teacher/login"));
  if (!can(user, "session.report_own")) redirect(href(lang, "/app/no-access"));
  const [profile] = await getDb()
    .select()
    .from(teachers)
    .where(and(eq(teachers.userId, user.userId), eq(teachers.tenantId, user.tenantId)));
  if (!profile) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p>حساب دبیر به پروفایل وصل نیست. از مدیر بخواهید ورود را در پنل تنظیم کند.</p>
        <Link href={href(lang, "/teacher")} className="mt-6 inline-block text-sm text-accent-text underline">
          بازگشت
        </Link>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-12">
      <Link href={href(lang, "/teacher")} className="text-sm text-muted">
        ← پنل دبیر
      </Link>
      <h1 className="mt-6 font-display text-3xl font-extrabold">پروفایل</h1>
      <p className="mt-2 text-sm text-muted">{profile.name.fa} — عکس، لینک کلاس و رمز.</p>
      <ProfileForm
        lang={lang}
        photo={profile.photo ?? ""}
        meetingUrl={profile.meetingUrl ?? ""}
        passwordHref={href(lang, "/teacher/password")}
        saved={saved}
      />
    </main>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  return (
    <Suspense>
      {Promise.all([params, searchParams]).then(([{ lang }, sp]) =>
        isLocale(lang) ? <Profile lang={lang} saved={sp.saved === "1"} /> : notFound(),
      )}
    </Suspense>
  );
}
