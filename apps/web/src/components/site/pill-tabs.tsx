"use client";

import { motion, useReducedMotion } from "motion/react";

export type PillItem<T extends string> = { value: T; label: React.ReactNode };

/**
 * Pill tabs whose selected background glides between options (shared layout animation).
 * `group` must be unique per tab set on the page.
 */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  group,
  label,
  size = "md",
  tone = "ink",
  className = "",
}: {
  items: PillItem<T>[];
  value: T | null;
  onChange: (v: T) => void;
  group: string;
  label: string;
  size?: "sm" | "md";
  tone?: "ink" | "accent";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const h = size === "sm" ? "h-8 px-3.5" : "h-10 px-4";
  const on = tone === "accent" ? "text-on-accent font-medium" : "text-bg";
  const bg = tone === "accent" ? "bg-accent" : "bg-ink";
  return (
    <div role="group" aria-label={label} className={`flex gap-1.5 ${className}`}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(it.value)}
            className={`relative inline-flex shrink-0 items-center gap-2 rounded-full text-sm transition-colors duration-200 active:scale-[0.97] ${h} ${active ? on : "text-muted hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={`pill-${group}`}
                className={`absolute inset-0 -z-10 rounded-full ${bg}`}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            {!active && <span className="absolute inset-0 -z-20 rounded-full border border-line" aria-hidden />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
