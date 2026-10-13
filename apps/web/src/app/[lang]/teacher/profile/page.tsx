import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { getDb, messengerAccounts } from "@khaneyeidea/db";
import { getDict, href, isLocale, pick, type Locale } from "@/lib/i18n";
import { logoutAction } from "@/app/[lang]/login/actions";
import { loadCoach, initialsOf } from "@/components/teacher/context";
import { TeacherShell } from "@/components/teacher/shell";
import { TeacherPwa } from "@/components/teacher/pwa";
import { ConnectCard } from "@/components/ops/connect-card";
import { ProfileForm } from "../profile-form";

async function Profile({ lang, saved }: { lang: Locale; saved: boolean }) {
  const { user, profile, o, t } = await loadCoach(lang);
  if (!profile) {
    return (
      <TeacherShell lang={lang} t={t} active="profile">
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{t.profile.noLink}</p>
      </TeacherShell>
    );
  }
  const linked = (await getDb().select({ channel: messengerAccounts.channel }).from(messengerAccounts).where(eq(messengerAccounts.userId, user.userId))).map((l) => l.channel as "bale" | "telegram");
  const name = pick(profile.name, lang);
  return (
    <TeacherShell lang={lang} t={t} active="profile">
      <div className="flex items-center gap-4">
        {profile.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photo} alt="" className="size-20 rounded-full object-cover ring-2 ring-line" />
        ) : (
          <span className="grid size-20 shrink-0 place-items-center rounded-full bg-accent/20 font-display text-2xl font-extrabold text-accent-text">{initialsOf(name)}</span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-[1.7rem] font-extrabold leading-tight tracking-tight">{name}</h1>
          {profile.role && <p className="mt-0.5 text-sm text-muted">{pick(profile.role, lang)}</p>}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <TeacherPwa t={t.push} />
        <ConnectCard o={o} linked={linked} />
        <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold">{t.profile.title}</h2>
          <ProfileForm lang={lang} photo={profile.photo ?? ""} meetingUrl={profile.meetingUrl ?? ""} passwordHref={href(lang, "/teacher/password")} saved={saved} t={t.profile} />
        </section>
        <form action={logoutAction}>
          <input type="hidden" name="lang" value={lang} />
          <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line text-sm font-medium text-muted transition hover:border-ink/30 hover:text-ink active:scale-[0.99]">
            <SignOut weight="bold" className="size-4 rtl:-scale-x-100" />
            {getDict(lang).panel.logout}
          </button>
        </form>
      </div>
    </TeacherShell>
  );
}

export default function Page({ params, searchParams }: PageProps<"/[lang]/teacher/profile">) {
  return (
    <Suspense>
      {Promise.all([params, searchParams]).then(([{ lang }, sp]) => (isLocale(lang) ? <Profile lang={lang} saved={sp.saved === "1"} /> : notFound()))}
    </Suspense>
  );
}
