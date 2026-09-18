import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";

/**
 * An optimistic gate only: it reads the signed cookie and nothing else, so it
 * stays cheap on prefetched routes. Every page and server action re-checks the
 * real user against the database.
 */
const PUBLIC_PATHS = new Set(["/login"]);

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (!session && !PUBLIC_PATHS.has(pathname)) {
    const url = new URL("/login", request.nextUrl);
    return NextResponse.redirect(url);
  }

  if (session && PUBLIC_PATHS.has(pathname)) {
    const url = new URL(session.role === "admin" ? "/admin" : "/today", request.nextUrl);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except API routes, static files and the manifest.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
