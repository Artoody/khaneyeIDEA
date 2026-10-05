import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { homeFor } from "@khaneyeidea/core";
import { href, isLocale, type Locale } from "@/lib/i18n";
import { requireUser } from "@/server/auth";
import { PanelSkeleton } from "@/components/panel/panel-shell";

async function RouteToHome({ lang }: { lang: Locale }) {
  const user = await requireUser(lang);
  const home = homeFor(user);
  if (home !== "/app") redirect(href(lang, home));
  return notFound();
}

export default async function AppIndex({ params }: PageProps<"/[lang]/app">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <RouteToHome lang={lang} />
    </Suspense>
  );
}
