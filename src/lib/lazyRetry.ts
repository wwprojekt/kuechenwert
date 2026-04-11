/**
 * Wrapper around React.lazy that retries failed dynamic imports.
 * After a deployment, old chunk filenames no longer exist on the server.
 * This utility catches the "Failed to fetch dynamically imported module" error,
 * clears all Service Worker caches, forces a SW update, and reloads the page
 * to get fresh HTML with updated chunk references.
 *
 * v2 (2026-04-02): Added cache-busting before reload to prevent the Service Worker
 * from serving a stale index.html that still references old chunk hashes.
 */
import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk_reload_attempted";

/**
 * Clear all Service Worker caches and force an update.
 * This ensures the next page load fetches a fresh index.html from the network
 * instead of getting a stale cached version from the Service Worker.
 */
async function clearServiceWorkerCaches(): Promise<void> {
  try {
    // 1. Delete all Cache Storage entries
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      if (import.meta.env.DEV) console.log("[lazyRetry] Cleared all SW caches:", cacheNames);
    }

    // 2. Force Service Worker to check for updates
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        if (import.meta.env.DEV) console.log("[lazyRetry] Triggered SW update check");

        // If there's a waiting worker, activate it immediately
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          if (import.meta.env.DEV) console.log("[lazyRetry] Activated waiting SW");
        }
      }
    }
  } catch (err) {
    // Non-critical: if cache clearing fails, the reload might still work
    console.warn("[lazyRetry] Error clearing caches:", err);
  }
}

export function lazyRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      // Check if this is a chunk loading error
      const isChunkError =
        error instanceof Error &&
        (error.message.includes("Failed to fetch dynamically imported module") ||
          error.message.includes("Loading chunk") ||
          error.message.includes("Loading CSS chunk") ||
          error.message.includes("Importing a module script failed") ||
          error.message.includes("error loading dynamically imported module"));

      if (isChunkError) {
        // Only attempt one reload to avoid infinite loops
        const hasReloaded = sessionStorage.getItem(RELOAD_KEY);
        if (!hasReloaded) {
          sessionStorage.setItem(RELOAD_KEY, "true");

          // Clear all SW caches before reloading to ensure fresh index.html
          await clearServiceWorkerCaches();

          window.location.reload();
          // Return a never-resolving promise to prevent rendering while reloading
          return new Promise(() => {});
        }
        // Already reloaded once, clear flag and let error propagate
        sessionStorage.removeItem(RELOAD_KEY);
      }
      throw error;
    }
  });
}

/**
 * Clear the reload flag on successful page load.
 * Call this once in your app root (e.g., App.tsx useEffect).
 */
export function clearChunkReloadFlag() {
  sessionStorage.removeItem(RELOAD_KEY);
}
