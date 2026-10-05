"use client";

import { useState } from "react";
import { FA_MONTHS, fromJalali, jalaliMonthDays, toJalali } from "@/lib/jalali";
import { inputCls } from "./fields";

/** Jalali day / month / year pickers that post a Gregorian "YYYY-MM-DD" in a hidden input. */
export function JalaliDateInput({ name, value, label, emptyLabel, years }: { name: string; value?: string | null; label: string; emptyLabel?: string; years: number[] }) {
  const init = value ? toJalali(value) : null;
  const [y, setY] = useState<number | null>(init?.y ?? null);
  const [m, setM] = useState<number | null>(init?.m ?? null);
  const [d, setD] = useState<number | null>(init?.d ?? null);
  const days = y && m ? jalaliMonthDays(y, m) : 31;
  const iso = y && m && d ? fromJalali(y, m, Math.min(d, days)) : "";
  const sel = `${inputCls} appearance-none px-3`;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={iso} />
      <div className="grid grid-cols-[4.5rem_1fr_5.5rem] gap-2" dir="rtl">
        <select aria-label="روز" value={d ?? ""} onChange={(e) => setD(e.target.value ? Number(e.target.value) : null)} className={sel}>
          <option value="">-</option>
          {Array.from({ length: days }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n.toLocaleString("fa-IR")}
            </option>
          ))}
        </select>
        <select aria-label="ماه" value={m ?? ""} onChange={(e) => setM(e.target.value ? Number(e.target.value) : null)} className={sel}>
          <option value="">{emptyLabel ?? "-"}</option>
          {FA_MONTHS.map((n, i) => (
            <option key={n} value={i + 1}>
              {n}
            </option>
          ))}
        </select>
        <select aria-label="سال" value={y ?? ""} onChange={(e) => setY(e.target.value ? Number(e.target.value) : null)} className={sel}>
          <option value="">-</option>
          {years.map((n) => (
            <option key={n} value={n}>
              {n.toLocaleString("fa-IR", { useGrouping: false })}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
