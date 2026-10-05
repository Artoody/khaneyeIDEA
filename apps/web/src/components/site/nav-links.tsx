"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

export type NavLink = { href: string; label: string; /** page path that marks it active */ page?: string; /** home-page section id */ section: string };

const linkCls = "relative rounded-full px-3.5 py-2 text-[15px] transition-colors";

/** Which home-page section is in the reading zone (middle band of the viewport). */
function useSectionSpy(ids: string[], enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else setActive((cur) => (cur === e.target.id ? null : cur));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids, enabled]);
  return enabled ? active : null;
}

function ActiveLinks({ links }: { links: NavLink[] }) {
  const path = usePathname().replace(/^\/en(?=\/|$)/, "") || "/";
  const reduce = useReducedMotion();
  const onHome = path === "/";
  const [ids] = useState(() => links.map((l) => l.section));
  const section = useSectionSpy(ids, onHome);
  const current = links.find((l) => (onHome ? l.section === section : l.page && (path === l.page || path.startsWith(`${l.page}/`))));
  return (
    <>
      {links.map((l) => {
        const active = current?.href === l.href;
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`${linkCls} ${active ? "text-ink" : "text-muted hover:text-ink"}`}>
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 -z-10 rounded-full bg-ink/[0.06]"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
              >
                <span className="absolute inset-x-0 -bottom-[3px] mx-auto h-[3px] w-4 rounded-full bg-accent" />
              </motion.span>
            )}
            {l.label}
          </Link>
        );
      })}
    </>
  );
}

export function NavLinks({ links }: { links: NavLink[] }) {
  return (
    <nav className="relative isolate hidden items-center gap-1 lg:flex">
      <Suspense
        fallback={links.map((l) => (
          <Link key={l.href} href={l.href} className={`${linkCls} text-muted hover:text-ink`}>
            {l.label}
          </Link>
        ))}
      >
        <ActiveLinks links={links} />
      </Suspense>
    </nav>
  );
}
