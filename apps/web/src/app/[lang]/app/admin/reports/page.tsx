import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { classGroups, classSessions, getDb, sessionReports, siteSettings, teachers } from "@khaneyeidea/db";
import { isLocale, type Locale } from "@/lib/i18n";
import { requirePermissionPage } from "@/server/auth";
import { decideReportAction, saveReportSettings } from "./actions";

async function Inbox({ lang }: { lang: Locale }) {
  const user = await requirePermissionPage(lang, "schedule.manage");
  const db = getDb();
  const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.tenantId, user.tenantId));
  const rows = await db
    .select({ report: sessionReports, title: classGroups.title, startsAt: classSessions.startsAt, teacher: teachers.name })
    .from(sessionReports)
    .innerJoin(classSessions, eq(classSessions.id, sessionReports.sessionId))
    .innerJoin(classGroups, eq(classGroups.id, classSessions.classGroupId))
    .leftJoin(teachers, eq(teachers.id, classSessions.teacherId))
    .where(and(eq(classSessions.tenantId, user.tenantId), eq(sessionReports.status, "pending_approval")))
    .orderBy(desc(sessionReports.submittedAt));

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-extrabold">گزارش‌های منتظر تأیید</h1>
      <p className="mt-2 text-sm text-muted">در هفته‌ی آزمون، گزارش بعد از تأیید شما در گروه کلاس منتشر می‌شود. می‌توانید متن را قبل از ارسال اصلاح کنید.</p>
      <form action={saveReportSettings} className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl border border-line p-4 text-sm">
        <input type="hidden" name="lang" value={lang} />
        <label className="flex items-center gap-2">
          <input type="checkbox" name="reportApprovalRequired" defaultChecked={settings?.reportApprovalRequired ?? true} />
          تأیید مدیر لازم است
        </label>
        <label>
          ساعت خبر شب قبل
          <input name="eveNoticeHour" defaultValue={settings?.eveNoticeHour ?? 21} inputMode="numeric" className="ms-2 h-10 w-16 rounded-xl border border-line px-2" />
        </label>
        <label>
          ساعت پایان گزارش
          <input name="eodReportDeadlineHour" defaultValue={settings?.eodReportDeadlineHour ?? 21} inputMode="numeric" className="ms-2 h-10 w-16 rounded-xl border border-line px-2" />
        </label>
        <button className="h-10 rounded-full bg-ink px-4 text-bg">ذخیره تنظیمات</button>
      </form>
      <ul className="mt-8 flex flex-col gap-4">
        {rows.length === 0 && <li className="text-muted">گزارشی در انتظار نیست.</li>}
        {rows.map((r) => (
          <li key={r.report.sessionId} className="rounded-[var(--radius-card)] border border-line p-5">
            <p className="font-semibold">{r.title}</p>
            <p className="text-sm text-muted">{r.teacher?.fa}</p>
            {r.report.voiceKey && (
              <div className="mt-3">
                {!r.report.rawText && <p className="mb-1 text-sm text-muted">متن صوتی پیوست است و رونویسی نشده.</p>}
                <audio controls src={`/api/teacher/voice?key=${encodeURIComponent(r.report.voiceKey)}`} className="h-10 w-full max-w-md" preload="metadata" />
              </div>
            )}
            <form action={decideReportAction} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="sessionId" value={r.report.sessionId} />
              <textarea name="text" rows={5} defaultValue={r.report.finalText ?? r.report.summary} className="rounded-2xl border border-line bg-surface p-3 text-sm" />
              <div className="flex gap-2">
                <button name="action" value="approve" className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent">
                  تأیید و ارسال به گروه
                </button>
                <button name="action" value="reject" className="h-10 rounded-full border border-line px-5 text-sm">
                  رد
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Page({ params }: PageProps<"/[lang]/app/admin/reports">) {
  return (
    <Suspense>
      {params.then(({ lang }) => (isLocale(lang) ? <Inbox lang={lang} /> : notFound()))}
    </Suspense>
  );
}
