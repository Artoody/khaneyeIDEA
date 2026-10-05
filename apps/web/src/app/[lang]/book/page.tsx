import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Phone } from "@phosphor-icons/react/dist/ssr";
import { appointmentTypes, availabilityTemplates, courses, getDb } from "@khaneyeidea/db";
import { getDict, href, isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getBranches, getCatalog, getSettings, tenantId } from "@/server/content";
import { getUser } from "@/server/auth";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/home-sections";
import { BookingFlow, type BookBranch, type BookType } from "@/components/site/booking/booking-flow";

export async function generateMetadata({ params }: PageProps<"/[lang]/book">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const s = await getSettings();
  const t = getDict(lang).book;
  return { title: `${t.title} | ${pick(s.name, lang)}`, description: t.subtitle, alternates: { canonical: href(lang, "/book") } };
}

/** Types with at least one active template; the rest would only lead to an empty calendar. */
async function bookableTypes(lang: Locale): Promise<BookType[]> {
  const rows = await getDb()
    .selectDistinct({ ty: appointmentTypes })
    .from(appointmentTypes)
    .innerJoin(availabilityTemplates, and(eq(availabilityTemplates.appointmentTypeId, appointmentTypes.id), eq(availabilityTemplates.active, true)))
    .where(and(eq(appointmentTypes.tenantId, await tenantId()), eq(appointmentTypes.active, true)));
  return rows
    .map((r) => r.ty)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ty) => ({ id: ty.id, kind: ty.kind, place: ty.place, title: pick(ty.title, lang), description: pick(ty.description, lang) }));
}

async function Flow({ lang, courseSlug, src }: { lang: Locale; courseSlug: string | null; src: string | null }) {
  const t = getDict(lang);
  const [types, catalog, branches, settings, user] = await Promise.all([bookableTypes(lang), getCatalog(), getBranches(), getSettings(), getUser()]);

  if (types.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
        <p className="text-lg">{t.book.callInstead}</p>
        <ul className="mt-5 flex flex-col gap-3">
          {settings.phones.map((p) => (
            <li key={p.number}>
              <a href={`tel:${p.number}`} className="inline-flex items-center gap-3 font-display text-2xl font-extrabold transition hover:text-accent-text">
                <Phone weight="duotone" className="size-6 text-accent-text" />
                <span dir="ltr" className="tabular-nums">{num(p.number, lang)}</span>
                <span className="text-sm font-normal text-muted">{pick(p.label, lang)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  let course = null;
  if (courseSlug) {
    const [c] = await getDb()
      .select()
      .from(courses)
      .where(and(eq(courses.tenantId, await tenantId()), eq(courses.slug, courseSlug), eq(courses.status, "published")));
    if (c) course = { id: c.id, title: pick(c.title, lang), departmentId: c.departmentId, ageMin: c.ageMin };
  }
  const used = new Set(catalog.courses.map((c) => c.departmentId));
  const departments = catalog.departments.filter((d) => used.has(d.id)).map((d) => ({ id: d.id, title: pick(d.title, lang), icon: d.icon }));
  const branchMap: Record<string, BookBranch> = Object.fromEntries(
    branches.map((b) => [b.id, { id: b.id, name: pick(b.district, lang) || pick(b.name, lang), address: pick(b.address, lang) }]),
  );
  return (
    <BookingFlow
      lang={lang}
      labels={t.book}
      types={types}
      departments={departments}
      branches={branchMap}
      course={course}
      signedInPhone={user?.phone ?? null}
      source={src}
      siteName={pick(settings.name, lang)}
    />
  );
}

function FlowSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      <div className="h-56 rounded-[var(--radius-card)] bg-ink/5" />
      <div className="h-16 rounded-[var(--radius-card)] bg-ink/5" />
    </div>
  );
}

export default async function BookPage({ params, searchParams }: PageProps<"/[lang]/book">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang).book;
  return (
    <>
      <SiteHeader lang={lang} />
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <header className="pb-8 pt-10 sm:pt-14">
          <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mt-3 text-lg text-muted">{t.subtitle}</p>
        </header>
        <Suspense fallback={<FlowSkeleton />}>
          {searchParams.then(({ course, src }) => (
            <Flow lang={lang} courseSlug={typeof course === "string" ? course.slice(0, 80) : null} src={typeof src === "string" ? src.slice(0, 20) : null} />
          ))}
        </Suspense>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
