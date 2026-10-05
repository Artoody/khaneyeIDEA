import { NextResponse, type NextRequest } from "next/server";

// Persian is the default locale and lives at the root (/courses -> internally /fa/courses).
// English lives under /en. A visit to /fa/... is redirected to the canonical unprefixed URL.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
