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
  CalendarCheck,
  CalendarX,
  Clock,
  ListChecks,
  Newspaper,
  CalendarDots,
  Chalkboard,
  Student,
  UsersThree,
  Door,
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
  posts: Newspaper,
  sessions: CalendarDots,
  classes: Chalkboard,
  students: Student,
  staff: UsersThree,
  rooms: Door,
  bookings: CalendarCheck,
  templates: Clock,
  closures: CalendarX,
  types: ListChecks,
} as const;

export type NavItem = { key: keyof typeof ICONS; href: string; label: string; group?: string; badge?: number };

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
      {items.map((it, i) => {
        const Ico = ICONS[it.key];
        // The longest matching href wins, so /booking/templates does not also light up /booking.
        const best = items.filter((x) => path === x.href || path.startsWith(`${x.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
        const active = it.key === "dashboard" ? path === it.href : best?.key === it.key;
        const heading = it.group && it.group !== items[i - 1]?.group ? it.group : null;
        return (
          <li key={it.key}>
            {heading && <p className="px-3 pb-1.5 pt-5 text-xs font-semibold text-muted first:pt-1">{heading}</p>}
            <Link
              href={it.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className="group flex h-12 items-center gap-3 rounded-xl px-2 text-[15px] text-muted transition hover:bg-ink/5 hover:text-ink aria-[current=page]:bg-accent/12 aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-accent text-on-accent" : "bg-ink/5 text-muted group-hover:text-ink"}`}
              >
                <Ico weight={active ? "fill" : "regular"} className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {!!it.badge && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold tabular-nums text-on-accent" aria-label={String(it.badge)}>
                  {it.badge > 99 ? "99+" : it.badge.toLocaleString("fa-IR")}
                </span>
              )}
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
