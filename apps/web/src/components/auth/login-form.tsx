"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { requestCodeAction, verifyCodeAction, type LoginState } from "@/app/[lang]/login/actions";
import type { Dict, Locale } from "@/lib/i18n";

type Labels = Dict["auth"];

const fmtPhone = (e164: string, lang: Locale) => {
  const local = `0${e164.slice(2)}`;
  const s = `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return lang === "fa" ? s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!) : s;
};

const inputCls =
  "h-14 w-full rounded-xl border border-line bg-bg px-4 text-lg text-ink outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/20 aria-[invalid=true]:border-red-500";
const btnCls =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-base font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.99] disabled:opacity-60";

/** Shown only in development while OTP_DEV_CODE is set (no SMS yet). */
export function DevCodeNote({ code, lang }: { code: string; lang: Locale }) {
  return (
    <p className="rounded-xl border border-dashed border-accent/60 bg-accent/10 px-3 py-2 text-xs text-ink">
      {lang === "fa" ? "حالت آزمایشی: کد ورود " : "Test mode: the code is "}
      <b dir="ltr" className="font-mono">{code}</b>
    </p>
  );
}

export function LoginForm({ lang, t, devCode }: { lang: Locale; t: Labels; devCode?: string | null }) {
  const [reqState, requestCode, requesting] = useActionState<LoginState, FormData>(requestCodeAction, { step: "phone" });
  const [verState, verifyCode, verifying] = useActionState<LoginState, FormData>(verifyCodeAction, { step: "phone" });
  const [editingPhone, setEditingPhone] = useState(false);

  const codeStep = reqState.step === "code" && !editingPhone ? reqState : null;
  const verifyError = verState.step === "code" ? verState.error : undefined;
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (codeStep) codeRef.current?.focus();
  }, [codeStep]);

  if (!codeStep) {
    const err = reqState.step === "phone" ? reqState.error : undefined;
    return (
      <form action={(f) => { setEditingPhone(false); requestCode(f); }} className="flex flex-col gap-2" noValidate>
        <label htmlFor="phone" className="text-sm font-medium text-ink">{t.phone}</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          defaultValue={reqState.step === "phone" ? reqState.phone : ""}
          placeholder="0912 123 4567"
          aria-invalid={!!err}
          aria-describedby="phone-help"
          className={`${inputCls} text-start tracking-wider`}
        />
        <p id="phone-help" className={`text-sm ${err ? "text-red-500" : "text-muted"}`} role={err ? "alert" : undefined}>
          {err ? t.errors[err] : t.phoneHint}
        </p>
        <button type="submit" disabled={requesting} className={`${btnCls} mt-4`}>
          {requesting && <CircleNotch className="size-5 animate-spin" />}
          {t.send}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form action={verifyCode} className="flex flex-col gap-2" noValidate>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="phone" value={codeStep.phone} />
        <label htmlFor="code" className="text-sm font-medium text-ink">{t.code}</label>
        <input
          ref={codeRef}
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={4}
          required
          aria-invalid={!!verifyError}
          aria-describedby="code-help"
          className={`${inputCls} text-center font-mono text-2xl tracking-[0.6em]`}
        />
        <p id="code-help" className={`text-sm ${verifyError ? "text-red-500" : "text-muted"}`} role={verifyError ? "alert" : undefined}>
          {verifyError ? t.errors[verifyError] : t.codeHint.replace("{phone}", fmtPhone(codeStep.phone, lang))}
        </p>
        {devCode && <DevCodeNote code={devCode} lang={lang} />}
        <button type="submit" disabled={verifying} className={`${btnCls} mt-4`}>
          {verifying && <CircleNotch className="size-5 animate-spin" />}
          {t.verify}
        </button>
      </form>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button type="button" onClick={() => setEditingPhone(true)} className="text-muted underline-offset-4 hover:text-ink hover:underline">
          {t.change}
        </button>
        <ResendTimer key={`${codeStep.phone}-${requesting}`} lang={lang} t={t}>
          <form action={requestCode}>
            <input type="hidden" name="phone" value={codeStep.phone} />
            <button type="submit" className="font-medium text-accent-text underline-offset-4 hover:underline">{t.resend}</button>
          </form>
        </ResendTimer>
      </div>
    </div>
  );
}

/** Counts down from 60s, then shows its children (the resend button). Remounts per sent code via key. */
function ResendTimer({ lang, t, children }: { lang: Locale; t: Labels; children: React.ReactNode }) {
  const [left, setLeft] = useState(60);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  if (left <= 0) return <>{children}</>;
  const n = lang === "fa" ? String(left).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!) : String(left);
  return <span className="tabular-nums text-muted">{t.resendIn.replace("{s}", n)}</span>;
}
