import { describe, expect, it } from "vitest";
import { addDays, generateSlots, isFixedHoliday, tehranDay, templateFits, weekdaySat0, zonedToUtc, type TemplateLike } from "../src";

const tpl = (over: Partial<TemplateLike> = {}): TemplateLike => ({
  id: "t1",
  weekdays: [0, 2, 4], // Sat, Mon, Wed
  startTime: "16:00:00",
  endTime: "19:00:00",
  slotMinutes: 45,
  capacity: 4,
  minLeadHours: 3,
  maxDaysAhead: 14,
  validFrom: null,
  validUntil: null,
  ...over,
});

describe("Tehran calendar helpers", () => {
  it("converts Tehran wall time to UTC (+03:30, no DST)", () => {
    expect(zonedToUtc("2026-10-05", "16:00").toISOString()).toBe("2026-10-05T12:30:00.000Z");
    expect(zonedToUtc("2026-06-20", "09:15").toISOString()).toBe("2026-06-20T05:45:00.000Z");
  });
  it("finds the Tehran day of an instant across midnight", () => {
    expect(tehranDay(new Date("2026-10-05T20:29:00Z"))).toBe("2026-10-05");
    expect(tehranDay(new Date("2026-10-05T20:31:00Z"))).toBe("2026-10-06");
  });
  it("uses the Iranian week (0 = Saturday)", () => {
    expect(weekdaySat0("2026-10-03")).toBe(0); // Saturday
    expect(weekdaySat0("2026-10-09")).toBe(6); // Friday
  });
  it("adds days across months", () => expect(addDays("2026-02-27", 3)).toBe("2026-03-02"));
  it("knows fixed solar holidays", () => {
    expect(isFixedHoliday("2026-03-21")).toBe(true); // 1 Farvardin 1405
    expect(isFixedHoliday("2026-04-02")).toBe(true); // 13 Farvardin
    expect(isFixedHoliday("2026-10-05")).toBe(false);
  });
});

describe("generateSlots", () => {
  const now = new Date("2026-10-03T05:30:00Z"); // Sat 09:00 Tehran

  it("cuts the window into slots that fit before the end time", () => {
    const sat = generateSlots(tpl(), { now }).filter((s) => s.day === "2026-10-03");
    expect(sat.map((s) => s.time)).toEqual(["16:00", "16:45", "17:30", "18:15"]); // 18:15 + 45 ends exactly at 19:00
    expect(generateSlots(tpl({ endTime: "18:59:00" }), { now }).filter((s) => s.day === "2026-10-03")).toHaveLength(3);
    expect(sat[0]!.endsAt.getTime() - sat[0]!.startsAt.getTime()).toBe(45 * 60_000);
  });
  it("only offers the template's weekdays within maxDaysAhead", () => {
    const days = new Set(generateSlots(tpl({ maxDaysAhead: 6 }), { now }).map((s) => s.day));
    expect([...days]).toEqual(["2026-10-03", "2026-10-05", "2026-10-07"]);
  });
  it("respects the lead time", () => {
    const late = new Date("2026-10-03T13:00:00Z"); // 16:30 Tehran, lead 3h -> nothing today
    expect(generateSlots(tpl(), { now: late }).some((s) => s.day === "2026-10-03")).toBe(false);
    const lead1 = generateSlots(tpl({ minLeadHours: 0 }), { now: late }).filter((s) => s.day === "2026-10-03");
    expect(lead1.map((s) => s.time)).toEqual(["16:45", "17:30", "18:15"]);
  });
  it("skips closed days, holidays and days outside the valid range", () => {
    const closed = generateSlots(tpl(), { now, closedDays: new Set(["2026-10-05"]) });
    expect(closed.some((s) => s.day === "2026-10-05")).toBe(false);
    const ranged = generateSlots(tpl({ validFrom: "2026-10-05", validUntil: "2026-10-07" }), { now });
    expect([...new Set(ranged.map((s) => s.day))]).toEqual(["2026-10-05", "2026-10-07"]);
    const nowruz = generateSlots(tpl({ weekdays: [0, 1, 2, 3, 4, 5, 6] }), { now: new Date("2026-03-19T05:30:00Z") });
    expect(nowruz.some((s) => s.day === "2026-03-21")).toBe(false);
    expect(nowruz.some((s) => s.day === "2026-03-20")).toBe(false); // 29 Esfand
    expect(nowruz.some((s) => s.day === "2026-03-19")).toBe(true);
  });
  it("subtracts booked seats", () => {
    const first = zonedToUtc("2026-10-03", "16:00").getTime();
    const s = generateSlots(tpl(), { now, booked: new Map([[first, 3]]) })[0]!;
    expect(s.remaining).toBe(1);
  });
  it("returns nothing for a broken window", () => expect(generateSlots(tpl({ endTime: "15:00:00" }), { now })).toEqual([]));
});

describe("templateFits", () => {
  const t = { ageMin: 7, ageMax: 9, courseId: null, departmentId: "robotics", branchId: "b1" };
  it("matches age range and department", () => {
    expect(templateFits(t, { age: 8, departmentId: "robotics" })).toBe(true);
    expect(templateFits(t, { age: 10 })).toBe(false);
    expect(templateFits(t, { departmentId: "python" })).toBe(false);
  });
  it("open fields mean any", () => expect(templateFits({ ...t, ageMin: null, ageMax: null, departmentId: null }, { age: 15, departmentId: "x" })).toBe(true));
  it("filters by branch only when asked", () => {
    expect(templateFits(t, { branchId: "b2" })).toBe(false);
    expect(templateFits(t, {})).toBe(true);
  });
});
