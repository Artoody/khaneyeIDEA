"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { classGroups, classSessions, enrollments, getDb, scheduledAnnouncements, students, teachers, userRoles } from "@khaneyeidea/db";
import {
  changeOwnPassword,
  createAiProvider,
  deliverWebPush,
  formatClassReport,
  loginWithPassword,
  polishNote,
  reportStudentLabel,
  saveSessionWork,
  sendPush,
  transcribeVoice,
  type Mark,
  type StudentScores,
} from "@khaneyeidea/core";

import { href, isLocale, type Locale } from "@/lib/i18n";
import { clientMeta, requirePermission, requireUser, setSessionCookie } from "@/server/auth";
import { tenantId } from "@/server/content";

export type TeacherLoginState = { error?: "invalid" | "locked" | "inactive" | "not_teacher" };

export async function teacherLoginAction(_prev: TeacherLoginState, form: FormData): Promise<TeacherLoginState> {
  const lang = String(form.get("lang") ?? "fa");
  const locale: Locale = isLocale(lang) ? lang : "fa";
  try {
    const meta = await clientMeta();
    const result = await loginWithPassword(getDb(), {
      tenantId: await tenantId(),
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      audience: "teacher",
      ...meta,
    });
    if (!result.ok) return { error: result.reason };
    await setSessionCookie(result.token);
    redirect(href(locale, result.mustChangePassword ? "/teacher/password" : "/teacher"));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[teacher-login]", e);
    return { error: "invalid" };
  }
}

export async function changePasswordAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const user = await requireUser(isLocale(String(form.get("lang"))) ? (String(form.get("lang")) as Locale) : "fa");
  const result = await changeOwnPassword(getDb(), {
    userId: user.userId,
    current: String(form.get("current") ?? ""),
    next: String(form.get("next") ?? ""),
  });
  if (!result.ok) return { error: result.reason };
  const lang = String(form.get("lang") ?? "fa");
  redirect(href(isLocale(lang) ? lang : "fa", "/teacher"));
}

export type TeacherProfileState = { error?: "photo" | "meetingUrl" | "missing"; ok?: boolean };

/** Teacher updates their own photo and default meeting link. */
export async function updateTeacherProfile(_prev: TeacherProfileState, form: FormData): Promise<TeacherProfileState> {
  const user = await requirePermission("session.report_own");
  const lang = String(form.get("lang") ?? "fa");
  const photo = String(form.get("photo") ?? "").trim();
  const meetingUrl = String(form.get("meetingUrl") ?? "").trim();
  if (photo && !/^(https:\/\/|\/media\/)/.test(photo)) return { error: "photo" };
  if (meetingUrl && !/^https:\/\//.test(meetingUrl)) return { error: "meetingUrl" };
  const db = getDb();
  const res = await db
    .update(teachers)
    .set({ photo: photo || null, meetingUrl: meetingUrl || null })
    .where(and(eq(teachers.userId, user.userId), eq(teachers.tenantId, user.tenantId)))
    .returning({ id: teachers.id });
  if (!res.length) return { error: "missing" };
  redirect(href(isLocale(lang) ? lang : "fa", "/teacher/profile?saved=1"));
}

export async function toggleClassAi(form: FormData) {
  const user = await requirePermission("session.report_own");
  const classId = String(form.get("classId") ?? "");
  const db = getDb();
  const [mine] = await db
    .select({ id: classGroups.id, on: classGroups.aiReportEnabled })
    .from(classGroups)
    .innerJoin(teachers, eq(teachers.id, classGroups.teacherId))
    .where(and(eq(classGroups.id, classId), eq(teachers.userId, user.userId), eq(classGroups.tenantId, user.tenantId)));
  if (!mine) return;
  await db.update(classGroups).set({ aiReportEnabled: !mine.on }).where(eq(classGroups.id, mine.id));
  const lang = String(form.get("lang") ?? "fa");
  redirect(href(isLocale(lang) ? lang : "fa", "/teacher"));
}

/** Attendance, report and homework from the teacher app. Posts to the group, or waits for an admin during the trial. */
export async function submitClassWork(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const lang = String(form.get("lang") ?? "fa");
  const locale: Locale = isLocale(lang) ? lang : "fa";
  const user = await requirePermission("session.report_own");
  const db = getDb();
  const sessionId = String(form.get("sessionId") ?? "");
  const [row] = await db
    .select({ s: classSessions, c: classGroups })
    .from(classSessions)
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .innerJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .where(and(eq(classSessions.id, sessionId), eq(teachers.userId, user.userId), eq(classSessions.tenantId, user.tenantId)));
  if (!row) return { error: "missing" };

  const roster = await db
    .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.classGroupId, row.c.id), eq(enrollments.status, "active")));
  const absent = new Set(form.getAll("absent").map(String));
  const marks: Record<string, Mark> = Object.fromEntries(roster.map((s) => [s.id, absent.has(s.id) ? "absent" : "present"]));
  const scores: Record<string, StudentScores> = Object.fromEntries(
    roster.map((s) => [
      s.id,
      {
        activity: Number(form.get(`activity_${s.id}`) ?? NaN),
        homework: Number(form.get(`homeworkScore_${s.id}`) ?? NaN),
        note: String(form.get(`note_${s.id}`) ?? "").trim() || null,
      },
    ]),
  );
  const label = (s: (typeof roster)[number]) => reportStudentLabel(s.firstName, s.lastName);
  const specialNotes = roster
    .map((s) => {
      const note = scores[s.id]?.note?.trim();
      return note ? `${label(s)}: ${note}` : null;
    })
    .filter(Boolean) as string[];

  const ai = createAiProvider();
  const names = roster.flatMap((s) => [s.firstName, s.lastName].filter(Boolean) as string[]);
  let activities = String(form.get("report") ?? "").trim();
  let homework = String(form.get("homework") ?? "").trim();
  const voiceKey = String(form.get("voiceKey") ?? "");
  const homeworkVoiceKey = String(form.get("homeworkVoiceKey") ?? "");
  const voicePath = (key: string) => path.join(process.cwd(), ".devdata", "voices", key);
  const readVoice = async (key: string) => {
    if (!/^[a-f0-9]{24}\.webm$/.test(key)) return null;
    try {
      return await readFile(voicePath(key));
    } catch (e) {
      console.error("[teacher] voice file missing", key, e instanceof Error ? e.message : e);
      return null;
    }
  };

  if (!activities && voiceKey) {
    if (ai.name === "none" || !ai.transcribe) {
      console.error("[teacher] voice report needs AI_PROVIDER with transcription; got", ai.name);
      return { error: "ai" };
    }
    const audio = await readVoice(voiceKey);
    if (!audio) return { error: "voice" };
    activities = (await transcribeVoice(ai, audio, "audio/webm")) ?? "";
    if (!activities) {
      console.error("[teacher] transcription empty for", voiceKey);
      return { error: "voice" };
    }
  }
  if (!homework && homeworkVoiceKey) {
    const audio = await readVoice(homeworkVoiceKey);
    if (audio && ai.transcribe) homework = (await transcribeVoice(ai, audio, "audio/webm")) ?? "";
    if (!homework) homework = "به صورت ویس قرار می‌گیرد";
  }

  let aiText: string | null = null;
  const rawReport = activities;
  if (row.c.aiReportEnabled) {
    if (activities) {
      const polished = await polishNote(ai, activities, names, "report");
      aiText = polished.usedAi ? polished.text : null;
      activities = polished.text;
    }
    if (homework && homework !== "به صورت ویس قرار می‌گیرد") {
      homework = (await polishNote(ai, homework, names, "homework")).text;
    }
  }
  if (!activities && !voiceKey) return { error: "empty" };
  if (!activities) return { error: "voice" };

  const presentN = roster.filter((s) => !absent.has(s.id)).length;
  const absentN = roster.filter((s) => absent.has(s.id)).length;
  // Internal/admin copy may keep labels; the group post never includes children's names.
  const summary = formatClassReport({
    startsAt: row.s.startsAt,
    present: roster.filter((s) => !absent.has(s.id)).map(label),
    absent: roster.filter((s) => absent.has(s.id)).map(label),
    activities,
    homework: homework || null,
    special: specialNotes.length ? specialNotes.join("؛ ") : null,
  });
  const groupText = formatClassReport({
    startsAt: row.s.startsAt,
    present: presentN ? [`${presentN} نفر`] : [],
    absent: absentN ? [`${absentN} نفر`] : [],
    activities,
    homework: homework || null,
    special: specialNotes.length ? `${specialNotes.length} مورد` : null,
  });
  const gate = await saveSessionWork(db, {
    tenantId: user.tenantId,
    sessionId,
    userId: user.userId,
    channel: "web",
    marks,
    scores,
    summary,
    homework: homework || null,
    rawText: String(form.get("report") ?? "").trim() || rawReport,
    aiText,
    voiceKey: voiceKey || null,
    homeworkVoiceKey: homeworkVoiceKey || null,
  });
  if (gate === "publish" && groupText) {
    await db.insert(scheduledAnnouncements).values({
      tenantId: user.tenantId,
      sessionId,
      text: groupText,
      sendAt: new Date(),
      targets: { group: true, parents: false, kind: "report" },
      status: "scheduled",
      approvedByUserId: user.userId,
    });
  }
  if (gate === "pending") {
    const staff = await db.select({ userId: userRoles.userId }).from(userRoles).where(inArray(userRoles.role, ["owner", "admin"]));
    for (const a of staff) {
      await sendPush(db, a.userId, { title: "گزارش منتظر تأیید", body: row.c.title, url: "/app/admin/reports", tag: `report-${sessionId}` }, deliverWebPush).catch(() => {});
    }
  }
  redirect(href(locale, "/teacher?saved=1"));
}
