import { getDb } from "@khaneyeidea/db";
import { askDueCheckins, remindPending, sendDueAnnouncements, type Messengers } from "@khaneyeidea/core";

// Timed work: the post-class question, reminders, and approved notices. Every step claims its row in the database
// first, so a restart or a second bot process never sends the same message twice.
const EVERY_MS = Number(process.env.BOT_JOBS_EVERY_MS) || 60_000; // the override is for tests

export function startJobs(ms: Messengers) {
  let busy = false;
  const tick = async () => {
    if (busy || !Object.keys(ms).length) return;
    busy = true;
    try {
      const db = getDb();
      const a = await askDueCheckins(db, ms);
      const r = await remindPending(db, ms);
      const n = await sendDueAnnouncements(db, ms);
      if (a.asked || r.reminded || r.escalated || n.sent || n.failed) console.log(`[jobs] asked=${a.asked} reminded=${r.reminded} escalated=${r.escalated} notices=${n.sent} failed=${n.failed}`);
    } catch (e) {
      console.error("[jobs] tick failed", e instanceof Error ? e.message : e);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, EVERY_MS);
  void tick();
  return () => clearInterval(timer);
}
