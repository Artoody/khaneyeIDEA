"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";
import { fill } from "@/lib/format";
import { enrollStudents } from "@/app/[lang]/app/admin/classes/actions";

/** Search the academy's students, tick the ones to add, add them all at once. */
export function RosterPicker({ classGroupId, students, seatsLeft, o }: { classGroupId: string; students: { id: string; name: string; age: string | null }[]; seatsLeft: number; o: OpsDict }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const list = useMemo(() => {
    const needle = q.trim();
    return needle ? students.filter((s) => s.name.includes(needle)) : students;
  }, [q, students]);
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <form action={enrollStudents} className="mt-4 rounded-2xl border border-line bg-bg p-3" data-testid="picker">
      <input type="hidden" name="classGroupId" value={classGroupId} />
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="studentId" value={id} />
      ))}
      <label className="relative block">
        <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={o.students.search}
          aria-label={o.students.search}
          className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>
      <ul className="mt-2 max-h-56 overflow-y-auto">
        {list.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-ink/5">
              <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {s.age && <span className="shrink-0 text-xs text-muted">{s.age}</span>}
            </label>
          </li>
        ))}
        {list.length === 0 && <li className="px-2 py-3 text-sm text-muted">{o.students.empty}</li>}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{picked.size > seatsLeft ? o.classes.full : fill(o.classes.seatsLeft, { n: Math.max(0, seatsLeft).toLocaleString("fa-IR") })}</span>
        <button disabled={picked.size === 0} className="h-10 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-bg transition active:scale-[0.98] disabled:opacity-40">
          {o.classes.addStudent}
          {picked.size > 0 && ` (${picked.size.toLocaleString("fa-IR")})`}
        </button>
      </div>
    </form>
  );
}
