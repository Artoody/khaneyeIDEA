import { describe, expect, it } from "vitest";
import { createAiProvider, formatClassReport, polishNote, reportStudentLabel } from "../src";

describe("report polish", () => {
  it("uses the plain text when AI is unavailable", async () => {
    const ai = createAiProvider({ AI_PROVIDER: "none" });
    const out = await polishNote(ai, "ربات ساختیم", ["سارا"], "report");
    expect(out.usedAi).toBe(false);
    expect(out.text).toContain("ربات ساختیم");
  });
});

describe("formatClassReport", () => {
  it("matches the academy card layout", () => {
    const text = formatClassReport({
      startsAt: new Date("2025-10-01T13:30:00+03:30"),
      present: ["آریان ر", "صدرا", "یوسف"],
      absent: ["کیاشا", "رادمهر"],
      activities: "تمرین استفاده ترکیبی از تصویرسازی",
      homework: "به صورت ویس قرار می‌گیرد",
      special: null,
    });
    expect(text).toContain("●تاریخ :");
    expect(text).toContain("●حاضرین :  آریان ر صدرا یوسف");
    expect(text).toContain("●غایبین : کیاشا رادمهر");
    expect(text).toContain("●فعالیت های انجام شده سر کلاس:");
    expect(text).toContain("تمرین استفاده ترکیبی از تصویرسازی");
    expect(text).toContain("●تکلیف هفته آینده :");
    expect(text).toContain("به صورت ویس قرار می‌گیرد");
    expect(text).toContain("●موارد خاص :_");
  });

  it("shortens surnames for the card", () => {
    expect(reportStudentLabel("آریان", "رضایی")).toBe("آریان ر");
    expect(reportStudentLabel("آوا", "تستی")).toBe("آوا");
  });
});
