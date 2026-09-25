import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPinned } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/features/marketplace/api-client";
import { fetchMarketProfile, saveMarketProfile, type MarketProfile } from "@/features/marketplace/dealer-api";

export default function DealerMarketSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["dealer-market-profile", user?.id], queryFn: () => fetchMarketProfile(user!.id), enabled: !!user?.id });
  const companyZip = useQuery({
    queryKey: ["dealer-company-zip", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("company_zip").eq("id", user!.id).maybeSingle();
      return (data?.company_zip ?? "").replace(/\D/g, "").slice(0, 5);
    },
    enabled: !!user?.id,
  });

  const [form, setForm] = useState<MarketProfile | null>(null);

  useEffect(() => {
    if (!user?.id || form || !query.isSuccess || !companyZip.isSuccess) return;
    setForm(
      query.data ?? {
        dealer_id: user.id,
        service_postal_code: companyZip.data || null,
        service_radius_km: 80,
        notify_new_projects: true,
        min_project_value_eur: null,
        offer_intro: null,
      },
    );
  }, [user?.id, form, query.isSuccess, query.data, companyZip.isSuccess, companyZip.data]);

  const save = useMutation({
    mutationFn: (p: MarketProfile) => saveMarketProfile(p),
    onSuccess: () => {
      toast.success("Einstellungen gespeichert.");
      void qc.invalidateQueries({ queryKey: ["dealer-market-profile"] });
      void qc.invalidateQueries({ queryKey: ["dealer-projects"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!form) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const plzValid = !form.service_postal_code || /^\d{5}$/.test(form.service_postal_code);

  return (
    <div className="max-w-2xl space-y-6">
      <Link to="/dashboard/projekte" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zur Projekt-Börse
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <MapPinned className="h-6 w-6 text-primary" /> Einzugsgebiet & Benachrichtigungen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Bestimmt, welche Projekte Sie in der Projekt-Börse sehen und worüber wir Sie per E-Mail informieren.</p>
      </div>

      <form
        className="space-y-6 rounded-2xl border bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (plzValid) save.mutate({ ...form, offer_intro: form.offer_intro?.trim() || null });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="service_plz">PLZ Ihres Studios</Label>
            <Input
              id="service_plz"
              inputMode="numeric"
              maxLength={5}
              value={form.service_postal_code ?? ""}
              onChange={(e) => setForm({ ...form, service_postal_code: e.target.value.replace(/\D/g, "").slice(0, 5) || null })}
              className="h-11"
            />
            {!plzValid && <p className="text-xs text-destructive">Bitte eine 5-stellige PLZ angeben.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min_value">Mindest-Projektwert (optional)</Label>
            <div className="relative">
              <Input
                id="min_value"
                inputMode="numeric"
                value={form.min_project_value_eur ?? ""}
                onChange={(e) => setForm({ ...form, min_project_value_eur: Number(e.target.value.replace(/\D/g, "")) || null })}
                className="h-11 pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Umkreis</Label>
            <span className="text-sm font-semibold tabular-nums">{form.service_radius_km} km</span>
          </div>
          <Slider min={10} max={300} step={5} value={[form.service_radius_km]} onValueChange={([v]) => setForm({ ...form, service_radius_km: v ?? 80 })} />
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
          <span>
            <span className="block text-sm font-semibold">E-Mail bei neuen Projekten</span>
            <span className="block text-xs text-muted-foreground">Sofort benachrichtigt werden, wenn ein Projekt in Ihrem Umkreis startet.</span>
          </span>
          <Switch checked={form.notify_new_projects} onCheckedChange={(v) => setForm({ ...form, notify_new_projects: v })} />
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="intro">Standard-Vorstellung für Angebote</Label>
          <Textarea
            id="intro"
            rows={5}
            maxLength={1500}
            value={form.offer_intro ?? ""}
            onChange={(e) => setForm({ ...form, offer_intro: e.target.value })}
            placeholder="z. B. Seit 1998 planen wir Küchen in Hannover – Marken Häcker & Nolte, eigener Montageservice, Ausstellung mit 25 Küchen …"
          />
          <p className="text-xs text-muted-foreground">Wird in neue Angebote vorausgefüllt und Kunden bei Ihrem Angebot angezeigt.</p>
        </div>

        <Button type="submit" size="lg" disabled={save.isPending || !plzValid}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Speichern
        </Button>
      </form>
    </div>
  );
}
