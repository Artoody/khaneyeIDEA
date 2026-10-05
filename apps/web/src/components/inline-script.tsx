"use client";

/**
 * A script that runs during HTML parsing (before first paint) on hard loads. On the client it renders as
 * text/plain, so React does not warn about rendering scripts (per Next's "preventing flash" guide).
 */
export function InlineScript({ html }: { html: string }) {
  return <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
