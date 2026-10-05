import Link from "next/link";
import {
  ArrowUpLeft,
  Browser,
  Code,
  Cpu,
  Cube,
  GameController,
  InstagramLogo,
  Lightbulb,
  MapPin,
  Phone,
  Robot,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { DeptIconKey } from "@/lib/dept-icons";
import type { Localized } from "@khaneyeidea/db/schema";
import { getDict, href, num, pick, type Locale } from "@/lib/i18n";
import {
  getBlocks,
  getBranches,
  getDepartmentsWithCounts,
  getFeaturedAchievements,
  getSettings,
  getStats,
} from "@/server/content";
import { HeroCanvas } from "./hero-canvas";
import { LogoMark } from "./logo-mark";

const DEPT_ICON: Record<DeptIconKey, Icon> & Record<string, Icon | undefined> = {
  robot: Robot,
  code: Code,
  browser: Browser,
  cpu: Cpu,
  cube: Cube,
  lightbulb: Lightbulb,
  "game-controller": GameController,
};

export async function Hero({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const blocks = await getBlocks();
  return (
    <section className="relative overflow-hidden">
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-4 px-4 pb-16 pt-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pb-24 lg:pt-0">
        <div className="relative order-1 aspect-[5/4] w-full [mask-image:radial-gradient(ellipse_closest-side_at_center,black_74%,transparent)] lg:order-2 lg:aspect-square">
          <HeroCanvas label={pick(blocks["home.hero.title"], lang)} />
        </div>
        <div className="order-2 max-w-xl lg:order-1">
          <h1 className="font-display text-[2.6rem] font-black leading-[1.15] tracking-tight text-balance sm:text-6xl lg:text-[4.2rem]">
            {pick(blocks["home.hero.title"], lang)}
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted sm:text-xl">
            {pick(blocks["home.hero.subtitle"], lang)}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={href(lang, "/book")}
              className="inline-flex h-13 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-on-accent shadow-[0_10px_30px_-10px_rgb(255_179_71/0.6)] transition hover:bg-accent-strong active:scale-[0.98]"
            >
              {pick(blocks["home.hero.cta"], lang)}
            </Link>
            <Link
              href={href(lang, "/courses")}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-full px-5 text-base font-medium text-ink transition hover:bg-ink/5"
            >
              {t.hero.secondary}
              <ArrowUpLeft weight="bold" className="size-4 ltr:-scale-x-100" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export async function Proof({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const [stats, featured] = await Promise.all([getStats(), getFeaturedAchievements(14)]);
  const items: { value: string; label: string }[] = [
    { value: num(stats.worldFirsts, lang), label: t.proof.worldFirsts },
    { value: num(stats.achievements, lang), label: t.proof.recorded },
    ...(stats.yearsActive ? [{ value: `${num(stats.yearsActive, lang)}+`, label: t.proof.years }] : []),
    { value: num(stats.branches, lang), label: t.proof.branches },
  ];
  // English shows only achievements that already have an English title (no mixed-language strip).
  const shown = lang === "en" ? featured.filter((a) => a.title.en) : featured;
  const label = (a: (typeof featured)[number]) => pick(a.title, lang);
  return (
    <section id="achievements" className="scroll-mt-20 border-y border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <h2 className="max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {t.proof.title}
        </h2>
        <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.label} className="flex flex-col-reverse border-s-2 border-accent ps-5">
              <dt className="mt-2 text-sm text-muted sm:text-base">{it.label}</dt>
              <dd className="font-display text-5xl font-black tracking-tight sm:text-6xl">{it.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {shown.length > 0 && (
      <div className="marquee relative overflow-hidden border-t border-line py-5 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="marquee-track flex w-max gap-3">
          {[...shown, ...shown].map((a, i) => (
            <span
              key={`${a.id}-${i}`}
              aria-hidden={i >= shown.length}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-bg px-4 py-2 text-sm text-ink"
            >
              <span className="size-1.5 rounded-full bg-accent" />
              {label(a)}
            </span>
          ))}
        </div>
      </div>
      )}
    </section>
  );
}

// Circuit motif for department tiles: a few PCB traces that echo the logo.
function Traces({ seed, strong }: { seed: number; strong?: boolean }) {
  const ys = [28, 52, 76].map((y) => y + ((seed * 7) % 11));
  return (
    <svg aria-hidden viewBox="0 0 200 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      {ys.map((y, i) => (
        <g key={i} stroke="var(--accent)" strokeOpacity={strong ? 0.35 : 0.16} strokeWidth="0.8" fill="none">
          <path d={`M${-10} ${y} H${60 + i * 22 + (seed % 5) * 6} l${10} ${-10} H${210}`} vectorEffect="non-scaling-stroke" />
          <circle cx={60 + i * 22 + (seed % 5) * 6} cy={y} r="1.6" fill="var(--accent)" fillOpacity={strong ? 0.6 : 0.3} stroke="none" />
        </g>
      ))}
    </svg>
  );
}

export async function Departments({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const depts = await getDepartmentsWithCounts();
  // 7 tiles: 7/5, 4/4/4, 7/5 on a 12 column grid (exact cell count, no empty tiles)
  const spans = ["lg:col-span-7", "lg:col-span-5", "lg:col-span-4", "lg:col-span-4", "lg:col-span-4", "lg:col-span-7", "lg:col-span-5"];
  return (
    <section id="courses" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">{t.departments.title}</h2>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
          {depts.map((d, i) => {
            const Ico = DEPT_ICON[d.icon ?? ""] ?? Lightbulb;
            const hero = i === 0 || i === 5;
            return (
              <article
                key={d.id}
                className={`group relative flex min-h-56 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line p-6 transition duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-accent/50 sm:p-7 ${spans[i] ?? "lg:col-span-4"} ${hero ? "bg-elevated" : "bg-surface"}`}
              >
                <Traces seed={i + 3} strong={hero} />
                {hero && <div className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-accent/15 blur-3xl" />}
                <div className="relative flex items-start justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent-text">
                    <Ico weight="duotone" className="size-6" />
                  </span>
                  <span className="rounded-full border border-line bg-bg/60 px-3 py-1 text-xs text-muted">
                    {num(d.courseCount, lang)} {t.departments.courses}
                  </span>
                </div>
                <h3 className="relative mt-auto pt-10 font-display text-2xl font-extrabold tracking-tight">{pick(d.title, lang)}</h3>
                {d.courses.length > 0 && (
                  <ul className="relative mt-3 flex flex-wrap gap-2">
                    {d.courses.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={href(lang, `/courses/${c.slug}`)}
                          className="inline-flex rounded-full bg-ink/5 px-3 py-1 text-sm text-ink transition hover:bg-accent hover:text-on-accent"
                        >
                          {pick(c.title as Localized, lang)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export async function Portal({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const blocks = await getBlocks();
  return (
    <section className="relative overflow-hidden border-y border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{pick(blocks["home.portal.title"], lang)}</h2>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-muted">{pick(blocks["home.portal.body"], lang)}</p>
        </div>
        <Link
          href={href(lang, "/login")}
          className="inline-flex h-13 shrink-0 items-center justify-center rounded-full border border-ink/15 px-7 text-base font-semibold transition hover:border-accent hover:text-accent-text active:scale-[0.98]"
        >
          {t.portal.cta}
        </Link>
      </div>
    </section>
  );
}

export async function Branches({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const branches = await getBranches();
  return (
    <section id="branches" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <h2 className="max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-5xl">{t.branches.title}</h2>
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {branches.map((b) => (
            <article key={b.id} className="flex flex-col bg-surface p-6 sm:p-7">
              <MapPin weight="duotone" className="size-7 text-accent-text" />
              <h3 className="mt-8 font-display text-2xl font-extrabold">{pick(b.district, lang) || pick(b.name, lang)}</h3>
              <p className="mt-1 text-sm font-medium text-ink/80">{pick(b.name, lang)}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{pick(b.address, lang)}</p>
              {b.appointmentOnly && (
                <span className="mt-5 inline-flex w-fit rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-text">
                  {t.branches.appointment}
                </span>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const SOCIAL_ICON = { instagram: InstagramLogo, whatsapp: WhatsappLogo } as Record<string, Icon>;

export async function SiteFooter({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  const [s, branches] = await Promise.all([getSettings(), getBranches()]);
  const socials = s.socials.filter((x) => x.enabled && x.url);
  return (
    <footer id="contact" className="scroll-mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-auto" />
            <span className="font-display text-xl font-extrabold">{pick(s.name, lang)}</span>
          </div>
          <p className="mt-4 max-w-sm text-muted">{pick(s.tagline, lang)}</p>
          {socials.length > 0 && (
            <div className="mt-6 flex gap-2" aria-label={t.footer.follow}>
              {socials.map((x) => {
                const Ico = SOCIAL_ICON[x.kind] ?? InstagramLogo;
                return (
                  <a
                    key={x.kind}
                    href={x.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={x.kind}
                    className="grid size-11 place-items-center rounded-full border border-line text-ink transition hover:border-accent hover:text-accent-text"
                  >
                    <Ico weight="duotone" className="size-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted">{t.footer.call}</h3>
          <ul className="mt-4 space-y-3">
            {s.phones.map((p) => (
              <li key={p.number}>
                <a href={`tel:${p.number}`} className="group inline-flex items-center gap-3 transition hover:text-accent-text">
                  <Phone weight="duotone" className="size-5 text-accent-text" />
                  <span dir="ltr" className="font-medium tabular-nums">{num(p.number, lang)}</span>
                  <span className="text-sm text-muted">{pick(p.label, lang)}</span>
                </a>
              </li>
            ))}
            {s.email && (
              <li>
                <a href={`mailto:${s.email}`} className="text-muted transition hover:text-accent-text" dir="ltr">
                  {s.email}
                </a>
              </li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted">{t.nav.branches}</h3>
          <ul className="mt-4 space-y-3">
            {branches.map((b) => (
              <li key={b.id} className="text-ink/90">
                {pick(b.name, lang)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted sm:px-6">
          {pick(s.name, lang)}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
