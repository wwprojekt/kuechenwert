import { useQuery } from "@tanstack/react-query";
import { callFunction } from "@/features/marketplace/api-client";

/** Zahl der aktiven Studios, deren Einzugsgebiet die PLZ abdeckt (null bis zur Antwort oder bei Fehlern). */
export function useStudioCoverage(postalCode: string): number | null {
  const valid = /^\d{5}$/.test(postalCode);
  const { data } = useQuery({
    queryKey: ["studio-coverage", postalCode],
    queryFn: () => callFunction<{ studios: number }>("kw-lead", { action: "coverage", postal_code: postalCode }),
    enabled: valid,
    staleTime: 10 * 60_000,
    retry: false,
  });
  return valid && typeof data?.studios === "number" ? data.studios : null;
}
