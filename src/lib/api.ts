import "server-only";

import type { NextRequest } from "next/server";
import { currentViewer, type Viewer } from "@/lib/auth";

/**
 * Wraps a page's data loader as a GET route handler. Checks the session, hands
 * the loader the viewer and the query string, and turns anything thrown into
 * a structured JSON error. Nothing here redirects: the client decides what to
 * do with a 401.
 */
export function pageData<T>(
  load: (viewer: Viewer, query: URLSearchParams) => Promise<T>,
  options: { admin?: boolean } = {},
): (request: NextRequest) => Promise<Response> {
  return async function GET(request: NextRequest) {
    try {
      const viewer = await currentViewer();
      if (!viewer) {
        return Response.json(
          { error: "unauthenticated", message: "Sign in to continue." },
          { status: 401 },
        );
      }
      if (options.admin && !viewer.isAdmin) {
        return Response.json(
          {
            error: "forbidden",
            message: "Only the household admin can see this.",
          },
          { status: 403 },
        );
      }
      const data = await load(viewer, request.nextUrl.searchParams);
      return Response.json(data, {
        headers: { "cache-control": "no-store" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("page data failed", {
        path: request.nextUrl.pathname,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return Response.json(
        {
          error: "internal",
          message: "Something went wrong loading this page.",
        },
        { status: 500 },
      );
    }
  };
}
