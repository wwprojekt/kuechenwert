import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Hash, MessageSquare, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MyKuechenJourney } from "@/components/dashboard/MyKuechenJourney";

/**
 * Kunden-Übersicht unter /dashboard: Begrüßung, Kundennummer, eigene
 * Küchenanfragen und Kontakt zum Support. Küchenstudios sehen stattdessen
 * DealerHome (siehe SmartDashboard).
 */
export default function DashboardOverview() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["dashboardProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;
      const { data } = await supabase
        .from("profiles")
        .select("customer_number, company_name, first_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const name = profile?.first_name || profile?.company_name;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-6 sm:p-8">
        <h1 className="mb-1 flex items-center gap-3 text-2xl font-bold text-foreground md:text-3xl">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg sm:h-12 sm:w-12">
            <Sparkles className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </span>
          {name ? `Hallo, ${name}!` : "Willkommen zurück!"}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Ihre Küchen-Anfragen und eingehende Studio-Angebote auf einen Blick.
        </p>
        {profile?.customer_number && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-1.5">
            <Hash className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Kundennr:</span>
            <span className="text-xs font-bold text-primary">{profile.customer_number}</span>
          </div>
        )}
      </div>

      <MyKuechenJourney />

      <Card className="border border-border/50 bg-muted/20">
        <CardContent className="flex items-start gap-3 p-4 sm:p-6">
          <div className="flex-shrink-0 rounded-lg bg-primary/10 p-2">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="mb-1 text-sm font-semibold">Haben Sie Fragen?</h2>
            <p className="text-xs text-muted-foreground">
              Nutzen Sie die Nachrichten-Funktion, um uns direkt zu kontaktieren. Wir helfen Ihnen
              gerne weiter.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2 gap-2">
              <Link to="/dashboard/messages">
                <MessageSquare className="h-3.5 w-3.5" />
                Nachricht schreiben
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
