import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, tenants, userRoles, users } from "@khaneyeidea/db";
import { getSessionUser, hashPassword, loginWithPassword, PASSWORD, setUserPassword, verifyPassword } from "../src";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

describe("password hash", () => {
  it("verifies a matching password and rejects a different one", async () => {
    const stored = await hashPassword("correct-horse");
    expect(await verifyPassword("correct-horse", stored)).toBe(true);
    expect(await verifyPassword("wrong-horse", stored)).toBe(false);
    expect(await verifyPassword("correct-horse", "not-a-hash")).toBe(false);
  });
});

describe("teacher password login", () => {
  const db = getDb();
  let tenantId = "";
  let userId = "";

  beforeAll(async () => {
    const [t] = await db.insert(tenants).values({ slug: `pw-${Date.now()}`, name: "pw" }).returning();
    tenantId = t!.id;
    const [u] = await db.insert(users).values({ tenantId, phone: `989${Date.now().toString().slice(-9)}` }).returning();
    userId = u!.id;
    await db.insert(userRoles).values({ userId, role: "teacher", branchId: null });
  });
  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it("rejects a short password and a bad username", async () => {
    expect((await setUserPassword(db, { tenantId, userId, username: "ab", password: "longenough" })).ok).toBe(false);
    expect((await setUserPassword(db, { tenantId, userId, username: "coach.one", password: "short" })).ok).toBe(false);
  });

  it("signs the teacher in and locks after repeated failures", async () => {
    expect((await setUserPassword(db, { tenantId, userId, username: "coach.one", password: "longenough", mustChange: true })).ok).toBe(true);
    const ok = await loginWithPassword(db, { tenantId, username: "Coach.One", password: "longenough" });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.mustChangePassword).toBe(true);
    expect((await getSessionUser(db, ok.token))?.userId).toBe(userId);

    for (let i = 0; i < PASSWORD.maxFails - 1; i++) {
      const bad = await loginWithPassword(db, { tenantId, username: "coach.one", password: "nope" });
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.reason).toBe("invalid");
    }
    const locked = await loginWithPassword(db, { tenantId, username: "coach.one", password: "nope" });
    const still = await loginWithPassword(db, { tenantId, username: "coach.one", password: "longenough" });
    expect(locked.ok).toBe(false);
    expect(still.ok).toBe(false);
  });

  it("rejects a teacher account on the staff login", async () => {
    await setUserPassword(db, { tenantId, userId, username: "coach.two", password: "longenough", mustChange: false });
    const staff = await loginWithPassword(db, { tenantId, username: "coach.two", password: "longenough", audience: "staff" });
    expect(staff.ok).toBe(false);
    if (!staff.ok) expect(staff.reason).toBe("not_staff");
  });
});

describe("staff password login", () => {
  const db = getDb();
  let tenantId = "";
  let userId = "";

  beforeAll(async () => {
    const [t] = await db.insert(tenants).values({ slug: `staff-pw-${Date.now()}`, name: "staff-pw" }).returning();
    tenantId = t!.id;
    const [u] = await db.insert(users).values({ tenantId, phone: `988${Date.now().toString().slice(-9)}` }).returning();
    userId = u!.id;
    await db.insert(userRoles).values({ userId, role: "owner", branchId: null });
  });
  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await closeDb();
  });

  it("signs an owner in on staff audience and blocks teacher audience", async () => {
    expect((await setUserPassword(db, { tenantId, userId, username: "boss.one", password: "longenough", mustChange: false })).ok).toBe(true);
    const ok = await loginWithPassword(db, { tenantId, username: "boss.one", password: "longenough", audience: "staff" });
    expect(ok.ok).toBe(true);
    const asTeacher = await loginWithPassword(db, { tenantId, username: "boss.one", password: "longenough", audience: "teacher" });
    expect(asTeacher.ok).toBe(false);
    if (!asTeacher.ok) expect(asTeacher.reason).toBe("not_teacher");
  });
});
