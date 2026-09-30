import { analyticsService } from "@/lib/analyticsService";
import type { FunnelId } from "@/lib/funnelRoutes";

/**
 * Virtueller Aufruf der Danke-Seite, wenn ein Funnel nach dem Absenden nicht
 * dorthin navigiert (Funnel A → Projektseite, Funnel C → Ergebnis im Planer).
 * Die Remarketing-Listen erkennen Anfragen an „/funnel/danke“; ohne diesen
 * Aufruf bekämen Kunden mit Anfrage weiter „Kommen Sie zurück“-Anzeigen.
 * Google-Tag und eigene Statistik respektieren die Einwilligung selbst.
 */
export function trackLeadThankYou(funnel: Exclude<FunnelId, "b">): void {
  analyticsService.trackPageView(`/funnel/danke?funnel=${funnel}`, "Anfrage gesendet");
}
