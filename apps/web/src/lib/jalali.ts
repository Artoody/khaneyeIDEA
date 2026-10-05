import { getDaysInMonth, newDate } from "date-fns-jalali";
import type { Locale } from "./i18n";

// Calendar days travel as "YYYY-MM-DD" (Gregorian) strings; Persian screens show and pick them in Jalali.

export const FA_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
/** Iranian week, Saturday first (same index as template weekdays). */
export const WEEKDAYS = {
  fa: ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"],
  en: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
};

const noon = (iso: string) => new Date(`${iso}T12:00:00Z`);
const persianParts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });

export function toJalali(iso: string): { y: number; m: number; d: number } {
  const p = Object.fromEntries(persianParts.formatToParts(noon(iso)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

export function fromJalali(y: number, m: number, d: number): string {
  return newDate(y, m - 1, d, 12).toISOString().slice(0, 10);
}

export const jalaliMonthDays = (y: number, m: number) => getDaysInMonth(newDate(y, m - 1, 1, 12));

/** "دوشنبه ۱۳ مهر" / "Mon, Oct 5" */
export function dayLabel(iso: string, l: Locale, opts: { weekday?: boolean; year?: boolean } = { weekday: true }): string {
  return new Intl.DateTimeFormat(l === "fa" ? "fa-IR-u-ca-persian" : "en-GB", {
    timeZone: "UTC",
    weekday: opts.weekday ? (l === "fa" ? "long" : "short") : undefined,
    day: "numeric",
    month: l === "fa" ? "long" : "short",
    year: opts.year ? "numeric" : undefined,
  }).format(noon(iso));
}

/** Time of an instant in Tehran, "۱۶:۴۵" / "16:45". */
export function timeLabel(d: Date | string, l: Locale): string {
  return new Intl.DateTimeFormat(l === "fa" ? "fa-IR" : "en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    typeof d === "string" ? new Date(d) : d,
  );
}

/** Tehran calendar day of an instant. */
export function tehranIso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(d);
}
