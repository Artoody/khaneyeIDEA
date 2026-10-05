"use client";

import { useEffect, useRef, useState } from "react";

/** Pick a day from the next few weeks as chips (weekday + Jalali date); posts the Gregorian "YYYY-MM-DD". */
export function DayPicker({ name, days, value, label }: { name: string; days: { iso: string; weekday: string; label: string }[]; value?: string; label: string }) {
  const [v, setV] = useState(value && days.some((d) => d.iso === value) ? value : (days[0]?.iso ?? ""));
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el && box.current) box.current.scrollLeft += el.getBoundingClientRect().left - box.current.getBoundingClientRect().left - 8;
  }, []);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={v} />
      <div ref={box} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label={label}>
        {days.map((d) => (
          <button
            key={d.iso}
            data-iso={d.iso}
            type="button"
            role="radio"
            aria-checked={v === d.iso}
            onClick={() => setV(d.iso)}
            className="flex w-16 shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl border border-line px-2 py-2.5 text-center text-xs transition hover:border-ink/30 aria-checked:border-ink aria-checked:bg-ink aria-checked:text-bg"
          >
            <span className="opacity-70">{d.weekday}</span>
            <span className="text-sm font-semibold">{d.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
