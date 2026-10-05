import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Monitor, Phone } from "@phosphor-icons/react/dist/ssr";
import { getDict, href, isLocale, LOCALES, num, pick } from "@/lib/i18n";
import { ageRange, fill, priceText } from "@/lib/format";
import { getBlocks, getCourse, getPublishedCourseSlugs, getSettings } from "@/server/content";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/home-sections";
import { Reveal } from "@/components/site/reveal";
import { DeptBadge } from "@/components/site/dept-badge";

export async function generateStaticParams() {
  const slugs = await getPublishedCourseSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/courses/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const [data, s] = await Promise.all([getCourse(decodeURIComponent(slug)), getSettings()]);
  if (!data) return {};
  const c = data.course;
  const title = pick(c.seo.title, lang) || pick(c.title, lang);
  return {
    title: `${title} | ${pick(s.name, lang)}`,
    description: pick(c.seo.description, lang) || pick(c.summary, lang) || undefined,
    alternates: {
      canonical: href(lang, `/courses/${c.slug}`),
      languages: Object.fromEntries(LOCALES.map((l) => [l, href(l, `/courses/${c.slug}`)])),
    },
  };
}

export default async function CoursePage({ params }: PageProps<"/[lang]/courses/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const [data, settings, blocks] = await Promise.all([getCourse(decodeURIComponent(slug)), getSettings(), getBlocks()]);
  if (!data) notFound();
  const t = getDict(lang);
  const tc = t.course;
  const { course: c, department, branches, siblings } = data;

  const ages = ageRange(c.ageMin, c.ageMax, lang);
  const price = priceText(c, settings.showPrices, lang, { toman: t.toman, contact: tc.priceContact });
  type Fact = { label: string; value: string };
  const facts = ([
    ages && { label: tc.age, value: `${ages} ${t.catalog.years}` },
    c.sessionsCount && { label: tc.sessions, value: fill(tc.sessionsValue, { n: num(c.sessionsCount, lang) }) },
    c.durationWeeks && { label: tc.duration, value: fill(tc.weeksValue, { n: num(c.durationWeeks, lang) }) },
    c.modes.length > 0 && { label: tc.mode, value: c.modes.map((m) => t.modes[m]).join(lang === "fa" ? "، " : ", ") },
    c.level && { label: tc.level, value: c.level },
  ] as (Fact | false | null | 0 | "")[]).filter((x): x is Fact => !!x);
  const inPerson = c.modes.some((m) => m !== "online");
  const online = c.modes.some((m) => m !== "in_person");
  const phone = settings.phones.find((p) => p.primary) ?? settings.phones[0];
  const bookHref = href(lang, `/book?course=${c.slug}`);
  const body = pick(c.body, lang);
  const prereq = pick(c.prerequisites, lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: pick(c.title, lang),
    description: pick(c.summary, lang) || pick(c.title, lang),
    inLanguage: lang,
    provider: { "@type": "EducationalOrganization", name: pick(settings.name, lang) },
    ...(c.syllabus.length ? { syllabusSections: c.syllabus.map((s) => ({ "@type": "Syllabus", name: pick(s, lang) })) } : {}),
  };

  return (
    <>
      <SiteHeader lang={lang} />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <section className="relative overflow-hidden">
          <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_65%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16 lg:pb-24 lg:pt-12">
            <div>
              <Link href={href(lang, "/courses")} className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
                <ArrowRight className="size-4 ltr:rotate-180" />
                {tc.back}
              </Link>
              {department && (
                <div className="mt-8">
                  <DeptBadge icon={department.icon} label={pick(department.title, lang)} />
                </div>
              )}
              <h1 className="mt-5 font-display text-4xl font-black leading-[1.15] tracking-tight text-balance sm:text-6xl">{pick(c.title, lang)}</h1>
              {pick(c.summary, lang) && <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-muted sm:text-xl">{pick(c.summary, lang)}</p>}
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href={bookHref}
                  className="inline-flex h-13 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-on-accent shadow-[0_10px_30px_-10px_rgb(255_179_71/0.6)] transition hover:bg-accent-strong active:scale-[0.98]"
                >
                  {pick(blocks["home.hero.cta"], lang)}
                </Link>
                {phone && (
                  <a href={`tel:${phone.number}`} className="inline-flex h-13 items-center gap-2 rounded-full px-5 text-base font-medium transition hover:bg-ink/5">
                    <Phone weight="duotone" className="size-5 text-accent-text" />
                    <span dir="ltr" className="tabular-nums">{num(phone.number, lang)}</span>
                  </a>
                )}
              </div>
            </div>

            <Reveal>
              <div className="rounded-[var(--radius-card)] border border-line bg-surface p-2">
                <dl className="grid grid-cols-2 gap-2">
                  {facts.map((f, i) => (
                    <div key={f.label} className={`rounded-[16px] bg-bg p-5 ${facts.length % 2 === 1 && i === facts.length - 1 ? "col-span-2" : ""}`}>
                      <dt className="text-sm text-muted">{f.label}</dt>
                      <dd className="mt-1.5 font-display text-xl font-extrabold tracking-tight">{f.value}</dd>
                    </div>
                  ))}
                  {price && (
                    <div className="col-span-2 flex items-center justify-between gap-4 rounded-[16px] bg-accent/15 p-5">
                      <dt className="text-sm text-ink/70">{tc.price}</dt>
                      <dd className="font-display text-lg font-extrabold tracking-tight">{price}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Reveal>
          </div>
        </section>

        {(body || prereq) && (
          <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
            <Reveal className="max-w-[65ch]">
              <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{tc.about}</h2>
              {body && <p className="mt-5 whitespace-pre-line text-lg leading-loose text-ink/85">{body}</p>}
              {prereq && (
                <p className="mt-6 rounded-2xl border border-line p-5 text-[15px] leading-relaxed">
                  <span className="font-semibold">{tc.prerequisites}: </span>
                  <span className="text-muted">{prereq}</span>
                </p>
              )}
            </Reveal>
          </section>
        )}

        {c.syllabus.length > 0 && (
          <section className="glass border-y border-line">
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{tc.syllabus}</h2>
              <ol className={`mt-12 grid gap-x-12 ${c.syllabus.length > 6 ? "lg:grid-cols-2" : "max-w-2xl"}`}>
                {c.syllabus.map((s, i) => (
                  <li key={i} className="relative flex gap-5 pb-8 last:pb-0">
                    {/* circuit trace between nodes, echoing the logo */}
                    <span aria-hidden className="absolute start-[19px] top-10 bottom-0 w-px bg-accent/30 [li:last-child>&]:hidden" />
                    <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-accent/50 bg-bg font-display text-sm font-extrabold tabular-nums text-accent-text">
                      {num(i + 1, lang)}
                    </span>
                    <p className="pt-2 text-lg leading-relaxed">{pick(s, lang)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {(inPerson || online) && (
          <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{tc.branches}</h2>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {inPerson &&
                branches.map((b) => (
                  <Reveal key={b.id}>
                    <article className="h-full rounded-[var(--radius-card)] border border-line bg-surface/80 p-6">
                      <MapPin weight="duotone" className="size-6 text-accent-text" />
                      <h3 className="mt-6 font-display text-xl font-extrabold">{pick(b.district, lang) || pick(b.name, lang)}</h3>
                      <p className="mt-1 text-sm text-muted">{pick(b.address, lang)}</p>
                      {b.appointmentOnly && (
                        <span className="mt-4 inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-text">{t.branches.appointment}</span>
                      )}
                    </article>
                  </Reveal>
                ))}
              {inPerson && branches.length === 0 && (
                <Reveal>
                  <Link href={href(lang, "/#branches")} className="block h-full rounded-[var(--radius-card)] border border-line bg-surface/80 p-6 transition hover:border-accent/60">
                    <MapPin weight="duotone" className="size-6 text-accent-text" />
                    <h3 className="mt-6 font-display text-xl font-extrabold">{t.modes.in_person}</h3>
                    <p className="mt-1 text-sm text-muted">{tc.inPersonAny}</p>
                  </Link>
                </Reveal>
              )}
              {online && (
                <Reveal>
                  <article className="h-full rounded-[var(--radius-card)] border border-accent/40 bg-accent/10 p-6">
                    <Monitor weight="duotone" className="size-6 text-accent-text" />
                    <h3 className="mt-6 font-display text-xl font-extrabold">{t.modes.online}</h3>
                    <p className="mt-1 text-sm text-muted">{tc.onlineEverywhere}</p>
                  </article>
                </Reveal>
              )}
            </div>
          </section>
        )}

        {siblings.length > 0 && department && (
          <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
            <h2 className="text-sm font-semibold text-muted">{tc.related}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {siblings.map((s) => {
                const r = ageRange(s.ageMin, s.ageMax, lang);
                return (
                  <li key={s.slug}>
                    <Link
                      href={href(lang, `/courses/${s.slug}`)}
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-[15px] transition hover:border-accent hover:text-accent-text"
                    >
                      {pick(s.title, lang)}
                      {r && <span className="text-sm text-muted tabular-nums">{r}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
