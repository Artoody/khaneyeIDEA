"use client";

/** A select that submits its GET form on change (filters without a submit button). */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

/** A checkbox that submits its GET form when toggled. */
export function AutoSubmitCheckbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="checkbox" onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
