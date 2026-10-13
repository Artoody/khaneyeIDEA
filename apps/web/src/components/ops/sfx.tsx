"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { playSfx, setSoundEnabled, soundEnabled, type Sfx } from "@/lib/ui-sound";

const subscribe = (cb: () => void) => {
  window.addEventListener("ui-sound-change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("ui-sound-change", cb);
    window.removeEventListener("storage", cb);
  };
};

/** The speaker button in the panel header. */
export function SoundToggle({ onLabel, offLabel }: { onLabel: string; offLabel: string }) {
  const on = useSyncExternalStore(subscribe, soundEnabled, () => true);
  return (
    <button
      type="button"
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      aria-label={on ? onLabel : offLabel}
      title={on ? onLabel : offLabel}
      data-testid="sound-toggle"
      className="grid size-10 place-items-center rounded-full border border-line text-muted transition hover:border-ink/30 hover:text-ink"
    >
      {on ? <SpeakerHigh className="size-[18px]" /> : <SpeakerSlash className="size-[18px]" />}
    </button>
  );
}

/**
 * One listener for the whole panel: choosing something ticks, opening a drawer pops, a "saved" message chimes and an
 * error message thuds. Elements can also ask for a sound with data-sfx="name".
 */
export function PanelSfx() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      const asked = el.closest<HTMLElement>("[data-sfx]");
      if (asked) {
        playSfx(asked.dataset.sfx as Sfx);
        return;
      }
      if (el.closest("[role=tab],[role=radio],[aria-pressed]:not([data-testid=sound-toggle])") || (el.closest("label") && el.closest("label")?.querySelector("input[type=checkbox]"))) playSfx("tick");
      else if (el.closest("summary")) playSfx("open");
      else if (el.closest("button[type=submit]")) playSfx("pop");
      else if (el.closest("nav a, nav button")) playSfx("tick");
    };
    document.addEventListener("click", onClick, true);

    const seen = new WeakSet<Element>();
    const watch = new MutationObserver((list) => {
      for (const m of list)
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          const hits = [n, ...n.querySelectorAll("[role=status],[role=alert]")].filter((x) => x.matches("[role=status],[role=alert]") && !seen.has(x) && x.textContent?.trim());
          for (const h of hits) {
            seen.add(h);
            playSfx(h.getAttribute("role") === "alert" ? "error" : "success");
          }
        }
    });
    watch.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      watch.disconnect();
    };
  }, []);
  return null;
}
