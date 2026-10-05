import { describe, expect, it } from "vitest";
import { can, homeFor, normalizeIranMobile, type Principal } from "../src";

describe("normalizeIranMobile", () => {
  it.each([
    ["09121234567", "989121234567"],
    ["9121234567", "989121234567"],
    ["+989121234567", "989121234567"],
    ["00989121234567", "989121234567"],
    ["0912-123 4567", "989121234567"],
    ["۰۹۱۲۱۲۳۴۵۶۷", "989121234567"],
  ])("%s -> %s", (input, out) => expect(normalizeIranMobile(input)).toBe(out));

  it.each(["", "02112345678", "0912123456", "091212345678", "abc", "+14155550123"])("rejects %s", (input) =>
    expect(normalizeIranMobile(input)).toBeNull(),
  );
});

describe("permissions", () => {
  const p = (roles: Principal["roles"]): Principal => ({ userId: "u", tenantId: "t", roles });

  it("denies anonymous users", () => expect(can(null, "content.edit")).toBe(false));

  it("parents only see their own children", () => {
    const parent = p([{ role: "parent", branchId: null }]);
    expect(can(parent, "children.view_own")).toBe(true);
    expect(can(parent, "content.edit")).toBe(false);
    expect(can(parent, "schedule.view_all")).toBe(false);
  });

  it("teachers cannot manage schedule or content", () => {
    const teacher = p([{ role: "teacher", branchId: null }]);
    expect(can(teacher, "session.report_own")).toBe(true);
    expect(can(teacher, "schedule.manage")).toBe(false);
    expect(can(teacher, "users.manage")).toBe(false);
  });

  it("branch-scoped admins only act in their branch", () => {
    const admin = p([{ role: "admin", branchId: "b1" }]);
    expect(can(admin, "schedule.manage", { branchId: "b1" })).toBe(true);
    expect(can(admin, "schedule.manage", { branchId: "b2" })).toBe(false);
    expect(can(admin, "schedule.manage")).toBe(false);
  });

  it("only owners manage users", () => {
    expect(can(p([{ role: "admin", branchId: null }]), "users.manage")).toBe(false);
    expect(can(p([{ role: "owner", branchId: null }]), "users.manage")).toBe(true);
  });

  it("routes users home by their strongest role", () => {
    expect(homeFor(p([{ role: "parent", branchId: null }, { role: "teacher", branchId: null }]))).toBe("/app/teacher");
    expect(homeFor(p([{ role: "content_manager", branchId: null }]))).toBe("/app/admin");
  });
});
