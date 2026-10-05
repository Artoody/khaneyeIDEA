"use client";

import { useState } from "react";
import { inputCls } from "@/components/admin/fields";

const pad = (n: number) => String(n).padStart(2, "0");
const fa = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);

/**
 * A 24-hour time picker (hour and minute selects) that posts "HH:MM". Browsers show 12-hour AM/PM for
 * <input type="time"> on some systems, which does not suit Persian screens.
 */
export function TimeSelect({ name, value, label, hourLabel = "ساعت", minuteLabel = "دقیقه" }: { name: string; value?: string | null; label: string; hourLabel?: string; minuteLabel?: string }) {
  const [h0, m0] = (value && /^\d{2}:\d{2}/.test(value) ? value : "17:00").split(":").map(Number) as [number, number];
  const [h, setH] = useState(h0);
  const [m, setM] = useState(m0);
  // keep odd minutes (e.g. 17:10 -> 10 is on the 5-minute grid; 17:07 is not) selectable
  const minutes = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), m])].sort((a, b) => a - b);
  const sel = `${inputCls} appearance-none px-3`;
  return (
    <fieldset data-time={name} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={`${pad(h)}:${pad(m)}`} />
      <div className="grid grid-cols-2 gap-2" dir="ltr">
        <select aria-label={`${label} ${hourLabel}`} value={h} onChange={(e) => setH(Number(e.target.value))} className={sel}>
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>
              {fa(pad(i))}
            </option>
          ))}
        </select>
        <select aria-label={`${label} ${minuteLabel}`} value={m} onChange={(e) => setM(Number(e.target.value))} className={sel}>
          {minutes.map((x) => (
            <option key={x} value={x}>
              {fa(pad(x))}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
