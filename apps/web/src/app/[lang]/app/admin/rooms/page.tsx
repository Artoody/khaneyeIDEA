import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Door, Trash } from "@phosphor-icons/react/dist/ssr";
import { branches, getDb, rooms } from "@khaneyeidea/db";
import { isLocale, num, pick, type Locale } from "@/lib/i18n";
import { getOpsDict } from "@/lib/ops-i18n";
import { requirePermissionPage } from "@/server/auth";
import { ListSkeleton, PageHeader } from "@/components/admin/ui";
import { addRoom, removeRoom } from "./actions";

async function Rooms({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const o = getOpsDict(lang);
  const db = getDb();
  const [bs, rs] = await Promise.all([
    db.select().from(branches).where(eq(branches.tenantId, user.tenantId)).orderBy(asc(branches.sortOrder)),
    db.select().from(rooms).where(eq(rooms.tenantId, user.tenantId)).orderBy(asc(rooms.name)),
  ]);
  return (
    <>
      <PageHeader title={o.rooms.title} description={o.rooms.help} />
      {bs.length === 0 ? (
        <p className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-line p-6 text-muted">{o.rooms.noBranches}</p>
      ) : (
        <div className="grid max-w-5xl gap-4 md:grid-cols-2">
          {bs.map((b) => {
            const mine = rs.filter((r) => r.branchId === b.id);
            return (
              <section key={b.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="branch-rooms">
                <h2 className="font-display text-lg font-bold">{pick(b.name, lang)}</h2>
                {mine.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{o.rooms.empty}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {mine.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 py-2.5">
                        <Door weight="duotone" className="size-5 shrink-0 text-accent-text" />
                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                        {r.capacity && <span className="text-xs text-muted">{num(r.capacity, lang)}</span>}
                        <form action={removeRoom}>
                          <input type="hidden" name="id" value={r.id} />
                          <button aria-label={o.rooms.remove} className="grid size-8 place-items-center rounded-full text-muted hover:bg-red-500/10 hover:text-red-500">
                            <Trash className="size-4" />
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={addRoom} className="mt-4 flex gap-2">
                  <input type="hidden" name="branchId" value={b.id} />
                  <input name="name" required placeholder={o.rooms.name} aria-label={o.rooms.name} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15" />
                  <input name="capacity" inputMode="numeric" dir="ltr" placeholder={o.rooms.capacity} aria-label={o.rooms.capacity} className="h-10 w-20 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15" />
                  <button className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-bg">{o.rooms.add}</button>
                </form>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app/admin/rooms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Rooms lang={lang} />
    </Suspense>
  );
}
