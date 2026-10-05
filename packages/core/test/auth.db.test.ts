// Integration tests against a real Postgres (DATABASE_URL). Uses an isolated throwaway tenant.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, tenants, userRoles, users } from "@khaneyeidea/db";
import { getSessionUser, OTP, requestOtp, revokeSession, verifyOtp, type AuthDeps } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const sent: { phone: string; code: string }[] = [];
let deps: AuthDeps;
let tenantId: string;
const lastCode = () => sent[sent.length - 1]!.code;

beforeAll(async () => {
  const db = getDb();
  const [t] = await db.insert(tenants).values({ slug: `test-${Date.now()}`, name: "test" }).returning();
  tenantId = t!.id;
  deps = { db, tenantId, secret: "test-secret", sender: { send: async (phone, code) => void sent.push({ phone, code }) } };
});
afterAll(async () => {
  await getDb().delete(tenants).where(eq(tenants.id, tenantId));
  await closeDb();
});

describe("OTP login", () => {
  it("rejects invalid phones without sending", async () => {
    const r = await requestOtp(deps, "12345", "1.1.1.1");
    expect(r).toEqual({ ok: false, reason: "invalid_phone" });
    expect(sent).toHaveLength(0);
  });

  it("logs in a new number as a parent and creates a working session", async () => {
    const r = await requestOtp(deps, "0912 000 0001", "1.1.1.1");
    expect(r.ok).toBe(true);
    expect(sent[0]!.phone).toBe("989120000001");
    expect(lastCode()).toMatch(/^\d{4}$/);

    const v = await verifyOtp(deps, "09120000001", lastCode());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.isNewUser).toBe(true);

    const u = await getSessionUser(deps.db, v.token);
    expect(u?.phone).toBe("989120000001");
    expect(u?.roles).toEqual([{ role: "parent", branchId: null }]);

    // a code can only be used once
    expect((await verifyOtp(deps, "09120000001", lastCode())).ok).toBe(false);

    await revokeSession(deps.db, v.token);
    expect(await getSessionUser(deps.db, v.token)).toBeNull();
  });

  it("never grants staff roles at login", async () => {
    await requestOtp(deps, "09120000002", null);
    const v = await verifyOtp(deps, "09120000002", lastCode());
    if (!v.ok) throw new Error("expected ok");
    const roles = await deps.db.select().from(userRoles).where(eq(userRoles.userId, v.userId));
    expect(roles.map((r) => r.role)).toEqual(["parent"]);
  });

  it("locks the code after too many wrong attempts", async () => {
    await requestOtp(deps, "09120000003", null);
    const good = lastCode();
    const wrong = good === "00000" ? "11111" : "00000";
    for (let i = 0; i < OTP.maxAttempts; i++) {
      expect(await verifyOtp(deps, "09120000003", wrong)).toEqual({ ok: false, reason: "invalid_code" });
    }
    expect(await verifyOtp(deps, "09120000003", good)).toEqual({ ok: false, reason: "too_many_attempts" });
  });

  it("expires codes", async () => {
    const past = new Date(Date.now() - OTP.ttlMs - 1000);
    await requestOtp({ ...deps, now: () => past }, "09120000004", null);
    expect(await verifyOtp(deps, "09120000004", lastCode())).toEqual({ ok: false, reason: "expired" });
  });

  it("rate limits per phone", async () => {
    for (let i = 0; i < OTP.perPhoneMax; i++) expect((await requestOtp(deps, "09120000005", null)).ok).toBe(true);
    expect(await requestOtp(deps, "09120000005", null)).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("blocks deactivated users", async () => {
    await requestOtp(deps, "09120000006", null);
    const v = await verifyOtp(deps, "09120000006", lastCode());
    if (!v.ok) throw new Error("expected ok");
    await deps.db.update(users).set({ active: false }).where(eq(users.id, v.userId));
    expect(await getSessionUser(deps.db, v.token)).toBeNull();
  });

  it("uses the fixed development code when configured", async () => {
    await requestOtp({ ...deps, fixedCode: "1234" }, "09120000007", null);
    expect(lastCode()).toBe("1234");
    expect((await verifyOtp(deps, "09120000007", "1234")).ok).toBe(true);
  });

  it("keeps a session alive while it is used (sliding expiry)", async () => {
    await requestOtp(deps, "09120000008", null);
    const v = await verifyOtp(deps, "09120000008", lastCode());
    if (!v.ok) throw new Error("expected ok");
    // 170 days later: still valid, and the expiry moves another 180 days ahead
    const later = new Date(Date.now() + 170 * 86_400_000);
    expect(await getSessionUser(deps.db, v.token, later)).not.toBeNull();
    const muchLater = new Date(later.getTime() + 170 * 86_400_000);
    expect(await getSessionUser(deps.db, v.token, muchLater)).not.toBeNull();
    // unused for longer than the window: expired
    expect(await getSessionUser(deps.db, v.token, new Date(muchLater.getTime() + 181 * 86_400_000))).toBeNull();
  });
});
