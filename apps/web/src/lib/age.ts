import { toJalali, tehranIso } from "./jalali";

/** Age from a Persian birth year (approximate: the year only). */
export const ageFromJalaliYear = (birthYear: number | null) => (birthYear ? toJalali(tehranIso(new Date())).y - birthYear : null);
