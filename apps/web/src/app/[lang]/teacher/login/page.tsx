import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { AuthFrame } from "@/components/teacher/auth-frame";
import { TeacherLoginForm } from "../login-form";

export default function Page({ params }: PageProps<"/[lang]/teacher/login">) {
  return (
    <Suspense>
      {params.then(({ lang }) => {
        if (!isLocale(lang)) notFound();
        const t = getOpsDict(lang).tp.login;
        return (
          <AuthFrame title={t.title} help={t.help}>
            <TeacherLoginForm lang={lang} t={t} />
          </AuthFrame>
        );
      })}
    </Suspense>
  );
}
