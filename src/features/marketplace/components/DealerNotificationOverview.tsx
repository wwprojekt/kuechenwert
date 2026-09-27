import { useQuery } from "@tanstack/react-query";
import { BellRing, Check, Loader2, MapPinned } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMarketProfile } from "../dealer-api";

const ALWAYS_SENT = [
  "Zuschlag mit den Kontaktdaten des Kunden",
  "Absage, wenn sich ein Kunde anders entschieden hat",
  "Nächste Schritte und Erinnerungen zu Ihren Aufträgen",
  "Rechnungen und Zahlungserinnerungen",
];

/**
 * Der Schalter für neue Projekte lebt nur auf der Einzugsgebiet-Seite, weil er
 * dort zusammen mit Umkreis und Mindest-Projektwert gespeichert wird.
 */
export function DealerNotificationOverview() {
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ["dealer-market-profile", user?.id],
    queryFn: () => fetchMarketProfile(user!.id),
    enabled: !!user?.id,
  });
  const notify = profile.data?.notify_new_projects ?? true;
  const area = profile.data?.service_postal_code
    ? `Umkreis ${profile.data.service_radius_km} km um ${profile.data.service_postal_code}.`
    : "Noch nicht angepasst: Wir nutzen die PLZ Ihrer Firmenadresse und den Standard-Umkreis.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" /> Benachrichtigungen zu Kundenprojekten
        </CardTitle>
        <CardDescription>Alle Projekte und den Stand Ihrer Angebote sehen Sie zusätzlich jederzeit in der Projekt-Börse.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              Neue Projekte in Ihrem Einzugsgebiet
              {profile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Badge variant={notify ? "default" : "secondary"}>{notify ? "E-Mail an" : "E-Mail aus"}</Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{area}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/dashboard/projekte/einstellungen">
              <MapPinned className="mr-2 h-4 w-4" /> Einzugsgebiet ändern
            </Link>
          </Button>
        </div>

        <div>
          <p className="text-sm font-semibold">Immer per E-Mail</p>
          <ul className="mt-2 space-y-1.5">
            {ALWAYS_SENT.map((text) => (
              <li key={text} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {text}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
