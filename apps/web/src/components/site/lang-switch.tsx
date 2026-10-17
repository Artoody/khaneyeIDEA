"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n";

/** Same page in the other language: "/courses" <-> "/en/courses". */
function pathFor(path: string, target: Locale) {
  const bare = path.replace(/^\/en(?=\/|$)/, "") || "/";
  return target === "en" ? `/en${bare === "/" ? "" : bare}` : bare;
}

/** The page fades out as the other language loads; ThemeSync fades the new one in (and keeps the theme). */
function fadeOut(e: React.MouseEvent, same: boolean) {
  if (same || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  try {
    sessionStorage.setItem("lang-fade", "1");
  } catch {}
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = document.body.animate([{ opacity: 1 }, { opacity: 0.15 }], { duration: 220, easing: "ease-out", fill: "forwards" });
  setTimeout(() => a.cancel(), 4000); // if the navigation never happens, the page comes back
}

function Switch({ lang, path }: { lang: Locale; path: string }) {
  return (
    <div className="flex items-center rounded-full border border-line p-0.5 text-xs font-semibold" role="group" aria-label="Language / زبان">
      {(["fa", "en"] as const).map((l) => (
        <Link
          key={l}
          href={pathFor(path, l)}
          hrefLang={l}
          lang={l}
          aria-current={l === lang ? "true" : undefined}
          onClick={(e) => fadeOut(e, l === lang)}
          className="grid h-8 min-w-9 place-items-center rounded-full px-2 tracking-wide text-muted transition hover:text-ink aria-[current=true]:bg-ink aria-[current=true]:text-bg"
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

function Current({ lang }: { lang: Locale }) {
  return <Switch lang={lang} path={usePathname()} />;
}

export function LangSwitch({ lang }: { lang: Locale }) {
  return (
    <Suspense fallback={<Switch lang={lang} path={lang === "en" ? "/en" : "/"} />}>
      <Current lang={lang} />
    </Suspense>
  );
}
