"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client-side page data. Every page is a static shell that asks its API route
 * for JSON; this hook does the asking, keeps the last answer for each URL so a
 * page you have already seen paints instantly, and refetches in the background.
 *
 * Any mutation calls `invalidateData()` when it is done, which makes every
 * mounted hook fetch again.
 */

type Entry = { data: unknown; at: number };

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

/** Bumps every mounted `useClientData` so it fetches fresh data. */
export function invalidateData(): void {
  for (const listener of listeners) listener();
}

/** Forgets everything, for sign-out. */
export function clearData(): void {
  cache.clear();
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Not JSON; the status text will do.
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}

export type ClientData<T> = {
  data: T | null;
  error: string | null;
  /** True only while there is nothing to show yet. */
  loading: boolean;
  /** True whenever a fetch is in flight, including background refreshes. */
  refreshing: boolean;
  refresh: () => void;
};

/** What the hook knows about one URL. `settled` is false while a fetch runs. */
type Snapshot<T> = {
  url: string | null;
  data: T | null;
  error: string | null;
  settled: boolean;
};

function fromCache<T>(url: string | null): Snapshot<T> {
  const hit = url ? cache.get(url) : undefined;
  return {
    url,
    data: hit ? (hit.data as T) : null,
    error: null,
    settled: !url,
  };
}

export function useClientData<T>(url: string | null): ClientData<T> {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => fromCache<T>(url));
  const [version, setVersion] = useState(0);
  const latest = useRef(0);

  // A URL change is answered from the cache at once, without waiting for an
  // effect; the fetch below then brings it up to date.
  const current = snapshot.url === url ? snapshot : fromCache<T>(url);

  const refresh = useCallback(() => {
    setSnapshot((previous) => ({ ...previous, settled: false }));
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!url) return;
    const ticket = ++latest.current;
    let cancelled = false;

    (async () => {
      try {
        const fresh = await fetchJson<T>(url);
        if (cancelled || ticket !== latest.current) return;
        cache.set(url, { data: fresh, at: Date.now() });
        setSnapshot({ url, data: fresh, error: null, settled: true });
      } catch (caught) {
        if (cancelled || ticket !== latest.current) return;
        if (caught instanceof ApiError && caught.status === 401) {
          clearData();
          router.replace("/login");
          return;
        }
        const message = caught instanceof Error ? caught.message : String(caught);
        console.error("page data failed", { url, error: message });
        setSnapshot((previous) => ({
          url,
          data: previous.url === url ? previous.data : fromCache<T>(url).data,
          error: message,
          settled: true,
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, version, router]);

  // Coming back to the tab after a while should show the current state.
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [refresh]);

  return {
    data: current.data,
    error: current.error,
    loading: current.data === null && current.error === null,
    refreshing: Boolean(url) && !current.settled,
    refresh,
  };
}
