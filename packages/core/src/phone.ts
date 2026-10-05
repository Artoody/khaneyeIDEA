const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Converts Persian/Arabic digits to ASCII. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = FA_DIGITS.indexOf(d);
    return String(i >= 0 ? i : AR_DIGITS.indexOf(d));
  });
}

/**
 * Normalizes an Iranian mobile number to E.164 without "+": 98 9xx xxx xxxx.
 * Accepts 0912..., 912..., +98912..., 0098912..., with spaces, dashes and Persian digits.
 * Returns null for anything that is not a valid Iranian mobile.
 */
export function normalizeIranMobile(input: string): string | null {
  let d = toAsciiDigits(input).replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0098")) d = d.slice(4);
  else if (d.startsWith("98")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  if (!/^9\d{9}$/.test(d)) return null;
  return `98${d}`;
}

/** 989121234567 -> 0912 123 4567 (display form). */
export function formatIranMobile(e164: string): string {
  const local = `0${e164.slice(2)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
