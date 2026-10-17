"use client";

import { useEffect, useLayoutEffect } from "react";

const valid = (t: string | null | undefined): t is "light" | "dark" => t === "light" || t === "dark";
const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * Keeps the chosen theme across language switches. Moving between /fa and /en swaps the whole <html> element, and
 * the inline script that sets data-theme only runs on a full page load, so the new page came up light. This runs
 * before the first paint of the new page and puts the saved (or system) theme back. It also plays the fade-in that
 * the language switch asks for (sessionStorage "lang-fade") and follows the system theme while nothing is saved.
 */
export function ThemeSync({ lang }: { lang: string }) {
  useLayoutEffect(() => {
    const d = document.documentElement;
    if (!valid(d.dataset.theme)) {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("theme");
      } catch {}
      d.dataset.theme = valid(saved) ? saved : systemDark() ? "dark" : "light";
    }
    // The dimming that the language switch started stays on <body> (it is the same element): end it as the new page arrives.
    for (const a of document.getAnimations()) if (a.id === "lang-fade-out") a.cancel();
    try {
      if (sessionStorage.getItem("lang-fade")) {
        sessionStorage.removeItem("lang-fade");
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
          document.body.animate(
            [{ opacity: 0.6 }, { opacity: 1 }],
            { duration: 320, easing: "ease-out" },
          );
        }
      }
    } catch {}
  }, [lang]);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => {
      try {
        if (valid(localStorage.getItem("theme"))) return;
      } catch {}
      document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return null;
}
