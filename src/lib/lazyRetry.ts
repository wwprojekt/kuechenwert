/**
 * Wrapper around React.lazy that retries failed dynamic imports.
 * After a deployment, old chunk filenames no longer exist on the server.
 * This utility catches the "Failed to fetch dynamically imported module" error,
 * reloads the page once to get fresh HTML with updated chunk references.
 */
import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk_reload_attempted";

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
          error.message.includes("Importing a module script failed"));

      if (isChunkError) {
        // Only attempt one reload to avoid infinite loops
        const hasReloaded = sessionStorage.getItem(RELOAD_KEY);
        if (!hasReloaded) {
          sessionStorage.setItem(RELOAD_KEY, "true");
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
