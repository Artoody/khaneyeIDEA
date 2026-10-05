import { NextResponse, type NextRequest } from "next/server";

// Persian is the default locale and lives at the root (/courses -> internally /fa/courses).
// English lives under /en. A visit to /fa/... is redirected to the canonical unprefixed URL.
// Panels (/app/...) need a session. This is only an optimistic, cookie-presence check that gives anonymous
// visitors a real HTTP redirect; the authoritative check (valid session + role) runs on the server in each page.
const SESSION_COOKIE = "kh_session";
const PANEL = /^(\/en)?\/app(\/|$)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const panel = PANEL.exec(pathname);
  if (panel && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = panel[1] ? "/en/login" : "/login";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  if (pathname === "/fa" || pathname.startsWith("/fa/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  if (pathname === "/en" || pathname.startsWith("/en/")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/fa${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals, API routes and static files.
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|brand|fonts|media|.*\\..*).*)"],
};
