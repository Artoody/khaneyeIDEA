import { eq } from "drizzle-orm";
import { getDb, redirects, tenants } from "@khaneyeidea/db";

// Old-site URL -> new URL map, read by the proxy. Kept in memory and refreshed every minute so a normal
// page request never waits on the database; only paths outside the app's own routes are looked up.
const TTL_MS = 60_000;
let cache: { at: number; map: Map<string, { to: string; permanent: boolean }> } | null = null;
let loading: Promise<void> | null = null;

const norm = (p: string) => {
  let s = p;
  try {
    s = decodeURIComponent(p);
  } catch {}
  return s.normalize("NFC").replace(/\/+$/, "") || "/";
};

async function load() {
  const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";
  const rows = await getDb()
    .select({ from: redirects.fromPath, to: redirects.toPath, permanent: redirects.permanent })
    .from(redirects)
    .innerJoin(tenants, eq(tenants.id, redirects.tenantId))
    .where(eq(tenants.slug, slug));
  cache = { at: Date.now(), map: new Map(rows.map((r) => [norm(r.from), { to: r.to, permanent: r.permanent }])) };
}

export async function findLegacyRedirect(pathname: string) {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    loading ??= load().finally(() => (loading = null));
    // First request waits; later refreshes serve the previous map while loading.
    if (!cache) await loading.catch(() => {});
  }
  return cache?.map.get(norm(pathname)) ?? null;
}
