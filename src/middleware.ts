import { NextResponse, type NextRequest } from "next/server";

/**
 * Eigene Domains: Anfragen an einen fremden Host (z.B. termine.firma.de) werden auf
 * /site/<host>/… umgeschrieben. Die Seite dort sucht die Organisation zur Domain.
 * Technische Pfade (API, Assets, Buchungs-Links) laufen unverändert durch.
 */
const PASS_THROUGH = /^\/(api|_next|booking|verhandlung|embed|site)(\/|$)|^\/(favicon\.ico|embed\.js|robots\.txt)$/;
const APP_ONLY = /^\/(dashboard|login|invite|onboarding)(\/|$)/;

function appUrl() {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase().split(",")[0].trim();
  const appHost = new URL(appUrl()).host.toLowerCase();
  const hostname = host.replace(/:\d+$/, "");
  if (!host || host === appHost || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "app") {
    return NextResponse.next();
  }
  const { pathname, search } = req.nextUrl;
  if (APP_ONLY.test(pathname)) return NextResponse.redirect(`${appUrl()}${pathname}${search}`);
  if (PASS_THROUGH.test(pathname)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/site/${hostname}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
