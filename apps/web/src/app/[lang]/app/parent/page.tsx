import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDict, isLocale, type Locale } from "@/lib/i18n";
import { requirePermissionPage } from "@/server/auth";
import { PanelShell, PanelSkeleton } from "@/components/panel/panel-shell";

const TITLE = { fa: "پرتال والدین", en: "Parent portal" } as const;

async function ParentPanel({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "children.view_own");
  const t = getDict(lang);
  return (
    <PanelShell lang={lang} user={user} title={TITLE[lang]}>
      <h1 className="mt-4 font-display text-3xl font-extrabold">{t.panel.welcome}</h1>
      <p className="mt-2 text-muted">{t.panel.soon}</p>
    </PanelShell>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/parent">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <ParentPanel lang={lang} />
    </Suspense>
  );
}
