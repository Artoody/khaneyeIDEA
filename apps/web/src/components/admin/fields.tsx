"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle, CircleNotch, Plus, Trash, WarningCircle } from "@phosphor-icons/react";

// Form primitives for the admin panel. Labels above inputs, help text below, errors inline.

export const inputCls =
  "h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-red-500";
export const textareaCls = inputCls.replace("h-11", "min-h-28 py-2.5 leading-relaxed");

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; savedAt?: number };

export function Field({
  label,
  name,
  help,
  error,
  children,
}: {
  label: string;
  name?: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {(error || help) && (
        <p className={`text-xs leading-relaxed ${error ? "text-red-500" : "text-muted"}`} role={error ? "alert" : undefined}>
          {error ?? help}
        </p>
      )}
    </div>
  );
}

/** Persian and English inputs side by side (stacked on mobile). English is LTR. */
export function LocalizedInput({
  label,
  name,
  value,
  help,
  error,
  multiline,
  required,
}: {
  label: string;
  name: string;
  value?: { fa: string; en: string } | null;
  help?: string;
  error?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  const Tag = multiline ? "textarea" : "input";
  const cls = multiline ? textareaCls : inputCls;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-ink">
        {label}
        {required && <span className="ms-1 text-accent-text">*</span>}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative" dir="rtl">
          <Tag name={`${name}.fa`} defaultValue={value?.fa ?? ""} dir="rtl" lang="fa" aria-label={`${label} (فارسی)`} aria-invalid={!!error} className={`${cls} pe-11`} />
          <span className="pointer-events-none absolute end-3 top-3 text-[10px] font-semibold text-muted">FA</span>
        </div>
        <div className="relative" dir="ltr">
          <Tag name={`${name}.en`} defaultValue={value?.en ?? ""} dir="ltr" lang="en" aria-label={`${label} (English)`} className={`${cls} pe-11`} />
          <span className="pointer-events-none absolute end-3 top-3 text-[10px] font-semibold text-muted">EN</span>
        </div>
      </div>
      {(error || help) && <p className={`text-xs ${error ? "text-red-500" : "text-muted"}`}>{error ?? help}</p>}
    </fieldset>
  );
}

export function Toggle({ name, label, defaultChecked, help }: { name: string; label: string; defaultChecked?: boolean; help?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-bg p-3.5 transition hover:border-ink/20">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {help && <span className="mt-0.5 block text-xs text-muted">{help}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-ink/15 transition peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent/30 after:absolute after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all after:[inset-inline-start:2px] peer-checked:after:[inset-inline-start:22px]" />
    </label>
  );
}

/**
 * Editable list of rows (phones, socials, syllabus...). Serialized as JSON into a hidden input named `name`.
 */
export function ListEditor<T extends Record<string, unknown>>({
  name,
  initial,
  blank,
  addLabel,
  renderRow,
}: {
  name: string;
  initial: T[];
  blank: T;
  addLabel: string;
  renderRow: (row: T, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const [rows, setRows] = useState<T[]>(initial);
  const update = (i: number, patch: Partial<T>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const n = [...r];
      const j = i + d;
      if (j < 0 || j >= n.length) return r;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl border border-line bg-bg p-2.5">
          <div className="min-w-0 flex-1">{renderRow(row, (p) => update(i, p))}</div>
          <div className="flex shrink-0 flex-col gap-1">
            <IconBtn label="up" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp className="size-4" />
            </IconBtn>
            <IconBtn label="down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
              <ArrowDown className="size-4" />
            </IconBtn>
            <IconBtn label="remove" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
              <Trash className="size-4 text-red-500" />
            </IconBtn>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, structuredClone(blank)])}
        className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-sm text-muted transition hover:border-accent hover:text-ink"
      >
        <Plus weight="bold" className="size-4" />
        {addLabel}
      </button>
    </div>
  );
}

function IconBtn({ label, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-ink/5 disabled:opacity-30" {...p}>
      {children}
    </button>
  );
}

/** A form bound to a server action, with a sticky save bar and saved / error feedback. */
export function AdminForm({
  action,
  children,
  labels,
  hidden,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: (state: ActionState) => React.ReactNode;
  labels: { save: string; saved: string; error: string };
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (!state.savedAt) return;
    const show = setTimeout(() => setShowSaved(true), 0);
    const hide = setTimeout(() => setShowSaved(false), 2500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [state.savedAt]);
  return (
    <form
      // Submitting through onSubmit (not the action prop) keeps what the admin typed when validation fails;
      // React 19 resets uncontrolled fields after every form-action submission.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children(state)}
      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-on-accent transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <CircleNotch className="size-4 animate-spin" />}
          {labels.save}
        </button>
        {showSaved && !state.error && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400" role="status">
            <CheckCircle weight="fill" className="size-4" />
            {labels.saved}
          </span>
        )}
        {state.error && state.error !== "conflict" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-red-500" role="alert">
            <WarningCircle weight="fill" className="size-4" />
            {state.error === "validation" ? labels.error : state.error}
          </span>
        )}
      </div>
    </form>
  );
}
