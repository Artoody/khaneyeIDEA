import { num, type Locale } from "./i18n";

/** Replaces {name} placeholders. */
export const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

export function ageRange(min: number | null, max: number | null, l: Locale): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? num(min, l) : `${num(min, l)}-${num(max, l)}`;
  return min != null ? `${num(min, l)}+` : `≤ ${num(max!, l)}`;
}

/**
 * The fee shown to visitors. Hidden unless prices are enabled site-wide and the course shows its price;
 * "contact" courses (and enabled prices with no amount) get the contact line.
 */
export function priceText(
  c: { price: number | null; priceVisibility: "show" | "hide" | "contact" },
  showPrices: boolean,
  l: Locale,
  labels: { toman: string; contact: string },
): string | null {
  if (c.priceVisibility === "hide") return null;
  if (c.priceVisibility === "show" && showPrices && c.price != null) return `${num(c.price, l)} ${labels.toman}`;
  return labels.contact;
}

/** Persian digits in Persian text; English text is left as is. */
export const localDigits = (text: string, l: Locale) => (l === "fa" ? text.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!) : text);
