"use client";

import type { Localized } from "@khaneyeidea/db/schema";
import type { AdminDict } from "@/lib/admin-i18n";
import { MULTILINE_BLOCKS, PAGE_BLOCK_GROUPS, PAGE_BLOCK_KEYS } from "@/lib/page-blocks";
import { savePageBlocks } from "@/app/[lang]/app/admin/pages/actions";
import { AdminForm, LocalizedInput } from "./fields";
import { errorText } from "./errors";

export function PagesForm({ blocks, a }: { blocks: Record<string, Localized>; a: AdminDict }) {
  const titles = { home: a.pages.groupHome, portal: a.pages.groupPortal, courses: a.pages.groupCourses, achievements: a.pages.groupAchievements };
  const groups = PAGE_BLOCK_GROUPS.map((g) => ({ title: titles[g.id], keys: PAGE_BLOCK_KEYS.filter((k) => k.startsWith(g.prefix)) }));
  return (
    <AdminForm action={savePageBlocks} labels={{ save: a.common.save, saved: a.common.saved, error: a.common.error }}>
      {(s) => (
        <>
          {groups.map((g) => (
            <section key={g.title} className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold">{g.title}</h2>
              {g.keys.map((k) => (
                <LocalizedInput key={k} label={a.pages[k] ?? k} name={k} value={blocks[k]} required multiline={MULTILINE_BLOCKS.has(k)} error={errorText(s.fieldErrors?.[k], a)} />
              ))}
            </section>
          ))}
        </>
      )}
    </AdminForm>
  );
}
