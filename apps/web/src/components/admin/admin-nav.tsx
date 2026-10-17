"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";
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
  SidebarSimple,
  NotePencil,
  CalendarBlank,
  ChatCircleDots,
  Handshake,
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
  reviews: ChatCircleDots,
  partners: Handshake,
  sessions: CalendarDots,
  reports: NotePencil,
  classes: Chalkboard,
  terms: CalendarBlank,
  students: Student,
  staff: UsersThree,
  rooms: Door,
  bookings: CalendarCheck,
  calendar: CalendarDots,
  templates: Clock,
  closures: CalendarX,
  types: ListChecks,
} as const;

export type NavItem = { key: keyof typeof ICONS; href: string; label: string; group?: string; badge?: number };

// The active-link highlight reads the URL, which is request data: keep it behind Suspense so the
// panel frame still prerenders, and show the same links without a highlight until it resolves.
function Links(props: { items: NavItem[]; onNavigate?: () => void; collapsed?: boolean }) {
  return (
    <Suspense fallback={<LinkList {...props} path="" />}>
      <ActiveLinks {...props} />
    </Suspense>
  );
}

function ActiveLinks(props: { items: NavItem[]; onNavigate?: () => void; collapsed?: boolean }) {
  return <LinkList {...props} path={usePathname()} />;
}

function LinkList({ items, onNavigate, path, collapsed }: { items: NavItem[]; onNavigate?: () => void; path: string; collapsed?: boolean }) {
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
            {heading && (
              <>
                <p className={`px-3 pb-1.5 pt-5 text-xs font-semibold text-muted first:pt-1 ${collapsed ? "hidden" : ""}`}>{heading}</p>
                {i > 0 && collapsed && <span className="mx-3 my-2 block border-t border-line" aria-hidden />}
              </>
            )}
            <Link
              href={it.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={it.label}
              className={`group relative flex h-12 items-center gap-3 rounded-xl px-2 text-[15px] text-muted transition hover:bg-ink/5 hover:text-ink aria-[current=page]:bg-accent/12 aria-[current=page]:font-medium aria-[current=page]:text-ink ${collapsed ? "justify-center" : ""}`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-accent text-on-accent" : "bg-ink/5 text-muted group-hover:text-ink"}`}
              >
                <Ico weight={active ? "fill" : "regular"} className="size-[18px]" />
              </span>
              <span className={`min-w-0 flex-1 truncate ${collapsed ? "hidden" : ""}`}>{it.label}</span>
              {!!it.badge && (
                <span
                  className={`grid place-items-center rounded-full bg-accent font-bold tabular-nums text-on-accent ${
                    collapsed
                      ? "absolute end-1 top-1 h-3 min-w-3 p-0 text-[0px]"
                      : "h-5 min-w-5 px-1.5 text-[11px]"
                  }`}
                  aria-label={String(it.badge)}
                >
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

const PRIMARY: NavItem["key"][] = ["dashboard", "sessions", "classes", "students", "settings"];

function BottomBar({ items, onMore, menuLabel }: { items: NavItem[]; onMore: () => void; menuLabel: string }) {
  const path = usePathname();
  const tabs = PRIMARY.map((k) => items.find((i) => i.key === k)).filter((x): x is NavItem => !!x).slice(0, 4);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="main" data-testid="bottom-nav">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((it) => {
          const Ico = ICONS[it.key];
          const active = it.key === "dashboard" ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
          return (
            <li key={it.key}>
              <Link href={it.href} aria-current={active ? "page" : undefined} className="relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted transition aria-[current=page]:text-ink">
                <span className={`grid h-7 w-12 place-items-center rounded-full transition ${active ? "bg-accent/20 text-accent-text" : ""}`}>
                  <Ico weight={active ? "fill" : "regular"} className="size-5" />
                </span>
                <span className="max-w-full truncate px-1">{it.label}</span>
                {!!it.badge && <span className="absolute end-[22%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">{it.badge > 9 ? "9+" : it.badge.toLocaleString("fa-IR")}</span>}
              </Link>
            </li>
          );
        })}
        <li className={tabs.length < 4 ? "col-start-5" : ""}>
          <button type="button" onClick={onMore} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] text-muted">
            <span className="grid h-7 w-12 place-items-center rounded-full">
              <List weight="bold" className="size-5" />
            </span>
            {menuLabel}
          </button>
        </li>
      </ul>
    </nav>
  );
}

const watchNavAttr = (cb: () => void) => {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-admin-nav"] });
  return () => o.disconnect();
};

export function AdminNav({
  items,
  siteHref,
  siteLabel,
  menuLabel,
  collapseLabel,
  expandLabel,
}: {
  items: NavItem[];
  siteHref: string;
  siteLabel: string;
  menuLabel: string;
  collapseLabel: string;
  expandLabel: string;
}) {
  const [open, setOpen] = useState(false);
  // The collapsed state lives on <html data-admin-nav> (an inline script restores it before first paint).
  const collapsed = useSyncExternalStore(watchNavAttr, () => document.documentElement.dataset.adminNav === "collapsed", () => false);

  const toggle = () => {
    const next = !collapsed;
    const html = document.documentElement;
    if (next) html.dataset.adminNav = "collapsed";
    else delete html.dataset.adminNav;
    try {
      localStorage.setItem("admin-nav", next ? "collapsed" : "open");
    } catch {}
  };

  const railLabel = collapsed ? expandLabel : collapseLabel;
  const site = (
    <a
      href={siteHref}
      target="_blank"
      rel="noopener"
      title={siteLabel}
      className={`flex h-11 items-center gap-3 rounded-xl text-sm text-muted transition hover:bg-ink/5 hover:text-ink ${collapsed ? "justify-center px-0" : "px-3"}`}
    >
      <ArrowSquareOut className="size-5 shrink-0" />
      <span className={collapsed ? "hidden" : ""}>{siteLabel}</span>
    </a>
  );

  return (
    <>
      <nav
        className={`sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col overflow-hidden border-e border-line transition-[width] duration-200 lg:flex ${collapsed ? "w-[4.75rem]" : "w-64"}`}
        data-testid="admin-sidebar"
        data-collapsed={collapsed ? "1" : undefined}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 pe-1.5">
          <Links items={items} collapsed={collapsed} />
        </div>
        <div className={`flex shrink-0 flex-col gap-1 border-t border-line bg-bg p-3 ${collapsed ? "items-stretch" : ""}`}>
          {site}
          <button
            type="button"
            onClick={toggle}
            aria-label={railLabel}
            aria-pressed={collapsed}
            title={railLabel}
            data-testid="collapse-nav"
            className={`flex h-11 items-center gap-3 rounded-xl text-sm text-muted transition hover:bg-ink/5 hover:text-ink ${collapsed ? "justify-center px-0" : "px-3"}`}
          >
            <SidebarSimple className="size-5 shrink-0" weight={collapsed ? "fill" : "regular"} />
            <span className={collapsed ? "hidden" : ""}>{railLabel}</span>
          </button>
        </div>
      </nav>
      <Suspense fallback={null}>
        <BottomBar items={items} onMore={() => setOpen(true)} menuLabel={menuLabel} />
      </Suspense>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg p-4 lg:hidden">
          <div className="flex justify-end">
            <button type="button" onClick={() => setOpen(false)} aria-label="close" className="grid size-10 place-items-center rounded-full hover:bg-ink/5">
              <X weight="bold" className="size-5" />
            </button>
          </div>
          <div className="mt-4 flex flex-1 flex-col justify-between overflow-y-auto">
            <Links items={items} onNavigate={() => setOpen(false)} />
            {site}
          </div>
        </div>
      )}
    </>
  );
}
