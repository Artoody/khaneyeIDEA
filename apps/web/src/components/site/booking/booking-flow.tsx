"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarPlus, CheckCircle, CircleNotch, MapPin, Monitor, Phone, WarningCircle, X } from "@phosphor-icons/react";
import type { Dict, Locale } from "@/lib/i18n";
import { href, num } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { dayLabel, tehranIso, timeLabel } from "@/lib/jalali";
import { confirmBooking, loadSlots, sendBookingCode, type ConfirmResult, type SlotDTO } from "@/app/[lang]/book/actions";
import { DeptIcon } from "../dept-icon";
import { DevCodeNote } from "@/components/auth/login-form";

type L10n = { fa: string; en: string };
export type BookType = { id: string; kind: "trial_class" | "consultation" | "placement" | "visit"; place: "in_person" | "phone" | "online"; title: string; description: string };
export type BookDept = { id: string; title: string; icon: string | null };
export type BookBranch = { id: string; name: string; address: string };
type Step = "type" | "child" | "time" | "contact" | "code" | "done";
type Labels = Dict["book"];

const AGES = Array.from({ length: 15 }, (_, i) => i + 4); // 4..18
const needsChild = (k: BookType["kind"]) => k === "trial_class" || k === "placement";
const pick = (v: L10n | null | undefined, l: Locale) => (v ? (l === "en" ? v.en || v.fa : v.fa || v.en) : "");

const chip =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-line px-4 text-[15px] transition active:scale-[0.98] hover:border-ink/30 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg disabled:cursor-not-allowed disabled:opacity-40";
const primary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-base font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-50";
const input =
  "h-12 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-red-500";

function Section({
  title,
  state,
  summary,
  onEdit,
  editLabel,
  children,
  testId,
}: {
  title: string;
  state: "done" | "current" | "later";
  summary?: React.ReactNode;
  onEdit?: () => void;
  editLabel: string;
  children?: React.ReactNode;
  testId: string;
}) {
  const reduce = useReducedMotion();
  if (state === "later") return null;
  return (
    <section
      data-testid={testId}
      className={`rounded-[var(--radius-card)] border bg-surface transition-colors ${state === "current" ? "border-accent/60 p-5 sm:p-7" : "border-line px-5 py-4 sm:px-7"}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className={`font-display font-extrabold tracking-tight ${state === "current" ? "text-xl sm:text-2xl" : "text-sm text-muted"}`}>{title}</h2>
          {state === "done" && <div className="mt-0.5 truncate font-medium">{summary}</div>}
        </div>
        {state === "done" && onEdit && (
          <button type="button" onClick={onEdit} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-ink/5 hover:text-ink">
            {editLabel}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {state === "current" && (
          <motion.div
            key="body"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ErrorLine({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
      <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  );
}

function ResendTimer({ seconds, labels, onResend, lang }: { seconds: number; labels: Labels; onResend: () => void; lang: Locale }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return left > 0 ? (
    <span className="text-sm text-muted">{fill(labels.resendIn, { s: num(left, lang) })}</span>
  ) : (
    <button type="button" onClick={onResend} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
      {labels.resend}
    </button>
  );
}

function icsFile(b: { startsAt: string; endsAt: string; title: string; location: string }) {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//khaneyeide//booking//FA",
    "BEGIN:VEVENT",
    `UID:${stamp(b.startsAt)}-${Math.random().toString(36).slice(2)}@khaneyeide.ir`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.startsAt)}`,
    `DTEND:${stamp(b.endsAt)}`,
    `SUMMARY:${esc(b.title)}`,
    b.location ? `LOCATION:${esc(b.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return URL.createObjectURL(new Blob([body.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
}

export function BookingFlow({
  lang,
  labels,
  types,
  departments,
  branches,
  course,
  signedInPhone,
  source,
  siteName,
  devCode,
}: {
  lang: Locale;
  labels: Labels;
  types: BookType[];
  departments: BookDept[];
  branches: Record<string, BookBranch>;
  course: { id: string; title: string; departmentId: string | null; ageMin: number | null } | null;
  signedInPhone: string | null;
  source: string | null;
  siteName: string;
  devCode?: string | null;
}) {
  const t = labels;
  const preType = course ? (types.find((x) => x.kind === "trial_class") ?? types[0]) : types.length === 1 ? types[0] : undefined;
  const [step, setStep] = useState<Step>(preType ? "child" : "type");
  const [typeId, setTypeId] = useState<string | null>(preType?.id ?? null);
  const [age, setAge] = useState<number | null>(null);
  const [deptId, setDeptId] = useState<string | null | "none">(course?.departmentId ?? null);
  const [courseSel, setCourseSel] = useState(course);
  const [slots, setSlots] = useState<SlotDTO[] | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | "all">("all");
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDTO | null>(null);
  const [guardian, setGuardian] = useState("");
  const [childName, setChildName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [codeInfo, setCodeInfo] = useState<{ phone: string; expiresInSec: number; sentAt: number } | null>(null);
  const [signedIn, setSignedIn] = useState(signedInPhone);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<ConfirmResult, { ok: true }>["booking"] | null>(null);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const type = types.find((x) => x.id === typeId) ?? null;
  const dept = departments.find((d) => d.id === deptId) ?? null;
  const order: Step[] = ["type", "child", "time", "contact", "code", "done"];
  const stateOf = (s: Step) => (s === step ? "current" : order.indexOf(s) < order.indexOf(step) ? "done" : "later");
  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };
  const err = (code: string) => setError(t.errors[code] ?? t.errors.unknown!);

  const fetchSlots = () => {
    if (!typeId) return;
    setSlots(null);
    setSlot(null);
    setDay(null);
    go("time");
    start(async () => {
      try {
        const res = await loadSlots({
          appointmentTypeId: typeId,
          age,
          departmentId: deptId && deptId !== "none" ? deptId : null,
          courseId: courseSel?.id ?? null,
        });
        setSlots(res);
      } catch {
        setSlots([]);
        err("unknown");
      }
    });
  };

  // Slots narrowed by branch, then grouped by day.
  const branchIds = useMemo(() => [...new Set((slots ?? []).map((s) => s.branchId ?? "remote"))], [slots]);
  const visible = (slots ?? []).filter((s) => branchFilter === "all" || (s.branchId ?? "remote") === branchFilter);
  const days = [...new Set(visible.map((s) => s.day))];
  const activeDay = day && days.includes(day) ? day : (days.find((d) => visible.some((s) => s.day === d && s.remaining > 0)) ?? days[0] ?? null);
  const dayTimes = visible.filter((s) => s.day === activeDay);
  const placeOf = (s: SlotDTO) => (s.branchId ? (branches[s.branchId]?.name ?? "") : t.remote);

  const book = (withCode: string | null) => {
    if (!slot) return;
    setError(null);
    start(async () => {
      const r = await confirmBooking({
        templateId: slot.templateId,
        startsAt: slot.startsAt,
        courseId: courseSel?.id ?? null,
        guardianName: guardian,
        childFirstName: childName || null,
        childAge: age,
        note: note || null,
        phone: signedIn ? null : (codeInfo?.phone ?? phone),
        code: withCode,
        source,
      });
      if (r.ok) {
        setDone(r.booking);
        setStep("done");
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (r.signedInPhone) setSignedIn(r.signedInPhone);
      if (r.step === "time") {
        fetchSlots();
      } else if (r.step === "contact") {
        go("contact");
      }
      err(r.error);
    });
  };

  const requestCode = () => {
    if (!guardian.trim()) return err("name_required");
    if (signedIn) return book(null);
    setError(null);
    start(async () => {
      const r = await sendBookingCode(phone);
      if (!r.ok) return err(r.error);
      setCode("");
      setCodeInfo({ phone: r.phone, expiresInSec: r.expiresInSec, sentAt: Date.now() });
      go("code");
    });
  };

  const localPhone = (p: string) => num(`0${p.slice(2)}`, lang);
  const sep = lang === "fa" ? "، " : ", ";

  if (step === "done" && done) {
    const when = `${dayLabel(tehranIso(new Date(done.startsAt)), lang)}${sep}${timeLabel(done.startsAt, lang)}`;
    const place = done.branch ? [pick(done.branch.name, lang), pick(done.branch.address, lang)].filter(Boolean).join(sep) : t.remote;
    return (
      <div ref={top} className="rounded-[var(--radius-card)] border border-accent/50 bg-surface p-6 sm:p-10" data-testid="booking-done">
        <CheckCircle weight="fill" className="size-14 text-accent" />
        <h2 className="mt-6 font-display text-3xl font-black tracking-tight sm:text-4xl">{t.doneTitle}</h2>
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-bg p-5">
            <dt className="text-sm text-muted">{pick(done.type, lang)}</dt>
            <dd className="mt-1 font-display text-xl font-extrabold">{when}</dd>
          </div>
          <div className="rounded-2xl bg-bg p-5">
            <dt className="text-sm text-muted">{done.branch ? <MapPin className="inline size-4" /> : <Phone className="inline size-4" />}</dt>
            <dd className="mt-1 font-medium leading-relaxed">{place}</dd>
          </div>
        </dl>
        <p className="mt-6 max-w-[60ch] leading-relaxed text-muted">{t.doneBody}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={icsFile({ startsAt: done.startsAt, endsAt: done.endsAt, title: `${pick(done.type, lang)} | ${siteName}`, location: place })}
            download="khaneyeide-booking.ics"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-6 font-medium transition hover:border-ink/30"
          >
            <CalendarPlus className="size-5" />
            {t.addToCalendar}
          </a>
          <Link href={href(lang, "/app")} className={primary}>
            {t.portal}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={top} className="flex flex-col gap-3">
      {/* 1. type */}
      <Section
        testId="step-type"
        title={t.stepType}
        state={stateOf("type")}
        summary={type?.title}
        onEdit={types.length > 1 ? () => go("type") : undefined}
        editLabel={t.change}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((x) => {
            const Ico = x.place === "phone" ? Phone : x.place === "online" ? Monitor : MapPin;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={typeId === x.id}
                onClick={() => {
                  setTypeId(x.id);
                  go("child");
                }}
                className="group flex flex-col items-start rounded-2xl border border-line bg-bg p-5 text-start transition hover:-translate-y-0.5 hover:border-accent/60 active:scale-[0.99] aria-pressed:border-accent"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent-text">
                  <Ico weight="duotone" className="size-5" />
                </span>
                <span className="mt-4 font-display text-lg font-extrabold">{x.title}</span>
                {x.description && <span className="mt-1 text-sm leading-relaxed text-muted">{x.description}</span>}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 2. child */}
      <Section
        testId="step-child"
        title={t.stepChild}
        state={stateOf("child")}
        summary={[age ? fill(t.ageValue, { n: num(age, lang) }) : null, courseSel?.title ?? (dept ? dept.title : deptId === "none" ? t.notSure : null)].filter(Boolean).join(sep)}
        onEdit={() => go("child")}
        editLabel={t.change}
      >
        <p className="font-medium">{t.age}</p>
        <div className="-mx-1 mt-3 flex flex-wrap gap-2 px-1" role="group" aria-label={t.age}>
          {AGES.map((n) => (
            <button key={n} type="button" aria-pressed={age === n} onClick={() => setAge(n)} className={`${chip} w-12 px-0 tabular-nums`}>
              {num(n, lang)}
            </button>
          ))}
        </div>
        {courseSel ? (
          <div className="mt-7">
            <p className="font-medium">{t.course}</p>
            <span className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-ink ps-5 pe-2 text-bg">
              {courseSel.title}
              <button
                type="button"
                aria-label={t.removeCourse}
                onClick={() => setCourseSel(null)}
                className="grid size-8 place-items-center rounded-full transition hover:bg-bg/15"
              >
                <X weight="bold" className="size-4" />
              </button>
            </span>
          </div>
        ) : (
          <div className="mt-7">
            <p className="font-medium">{t.area}</p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.area}>
              {departments.map((d) => (
                <button key={d.id} type="button" aria-pressed={deptId === d.id} onClick={() => setDeptId(d.id)} className={chip}>
                  <DeptIcon icon={d.icon} className="size-4" />
                  {d.title}
                </button>
              ))}
              <button type="button" aria-pressed={deptId === "none"} onClick={() => setDeptId("none")} className={chip}>
                {t.notSure}
              </button>
            </div>
          </div>
        )}
        <div className="mt-8">
          <button type="button" onClick={fetchSlots} disabled={!type || (needsChild(type.kind) && !age)} className={primary}>
            {t.next}
          </button>
        </div>
      </Section>

      {/* 3. time */}
      <Section
        testId="step-time"
        title={t.stepTime}
        state={stateOf("time")}
        summary={slot ? `${dayLabel(slot.day, lang)}${sep}${timeLabel(slot.startsAt, lang)} · ${placeOf(slot)}` : null}
        onEdit={() => go("time")}
        editLabel={t.change}
      >
        {slots === null ? (
          <div className="flex items-center gap-3 text-muted" role="status">
            <CircleNotch className="size-5 animate-spin" />
            {t.loading}
          </div>
        ) : slots.length === 0 ? (
          <div>
            <p className="text-lg">{t.noSlots}</p>
            <p className="mt-1 text-muted">{t.noSlotsHelp}</p>
            <button type="button" onClick={() => go("child")} className={`${chip} mt-5`}>
              {t.back}
            </button>
          </div>
        ) : (
          <>
            {branchIds.length > 1 && (
              <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-7 sm:px-7" role="group">
                <button type="button" aria-pressed={branchFilter === "all"} onClick={() => setBranchFilter("all")} className={chip}>
                  {t.allBranches}
                </button>
                {branchIds.map((b) => (
                  <button key={b} type="button" aria-pressed={branchFilter === b} onClick={() => setBranchFilter(b)} className={chip}>
                    {b === "remote" ? t.remote : (branches[b]?.name ?? "")}
                  </button>
                ))}
              </div>
            )}
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-7 sm:px-7" role="tablist">
              {days.map((d) => {
                const open = visible.some((s) => s.day === d && s.remaining > 0);
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={d === activeDay}
                    onClick={() => setDay(d)}
                    className={`flex min-w-24 shrink-0 flex-col items-center rounded-2xl border px-3 py-3 transition active:scale-[0.98] aria-selected:border-ink aria-selected:bg-ink aria-selected:text-bg ${open ? "border-line hover:border-ink/30" : "border-line opacity-50"}`}
                  >
                    <span className="text-xs opacity-80">{dayLabel(d, lang).split(/[\s,]+/)[0]}</span>
                    <span className="mt-0.5 font-display text-lg font-extrabold">{dayLabel(d, lang, { weekday: false })}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4" role="tabpanel">
              {dayTimes.map((s) => (
                <button
                  key={`${s.templateId}-${s.startsAt}`}
                  type="button"
                  disabled={s.remaining === 0}
                  aria-pressed={slot?.startsAt === s.startsAt && slot.templateId === s.templateId}
                  onClick={() => {
                    setSlot(s);
                    go("contact");
                  }}
                  className="flex flex-col items-center rounded-2xl border border-line bg-bg px-2 py-3 transition hover:border-accent/70 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-accent aria-pressed:bg-accent/15"
                >
                  <span className={`font-display text-lg font-extrabold tabular-nums ${s.remaining === 0 ? "line-through" : ""}`}>{timeLabel(s.startsAt, lang)}</span>
                  <span className="mt-0.5 text-xs text-muted">
                    {s.remaining === 0 ? t.full : branchFilter === "all" && branchIds.length > 1 ? placeOf(s) : s.remaining <= 2 ? fill(t.seatsLeft, { n: num(s.remaining, lang) }) : " "}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {step === "time" && <ErrorLine text={error} />}
      </Section>

      {/* 4. contact */}
      <Section testId="step-contact" title={t.stepContact} state={stateOf("contact")} summary={guardian} onEdit={() => go("contact")} editLabel={t.change}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            requestCode();
          }}
          className="flex flex-col gap-5"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t.guardianName}</span>
              <input name="guardian" autoComplete="name" value={guardian} onChange={(e) => setGuardian(e.target.value)} className={input} required />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t.childName}</span>
              <input name="child" autoComplete="off" value={childName} onChange={(e) => setChildName(e.target.value)} className={input} aria-describedby="child-help" />
              <span id="child-help" className="text-xs text-muted">
                {t.childNameHelp}
              </span>
            </label>
          </div>
          {signedIn ? (
            <p className="text-sm text-muted">{fill(t.signedInAs, { phone: localPhone(signedIn) })}</p>
          ) : (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t.phone}</span>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="0912 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`${input} text-start sm:max-w-xs`}
                aria-describedby="phone-help"
              />
              <span id="phone-help" className="text-xs text-muted">
                {t.phoneHelp}
              </span>
            </label>
          )}
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t.note}</span>
            <textarea name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${input} h-auto py-3`} />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending} className={primary}>
              {pending && <CircleNotch className="size-5 animate-spin" />}
              {signedIn ? t.confirm : t.sendCode}
            </button>
            <p className="text-xs text-muted">{t.privacy}</p>
          </div>
          {step === "contact" && <ErrorLine text={error} />}
        </form>
      </Section>

      {/* 5. code */}
      {!signedIn && (
        <Section testId="step-code" title={t.stepCode} state={stateOf("code")} editLabel={t.change}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              book(code);
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm text-muted">{fill(t.code, { phone: codeInfo ? localPhone(codeInfo.phone) : "" })}</span>
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={4}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "").slice(0, 4);
                  setCode(v);
                  if (v.length === 4 && !pending) book(v);
                }}
                className={`${input} w-44 text-center font-display text-2xl tracking-[0.5em]`}
                autoFocus
              />
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={pending || code.length !== 4} className={primary}>
                {pending && <CircleNotch className="size-5 animate-spin" />}
                {t.confirm}
              </button>
              {codeInfo && <ResendTimer key={codeInfo.sentAt} seconds={60} labels={t} lang={lang} onResend={requestCode} />}
            </div>
            {devCode && <DevCodeNote code={devCode} lang={lang} />}
            {step === "code" && <ErrorLine text={error} />}
          </form>
        </Section>
      )}
    </div>
  );
}
