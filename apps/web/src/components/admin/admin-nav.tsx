"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Buildings,
  ChalkboardTeacher,
  GearSix,
  GraduationCap,
  House,
  List,
  SquaresFour,
  TextAa,
  Trophy,
  X,
  ArrowSquareOut,
} from "@phosphor-icons/react";

const ICONS = {
  dashboard: SquaresFour,
  settings: GearSix,
  pages: TextAa,
  branches: Buildings,
  departments: House,
  courses: GraduationCap,
  teachers: ChalkboardTeacher,
  achievements: Trophy,
} as const;

export type NavItem = { key: keyof typeof ICONS; href: string; label: string };

// The active-link highlight reads the URL, which is request data: keep it behind Suspense so the
// panel frame still prerenders, and show the same links without a highlight until it resolves.
function Links(props: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <Suspense fallback={<LinkList {...props} path="" />}>
      <ActiveLinks {...props} />
    </Suspense>
  );
}

function ActiveLinks(props: { items: NavItem[]; onNavigate?: () => void }) {
  return <LinkList {...props} path={usePathname()} />;
}

function LinkList({ items, onNavigate, path }: { items: NavItem[]; onNavigate?: () => void; path: string }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((it) => {
        const Ico = ICONS[it.key];
        const active = it.key === "dashboard" ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
        return (
          <li key={it.key}>
            <Link
              href={it.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] text-muted transition hover:bg-ink/5 hover:text-ink aria-[current=page]:bg-accent/15 aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              <Ico weight={active ? "fill" : "regular"} className={`size-5 ${active ? "text-accent-text" : ""}`} />
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminNav({ items, siteHref, siteLabel, menuLabel }: { items: NavItem[]; siteHref: string; siteLabel: string; menuLabel: string }) {
  const [open, setOpen] = useState(false);
  const site = (
    <a href={siteHref} target="_blank" rel="noopener" className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted transition hover:bg-ink/5 hover:text-ink">
      <ArrowSquareOut className="size-5" />
      {siteLabel}
    </a>
  );
  return (
    <>
      <nav className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 flex-col justify-between overflow-y-auto border-e border-line p-3 lg:flex">
        <Links items={items} />
        {site}
      </nav>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={menuLabel}
        className="fixed bottom-4 end-4 z-40 grid size-14 place-items-center rounded-full bg-ink text-bg shadow-lg lg:hidden"
      >
        <List weight="bold" className="size-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg p-4 lg:hidden">
          <div className="flex justify-end">
            <button type="button" onClick={() => setOpen(false)} aria-label="close" className="grid size-10 place-items-center rounded-full hover:bg-ink/5">
              <X weight="bold" className="size-5" />
            </button>
          </div>
          <div className="mt-4 flex flex-1 flex-col justify-between">
            <Links items={items} onNavigate={() => setOpen(false)} />
            {site}
          </div>
        </div>
      )}
    </>
  );
}
