import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";

/**
 * An optimistic gate only: it reads the signed cookie and nothing else, so it
 * stays cheap on prefetched routes. It also keeps each role on its own
 * surface, which lets the layouts be static shells. Every page's data route
 * and every server action re-checks the real user against the database.
 */
const PUBLIC_PATHS = new Set(["/login"]);

/** The employee surface; anything else that is not /admin is shared. */
const EMPLOYEE_PREFIXES = ["/today", "/tasks", "/menu", "/recipes", "/groceries"];

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (!session) {
    if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  const home = session.role === "admin" ? "/admin" : "/today";

  if (PUBLIC_PATHS.has(pathname) || pathname === "/") {
    return NextResponse.redirect(new URL(home, request.nextUrl));
  }
  if (under(pathname, "/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL(home, request.nextUrl));
  }
  if (
    session.role === "admin" &&
    EMPLOYEE_PREFIXES.some((prefix) => under(pathname, prefix))
  ) {
    return NextResponse.redirect(new URL(home, request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except API routes, static files and the manifest.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
