import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, users } from "@khaneyeidea/db";
import { href, isLocale } from "@/lib/i18n";
import { getUser } from "@/server/auth";
import { AuthFrame } from "@/components/teacher/auth-frame";
import { StaffPasswordForm } from "../password-form";

export default function Page({ params }: PageProps<"/[lang]/admin/password">) {
  return (
    <Suspense>
      {params.then(async ({ lang }) => {
        if (!isLocale(lang)) notFound();
        const user = await getUser();
        if (!user) redirect(href(lang, "/admin/login"));
        const [row] = await getDb().select({ must: users.mustChangePassword }).from(users).where(eq(users.id, user.userId));
        const fa = lang === "fa";
        return (
          <AuthFrame
            title={fa ? "رمز جدید" : "New password"}
            help={row?.must ? (fa ? "قبل از ادامه، رمز اولیه‌ای که آموزشگاه داده را عوض کنید." : "Before you continue, change the first password the academy gave you.") : fa ? "رمز پنل مدیریت را عوض کنید." : "Change your admin panel password."}
          >
            <StaffPasswordForm lang={lang} forced={!!row?.must} />
          </AuthFrame>
        );
      })}
    </Suspense>
  );
}
