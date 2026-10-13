import { redirect } from "next/navigation";
import { href, isLocale } from "@/lib/i18n";

export default async function Page({ params }: PageProps<"/[lang]/app/teacher">) {
  const { lang } = await params;
  redirect(href(isLocale(lang) ? lang : "fa", "/teacher"));
}
