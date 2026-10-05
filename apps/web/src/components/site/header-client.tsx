"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List, Moon, Sun, X } from "@phosphor-icons/react";

export function ThemeToggle({ label }: { label: string }) {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink active:scale-95"
    >
      <Sun weight="bold" className="size-[18px] [[data-theme=light]_&]:hidden" />
      <Moon weight="bold" className="size-[18px] [[data-theme=dark]_&]:hidden" />
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
