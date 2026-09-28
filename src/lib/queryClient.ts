import { QueryClient } from "@tanstack/react-query";

/**
 * Gemeinsamer QueryClient. AuthContext leert ihn beim Abmelden und beim
 * Kontowechsel, damit ein zweites Konto im selben Tab keine Daten des
 * vorherigen aus dem Cache sieht.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Admin-Seiten laufen mit ~25 Abfragen; Neuladen bei jedem Tab-Wechsel
      // hat sichtbar geruckelt. Einzelne Abfragen aktivieren es selbst.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      gcTime: 4 * 1000,
    },
  },
});
