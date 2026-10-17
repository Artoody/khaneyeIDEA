"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A thin amber bar at the top while the next page loads, so a slow click never looks like nothing happened.
 * It starts on any click on an internal link to another page and ends when the address changes.
 */
function Bar() {
  const path = usePathname();
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute("download")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      setFrom(location.pathname);
      clearTimeout(timer);
      timer = setTimeout(() => setFrom(null), 15_000); // never leave it running if the navigation fails
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(timer);
    };
  }, []);
  const running = from !== null && from === path;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-accent shadow-[0_0_12px_var(--accent)] rtl:origin-right"
      style={{ opacity: running ? 1 : 0, transform: running ? undefined : "scaleX(1)", animation: running ? "nav-trickle 10s cubic-bezier(0.1, 0.6, 0.2, 1) forwards" : "none", transition: "opacity 0.35s ease 0.05s" }}
    />
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
