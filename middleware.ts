import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

function allowedEmails() {
  return (process.env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const authToken = process.env.AUTH_TOKEN;
  const hasAllowedEmails = allowedEmails().length > 0;
  const session = request.cookies.get("kjp_session")?.value;
  const email = authToken && session?.startsWith(`${authToken}:`) ? session.slice(authToken.length + 1).toLowerCase() : "";
  const authenticated = Boolean(authToken && hasAllowedEmails && email && allowedEmails().includes(email));

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  if (!authToken || !hasAllowedEmails) loginUrl.searchParams.set("error", "config");
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
