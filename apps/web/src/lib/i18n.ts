import type { Localized } from "@khaneyeidea/db/schema";

export const LOCALES = ["fa", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fa";

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);
export const dirOf = (l: Locale) => (l === "fa" ? "rtl" : "ltr");

/** Persian is served without a prefix (/courses), English under /en (/en/courses). */
export function href(l: Locale, path = "/") {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (l === "fa") return p;
  return p === "/" ? "/en" : `/en${p}`;
}

/** Pick the localized string; falls back to Persian when the English text is still empty. */
export function pick(v: Localized | null | undefined, l: Locale): string {
  if (!v) return "";
  return (l === "en" ? v.en || v.fa : v.fa || v.en) ?? "";
}

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
export function num(n: number | string, l: Locale): string {
  const s = typeof n === "number" ? n.toLocaleString("en-US") : n;
  return l === "fa" ? s.replace(/\d/g, (d) => faDigits[Number(d)]!).replace(/,/g, "٬") : s;
}

// Interface chrome only. Business content (courses, contacts, page copy...) comes from the database.
const dict = {
  fa: {
    nav: { courses: "دوره‌ها", achievements: "افتخارات", projects: "پروژه‌ها", branches: "شعبه‌ها", contact: "تماس" },
    login: "ورود",
    menu: "منو",
    close: "بستن",
    switchLang: "English",
    theme: { light: "روشن", dark: "تیره", toggle: "تغییر تم" },
    hero: { secondary: "مشاهده‌ی دوره‌ها" },
    proof: {
      title: "سابقه‌ای که روی سکوی جهانی ساخته شده",
      worldFirsts: "مقام اول و طلای جهانی",
      recorded: "افتخار ثبت‌شده",
      years: "سال تجربه",
      branches: "شعبه در تهران",
    },
    departments: { title: "هفت مسیر برای ساختن", courses: "دوره", explore: "دیدن دوره‌ها" },
    branches: { title: "نزدیک شما، در چهار نقطه‌ی تهران", appointment: "مراجعه با هماهنگی" },
    portal: { cta: "ورود والدین" },
    footer: { rights: "همه‌ی حقوق محفوظ است.", follow: "ما را دنبال کنید", call: "تماس" },
  },
  en: {
    nav: { courses: "Courses", achievements: "Achievements", projects: "Projects", branches: "Branches", contact: "Contact" },
    login: "Sign in",
    menu: "Menu",
    close: "Close",
    switchLang: "فارسی",
    theme: { light: "Light", dark: "Dark", toggle: "Toggle theme" },
    hero: { secondary: "Explore courses" },
    proof: {
      title: "A track record built on world stages",
      worldFirsts: "world titles and golds",
      recorded: "recorded achievements",
      years: "years of teaching",
      branches: "branches in Tehran",
    },
    departments: { title: "Seven ways to build", courses: "courses", explore: "See courses" },
    branches: { title: "Close to you, across Tehran", appointment: "By appointment" },
    portal: { cta: "Parent sign in" },
    footer: { rights: "All rights reserved.", follow: "Follow us", call: "Call" },
  },
} as const;

export type Dict = (typeof dict)["fa"];
export const getDict = (l: Locale): Dict => dict[l] as Dict;
