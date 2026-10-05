import type { AdminDict } from "@/lib/admin-i18n";

/** Maps server validation codes to readable messages. */
export function errorText(code: string | undefined, a: AdminDict): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case "fa_required":
      return a.common.faRequired;
    case "slug":
      return a.common.slugInvalid;
    case "slug_taken":
      return a.common.slugTaken;
    case "number":
      return a.common.numberInvalid;
    case "https_required":
      return "https://…";
    default:
      return code;
  }
}
