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
    auth: {
      title: "ورود به خانه ایده",
      subtitle: "والدین، مربی‌ها و همکاران با شماره‌ی موبایل وارد می‌شوند.",
      phone: "شماره‌ی موبایل",
      phoneHint: "کد ورود به همین شماره فرستاده می‌شود.",
      send: "دریافت کد",
      code: "کد ورود",
      codeHint: "کد ۵ رقمی ارسال‌شده به {phone}",
      verify: "ورود",
      change: "تغییر شماره",
      resendIn: "ارسال دوباره تا {s} ثانیه",
      resend: "ارسال دوباره‌ی کد",
      errors: {
        invalid_phone: "شماره‌ی موبایل معتبر نیست. مثل ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید.",
        rate_limited: "درخواست‌ها زیاد بود. چند دقیقه‌ی دیگر دوباره تلاش کنید.",
        invalid_code: "کد درست نیست.",
        expired: "کد منقضی شده است. کد جدید بگیرید.",
        too_many_attempts: "تعداد تلاش‌ها زیاد بود. کد جدید بگیرید.",
        unknown: "مشکلی پیش آمد. دوباره تلاش کنید.",
      },
      privacy: "با ورود، اطلاعات شما فقط برای ارائه‌ی خدمات آموزشگاه استفاده می‌شود.",
    },
    catalog: {
      filterDept: "حوزه",
      filterAge: "سن فرزند",
      filterMode: "شکل برگزاری",
      all: "همه",
      anyAge: "همه‌ی سن‌ها",
      years: "سال",
      ageValue: "{n} ساله",
      found: "{n} دوره",
      empty: "دوره‌ای با این انتخاب‌ها پیدا نشد.",
      reset: "پاک کردن فیلترها",
    },
    course: {
      back: "همه‌ی دوره‌ها",
      age: "سن",
      sessions: "جلسات",
      sessionsValue: "{n} جلسه",
      duration: "مدت",
      weeksValue: "{n} هفته",
      mode: "شکل برگزاری",
      price: "شهریه",
      priceContact: "برای شهریه تماس بگیرید",
      level: "سطح",
      prerequisites: "پیش‌نیاز",
      syllabus: "در این دوره چه می‌سازند",
      branches: "کجا برگزار می‌شود",
      onlineEverywhere: "آنلاین، از هر جای ایران",
      related: "دوره‌های دیگر همین حوزه",
      call: "سؤال دارید؟ تماس بگیرید",
      about: "درباره‌ی دوره",
    },
    modes: { in_person: "حضوری", online: "آنلاین", hybrid: "ترکیبی" },
    toman: "تومان",
    achievementsPage: {
      scope: { all: "همه", world: "جهانی", asia: "آسیا", national: "کشوری" },
      rank: { "1": "مقام اول", "2": "مقام دوم", "3": "مقام سوم", gold: "مدال طلا", silver: "مدال نقره", bronze: "مدال برنز" } as Record<string, string>,
      count: "{n} افتخار",
      empty: "موردی با این فیلتر نیست.",
      untranslated: "",
      noYear: "بدون سال",
      countries: "کشور میزبان",
    },
    panel: { welcome: "خوش آمدید", logout: "خروج", roles: "نقش‌های شما", soon: "این بخش در حال ساخت است." },
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
    auth: {
      title: "Sign in to Idea House",
      subtitle: "Parents, coaches and staff sign in with their mobile number.",
      phone: "Mobile number",
      phoneHint: "We will text a sign-in code to this number.",
      send: "Get code",
      code: "Sign-in code",
      codeHint: "The 5-digit code sent to {phone}",
      verify: "Sign in",
      change: "Change number",
      resendIn: "Resend in {s}s",
      resend: "Resend code",
      errors: {
        invalid_phone: "That is not a valid Iranian mobile number, e.g. 09121234567.",
        rate_limited: "Too many requests. Please try again in a few minutes.",
        invalid_code: "That code is not correct.",
        expired: "The code has expired. Get a new one.",
        too_many_attempts: "Too many attempts. Get a new code.",
        unknown: "Something went wrong. Please try again.",
      },
      privacy: "Your details are only used to provide the academy's services.",
    },
    catalog: {
      filterDept: "Area",
      filterAge: "Child's age",
      filterMode: "Format",
      all: "All",
      anyAge: "Any age",
      years: "yrs",
      ageValue: "{n} years old",
      found: "{n} courses",
      empty: "No course matches these choices.",
      reset: "Clear filters",
    },
    course: {
      back: "All courses",
      age: "Age",
      sessions: "Sessions",
      sessionsValue: "{n} sessions",
      duration: "Duration",
      weeksValue: "{n} weeks",
      mode: "Format",
      price: "Fee",
      priceContact: "Contact us for the fee",
      level: "Level",
      prerequisites: "Prerequisites",
      syllabus: "What they build",
      branches: "Where it runs",
      onlineEverywhere: "Online, from anywhere in Iran",
      related: "More in this area",
      call: "Questions? Call us",
      about: "About the course",
    },
    modes: { in_person: "In person", online: "Online", hybrid: "Hybrid" },
    toman: "toman",
    achievementsPage: {
      scope: { all: "All", world: "World", asia: "Asia", national: "National" },
      rank: { "1": "1st place", "2": "2nd place", "3": "3rd place", gold: "Gold medal", silver: "Silver medal", bronze: "Bronze medal" } as Record<string, string>,
      count: "{n} achievements",
      empty: "Nothing matches this filter.",
      untranslated: "Titles that are not translated yet are shown in Persian.",
      noYear: "Undated",
      countries: "host countries",
    },
    panel: { welcome: "Welcome", logout: "Sign out", roles: "Your roles", soon: "This area is being built." },
  },
} as const;

export type Dict = (typeof dict)["fa"];
export const getDict = (l: Locale): Dict => dict[l] as Dict;
