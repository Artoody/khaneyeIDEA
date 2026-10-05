"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { List, X } from "@phosphor-icons/react";

export function ThemeToggle({ label }: { label: string }) {
  const mask = useId();
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const html = document.documentElement;
    const next = html.dataset.theme === "dark" ? "light" : "dark";
    const apply = () => {
      html.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {}
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    // The new theme grows as a circle from the button.
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc.startViewTransition(apply).ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="theme-toggle grid size-10 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink active:scale-90"
    >
      <svg viewBox="0 0 24 24" className="theme-icon size-[19px]" aria-hidden>
        <mask id={mask}>
          <rect width="24" height="24" fill="white" />
          <circle className="cut" cx="25" cy="-1" r="6" fill="black" />
        </mask>
        <circle className="core" cx="12" cy="12" r="5" fill="currentColor" mask={`url(#${mask})`} />
        <g className="rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${a} 12 12)`} />
          ))}
        </g>
      </svg>
    </button>
  );
}

/** Adds a solid backdrop once the page scrolls. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = document.getElementById("top-sentinel");
    if (!sentinel) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e?.isIntersecting));
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);
  return (
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-40 border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-300 data-[scrolled=true]:border-line data-[scrolled=true]:bg-bg/80 data-[scrolled=true]:backdrop-blur-xl"
    >
      {children}
    </header>
  );
}

export function MobileMenu({
  links,
  labels,
  extra,
}: {
  links: { href: string; label: string }[];
  labels: { menu: string; close: string };
  extra: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={labels.menu}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-ink/5 active:scale-95"
      >
        <List weight="bold" className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg px-4 pb-8 pt-4">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label={labels.close}
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-full hover:bg-ink/5"
            >
              <X weight="bold" className="size-5" />
            </button>
          </div>
          <nav className="mt-6 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-4 font-display text-2xl font-bold text-ink transition hover:bg-ink/5"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">{extra}</div>
        </div>
      )}
    </div>
  );
}
