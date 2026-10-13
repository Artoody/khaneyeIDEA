import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { LogoMark } from "@/components/site/logo-mark";
import { TeacherLoginForm } from "../login-form";

export default function Page({ params }: PageProps<"/[lang]/teacher/login">) {
  return (
    <Suspense>
      {params.then(({ lang }) => {
        if (!isLocale(lang)) notFound();
        return (
          <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-16">
            <LogoMark className="h-10 w-auto" />
            <h1 className="mt-6 font-display text-3xl font-extrabold">ورود دبیر</h1>
            <p className="mt-2 text-sm text-muted">با نام کاربری و رمزی که آموزشگاه داده وارد شوید.</p>
            <div className="mt-8">
              <TeacherLoginForm lang={lang} />
            </div>
          </main>
        );
      })}
    </Suspense>
  );
}
