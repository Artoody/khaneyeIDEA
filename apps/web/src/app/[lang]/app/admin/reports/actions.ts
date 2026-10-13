"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, scheduledAnnouncements, siteSettings } from "@khaneyeidea/db";
import { decideReport } from "@khaneyeidea/core";
import { href, isLocale } from "@/lib/i18n";
import { requirePermission } from "@/server/auth";
import { audit, bool, int } from "@/server/admin";

export async function decideReportAction(form: FormData) {
  const user = await requirePermission("schedule.manage");
  const sessionId = String(form.get("sessionId") ?? "");
  const action = form.get("action") === "reject" ? "reject" : "approve";
  const lang = String(form.get("lang") ?? "fa");
  const decision = await decideReport(getDb(), { sessionId, adminUserId: user.userId, action, text: String(form.get("text") ?? "") });
  if (decision.ok && action === "approve" && decision.text) {
    await getDb().insert(scheduledAnnouncements).values({
      tenantId: decision.tenantId,
      sessionId,
      text: decision.text,
      sendAt: new Date(),
      targets: { group: true, parents: false, kind: "report" },
      status: "scheduled",
      approvedByUserId: user.userId,
    });
  }
  await audit(user.tenantId, user.userId, "update", "session_report", sessionId, { action });
  redirect(href(isLocale(lang) ? lang : "fa", "/app/admin/reports"));
}

export async function saveReportSettings(form: FormData) {
  const user = await requirePermission("schedule.manage");
  const hour = (name: string) => {
    const n = int(form, name);
    return n !== null && n >= 0 && n <= 23 ? n : 21;
  };
  await getDb()
    .update(siteSettings)
    .set({
      reportApprovalRequired: bool(form, "reportApprovalRequired"),
      eveNoticeHour: hour("eveNoticeHour"),
      eodReportDeadlineHour: hour("eodReportDeadlineHour"),
    })
    .where(eq(siteSettings.tenantId, user.tenantId));
  const lang = String(form.get("lang") ?? "fa");
  redirect(href(isLocale(lang) ? lang : "fa", "/app/admin/reports"));
}
