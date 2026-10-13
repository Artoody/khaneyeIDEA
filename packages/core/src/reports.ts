import { and, eq } from "drizzle-orm";
import { classSessions, homework, sessionReports, siteSettings, type getDb } from "@khaneyeidea/db";
import { AiUnavailable, scrubNames, type AiProvider } from "@khaneyeidea/ai";
import { recordHeld, type Channel, type Mark, type StudentScores } from "./session-work";

type Db = ReturnType<typeof getDb>;

const REPORT_SYSTEM =
  "تو ویراستار یادداشت معلم یک آموزشگاه رباتیک و برنامه‌نویسی برای نوجوانان هستی. فقط بخش «فعالیت‌های انجام‌شده سر کلاس» را به یک بند کوتاه، روان و حرفه‌ای فارسی بنویس. تیتر، تاریخ، حاضرین، غایبین، تکلیف یا موارد خاص نگذار. اسم هیچ دانش‌آموزی را نیاور. فقط همان بند فعالیت را برگردان.";
const HOMEWORK_SYSTEM =
  "تو ویراستار تکلیف یک آموزشگاه هستی. یادداشت معلم را به یک تکلیف روشن و کوتاه فارسی تبدیل کن. اسم دانش‌آموز نیاور. فقط متن تکلیف را بنویس.";

function plain(_kind: "report" | "homework", raw: string) {
  return raw.trim();
}

const dateFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  day: "numeric",
  month: "long",
});

/** Short name for the group card: first name, plus last initial when useful. */
export function reportStudentLabel(firstName: string, lastName?: string | null) {
  const last = lastName?.trim();
  if (!last || last === "تستی" || last === "(نمونه)") return firstName;
  return `${firstName} ${last.charAt(0)}`;
}

/**
 * Fixed academy report card posted to the class group.
 * Example:
 * ●تاریخ : ۹ مهر
 * ●حاضرین : …
 * ●غایبین : …
 * ●فعالیت های انجام شده سر کلاس:
 * …
 * ●تکلیف هفته آینده :
 * …
 * ●موارد خاص :_
 */
export function formatClassReport(p: {
  startsAt: Date;
  present: string[];
  absent: string[];
  activities: string;
  homework?: string | null;
  special?: string | null;
}) {
  const date = dateFmt.format(p.startsAt);
  const present = p.present.length ? p.present.join(" ") : "—";
  const absent = p.absent.length ? p.absent.join(" ") : "—";
  const activities = p.activities.trim() || "—";
  const homework = p.homework?.trim() || "—";
  const special = p.special?.trim() || "_";
  return [
    `●تاریخ : ${date}`,
    `●حاضرین :  ${present}`,
    `●غایبین : ${absent}`,
    `●فعالیت های انجام شده سر کلاس:`,
    activities,
    ``,
    `●تکلیف هفته آینده :`,
    homework,
    `●موارد خاص :${special === "_" ? "_" : ` ${special}`}`,
  ].join("\n");
}

/** AI polish when the class has it on. Any provider failure returns the plain template. */
export async function polishNote(
  ai: AiProvider,
  raw: string,
  names: string[],
  kind: "report" | "homework",
): Promise<{ text: string; usedAi: boolean }> {
  const body = raw.trim().slice(0, 4000);
  if (!body) return { text: "", usedAi: false };
  const scrubbed = scrubNames(body, names);
  try {
    const out = await ai.generate({ system: kind === "report" ? REPORT_SYSTEM : HOMEWORK_SYSTEM, prompt: scrubbed.text });
    return { text: scrubbed.restore(out.text).trim().slice(0, 4000) || plain(kind, body), usedAi: true };
  } catch (e) {
    if (!(e instanceof AiUnavailable)) console.error("[ai] polish failed", e instanceof Error ? e.message : e);
    return { text: plain(kind, body), usedAi: false };
  }
}

export async function transcribeVoice(ai: AiProvider, audio: Buffer, mime: string): Promise<string | null> {
  if (!ai.transcribe) return null;
  try {
    const out = await ai.transcribe(audio, mime);
    return out.text.trim().slice(0, 4000) || null;
  } catch (e) {
    if (!(e instanceof AiUnavailable)) console.error("[ai] transcribe failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function approvalRequired(db: Db, tenantId: string) {
  const [s] = await db.select({ on: siteSettings.reportApprovalRequired }).from(siteSettings).where(eq(siteSettings.tenantId, tenantId));
  return s?.on ?? false;
}

/**
 * Saves attendance, report and homework, then either leaves the report waiting for an admin
 * or marks it ready to post. The caller posts it (the bot has the messengers).
 */
export async function saveSessionWork(
  db: Db,
  p: {
    tenantId: string;
    sessionId: string;
    userId: string | null;
    channel: Channel;
    marks: Record<string, Mark>;
    summary: string | null;
    homework: string | null;
    scores?: Record<string, StudentScores>;
    rawText?: string | null;
    aiText?: string | null;
    voiceKey?: string | null;
    homeworkVoiceKey?: string | null;
  },
): Promise<"pending" | "publish"> {
  await recordHeld(db, {
    sessionId: p.sessionId,
    userId: p.userId,
    channel: p.channel,
    marks: p.marks,
    summary: p.summary,
    homework: p.homework,
    scores: p.scores,
  });
  if (p.summary) {
    await db
      .update(sessionReports)
      .set({ rawText: p.rawText ?? p.summary, aiText: p.aiText ?? null, finalText: p.summary, voiceKey: p.voiceKey ?? null })
      .where(eq(sessionReports.sessionId, p.sessionId));
  }
  if (p.homework || p.homeworkVoiceKey) {
    await db
      .update(homework)
      .set({ rawText: p.homework, voiceKey: p.homeworkVoiceKey ?? null })
      .where(eq(homework.sessionId, p.sessionId));
  }
  if (p.summary && (await approvalRequired(db, p.tenantId))) {
    await db.update(sessionReports).set({ status: "pending_approval" }).where(eq(sessionReports.sessionId, p.sessionId));
    await db.update(classSessions).set({ status: "held_incomplete" }).where(eq(classSessions.id, p.sessionId));
    return "pending";
  }
  if (p.summary) {
    await db.update(sessionReports).set({ status: "published", publishedAt: new Date() }).where(eq(sessionReports.sessionId, p.sessionId));
  }
  return "publish";
}

/** First decision wins. Approve queues nothing here; the caller posts the text. Reject keeps the session incomplete. */
export async function decideReport(
  db: Db,
  p: { sessionId: string; adminUserId: string; action: "approve" | "reject"; text?: string | null; now?: Date },
): Promise<{ ok: true; text: string; tenantId: string } | { ok: false; reason: "missing" | "taken" }> {
  const now = p.now ?? new Date();
  const [row] = await db
    .select({ report: sessionReports, tenantId: classSessions.tenantId })
    .from(sessionReports)
    .innerJoin(classSessions, eq(classSessions.id, sessionReports.sessionId))
    .where(and(eq(sessionReports.sessionId, p.sessionId), eq(sessionReports.status, "pending_approval")));
  if (!row) return { ok: false, reason: "missing" };
  if (p.action === "reject") {
    const [claimed] = await db
      .update(sessionReports)
      .set({ status: "rejected", approvedByUserId: p.adminUserId, approvedAt: now })
      .where(and(eq(sessionReports.sessionId, p.sessionId), eq(sessionReports.status, "pending_approval")))
      .returning();
    if (!claimed) return { ok: false, reason: "taken" };
    return { ok: true, text: "", tenantId: row.tenantId };
  }
  const text = (p.text?.trim() || row.report.finalText || row.report.summary).slice(0, 4000);
  const [claimed] = await db
    .update(sessionReports)
    .set({ status: "approved", summary: text, finalText: text, approvedByUserId: p.adminUserId, approvedAt: now })
    .where(and(eq(sessionReports.sessionId, p.sessionId), eq(sessionReports.status, "pending_approval")))
    .returning();
  if (!claimed) return { ok: false, reason: "taken" };
  return { ok: true, text, tenantId: row.tenantId };
}

export async function markReportPublished(db: Db, sessionId: string, now = new Date()) {
  await db
    .update(sessionReports)
    .set({ status: "published", publishedAt: now })
    .where(and(eq(sessionReports.sessionId, sessionId), eq(sessionReports.status, "approved")));
  await db.update(classSessions).set({ status: "held" }).where(eq(classSessions.id, sessionId));
}
