import { useEffect, useRef, useCallback } from "react";

interface UseLiveDataOptions {
  /** Polling interval in ms. Default: 30000 (30s). Set to 0 to disable. */
  pollingInterval?: number;
  /** Enable refetch on window focus / visibility change. Default: true */
  refetchOnFocus?: boolean;
  /** Whether the hook is enabled. Default: true */
  enabled?: boolean;
}

/**
 * Hook that keeps data fresh via focus-refetch and optional polling.
 * Wraps a fetch function and calls it:
 * - On mount
 * - When the browser tab regains focus (debounced to prevent double-fire)
 * - On a configurable polling interval (default 30s)
 *
 * Usage:
 *   const { refresh } = useLiveData(loadMyData, { enabled: !!user });
 */
export function useLiveData(
  fetchFn: () => void | Promise<void>,
  options: UseLiveDataOptions = {}
) {
  const {
    pollingInterval = 30_000,
    refetchOnFocus = true,
    enabled = true,
  } = options;

  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const lastFetchRef = useRef(0);

  const stableFetch = useCallback(() => fetchRef.current(), []);

  // Debounced fetch: prevents double-fire from focus + visibilitychange
  const debouncedFetch = useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current < 2_000) return;
    lastFetchRef.current = now;
    stableFetch();
  }, [stableFetch]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      lastFetchRef.current = Date.now();
      stableFetch();
    }
  }, [enabled, stableFetch]);

  // Focus / visibility refetch
  useEffect(() => {
    if (!enabled || !refetchOnFocus) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") debouncedFetch();
    };

    window.addEventListener("focus", debouncedFetch);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", debouncedFetch);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, refetchOnFocus, debouncedFetch]);

  // Polling
  useEffect(() => {
    if (!enabled || !pollingInterval) return;
    const interval = setInterval(() => {
      lastFetchRef.current = Date.now();
      stableFetch();
    }, pollingInterval);
    return () => clearInterval(interval);
  }, [enabled, pollingInterval, stableFetch]);

  return { refresh: stableFetch };
}
