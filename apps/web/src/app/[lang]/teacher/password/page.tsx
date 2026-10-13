import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, users } from "@khaneyeidea/db";
import { href, isLocale } from "@/lib/i18n";
import { getUser } from "@/server/auth";
import { PasswordForm } from "../password-form";

export default function Page({ params }: PageProps<"/[lang]/teacher/password">) {
  return (
    <Suspense>
      {params.then(async ({ lang }) => {
        if (!isLocale(lang)) notFound();
        const user = await getUser();
        if (!user) redirect(href(lang, "/teacher/login"));
        const [row] = await getDb().select({ must: users.mustChangePassword }).from(users).where(eq(users.id, user.userId));
        return (
          <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-16">
            <h1 className="font-display text-3xl font-extrabold">رمز جدید</h1>
            <p className="mt-2 text-sm text-muted">{row?.must ? "قبل از ادامه، رمز اولیه‌ای که آموزشگاه داده را عوض کنید." : "رمز پنل دبیر را عوض کنید."}</p>
            <PasswordForm lang={lang} forced={!!row?.must} />
          </main>
        );
      })}
    </Suspense>
  );
}
