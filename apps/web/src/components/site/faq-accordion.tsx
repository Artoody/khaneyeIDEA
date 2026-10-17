"use client";

import { useId, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

export type FaqItem = { id: string; question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const base = useId();
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  if (!items.length) return null;
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((item) => {
        const isOpen = open === item.id;
        const panelId = `${base}-${item.id}`;
        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-base font-semibold transition hover:bg-ink/[0.03] sm:px-6 sm:py-5"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : item.id)}
              >
                <span className="text-balance">{item.question}</span>
                <CaretDown className={`size-5 shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} weight="bold" />
              </button>
            </h3>
            <div id={panelId} role="region" hidden={!isOpen} className="px-5 pb-5 text-sm leading-relaxed text-muted sm:px-6">
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
