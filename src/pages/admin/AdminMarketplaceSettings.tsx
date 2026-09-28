import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/features/marketplace/api-client";
import { fetchMarketplaceSettings, saveMarketplaceSettings, type MarketplaceSettings } from "@/features/marketplace/settings-api";

// Grenzen = CHECK-Constraints von kw_marketplace_settings
const formSchema = z.object({
  tenderDays: z.coerce.number().int().min(1, "Mindestens 1 Tag.").max(30, "Höchstens 30 Tage."),
  underbidDays: z.coerce.number().int().min(1, "Mindestens 1 Tag.").max(14, "Höchstens 14 Tage."),
  decisionDays: z.coerce.number().int().min(3, "Mindestens 3 Tage.").max(90, "Höchstens 90 Tage."),
  maxContacts: z.coerce.number().int().min(0, "Mindestens 0.").max(10, "Höchstens 10."),
  contactPriceEur: z.coerce.number().min(0, "Nicht negativ.").max(1000, "Höchstens 1.000 €."),
  radiusKm: z.coerce.number().int().min(10, "Mindestens 10 km.").max(500, "Höchstens 500 km."),
  minOfferPercent: z.coerce.number().int().min(5, "Mindestens 5 %.").max(100, "Höchstens 100 %."),
});

type FormValues = Record<keyof z.infer<typeof formSchema>, string>;
type Toggles = Pick<MarketplaceSettings, "auto_publish_funnel_a" | "auto_publish_funnel_c" | "auto_issue_invoices" | "bid_visibility">;

const FIELDS: Array<{ key: keyof FormValues; label: string; unit: string; hint: string }> = [
  { key: "tenderDays", label: "Angebotsphase (Anfrage, Traumküche)", unit: "Tage", hint: "So lange können Studios Angebote abgeben." },
  { key: "underbidDays", label: "Angebotsphase „Unterbieten“", unit: "Tage", hint: "Für Kund:innen mit vorhandenem Studio-Angebot." },
  { key: "decisionDays", label: "Entscheidungsfrist für Kund:innen", unit: "Tage", hint: "Danach läuft die Ausschreibung ohne Zuschlag ab." },
  { key: "maxContacts", label: "Kontaktkäufe je Projekt", unit: "Studios", hint: "0 schaltet den Kontaktkauf ab. AGB und Datenschutzerklärung nennen höchstens drei – bei Erhöhung dort anpassen." },
  { key: "contactPriceEur", label: "Kontaktpreis ohne passende Preisregel", unit: "€ netto", hint: "Gilt nur, wenn keine Regel aus der Preisliste greift." },
  { key: "radiusKm", label: "Standard-Umkreis neuer Studios", unit: "km", hint: "Studios passen ihn im Portal selbst an." },
  { key: "minOfferPercent", label: "Mindestangebot", unit: "% der Schätzung", hint: "Schützt vor unrealistischen Lockangeboten." },
];

function toForm(s: MarketplaceSettings): FormValues {
  return {
    tenderDays: String(Math.round(s.tender_duration_hours / 24)),
    underbidDays: String(Math.round(s.tender_duration_hours_unterbieten / 24)),
    decisionDays: String(s.decision_window_days),
    maxContacts: String(s.max_contact_purchases),
    contactPriceEur: String(s.contact_price_fallback_cents / 100),
    radiusKm: String(s.default_service_radius_km),
    minOfferPercent: String(Math.round(s.min_offer_ratio * 100)),
  };
}

export default function AdminMarketplaceSettings() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin-marketplace-settings"], queryFn: fetchMarketplaceSettings });
  const [form, setForm] = useState<FormValues | null>(null);
  const [toggles, setToggles] = useState<Toggles | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  useEffect(() => {
    if (!settings.data) return;
    setForm(toForm(settings.data));
    const { auto_publish_funnel_a, auto_publish_funnel_c, auto_issue_invoices, bid_visibility } = settings.data;
    setToggles({ auto_publish_funnel_a, auto_publish_funnel_c, auto_issue_invoices, bid_visibility });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: saveMarketplaceSettings,
    onSuccess: () => {
      toast.success("Marktplatz-Einstellungen gespeichert.");
      void qc.invalidateQueries({ queryKey: ["admin-marketplace-settings"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (settings.isLoading || !form || !toggles) {
    return settings.isError ? (
      <p className="text-sm text-destructive">{errorMessage(settings.error)}</p>
    ) : (
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    );
  }

  const onSave = () => {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    const v = parsed.data;
    save.mutate({
      ...toggles,
      tender_duration_hours: v.tenderDays * 24,
      tender_duration_hours_unterbieten: v.underbidDays * 24,
      decision_window_days: v.decisionDays,
      max_contact_purchases: v.maxContacts,
      contact_price_fallback_cents: Math.round(v.contactPriceEur * 100),
      default_service_radius_km: v.radiusKm,
      min_offer_ratio: v.minOfferPercent / 100,
    });
  };

  const toggle = (key: keyof Omit<Toggles, "bid_visibility">, label: string, hint: string) => (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={key}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={key} checked={toggles[key]} onCheckedChange={(v) => setToggles({ ...toggles, [key]: v })} />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marktplatz-Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Gelten für neue Ausschreibungen; laufende behalten ihre Fristen.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fristen, Kontakte und Preise</CardTitle>
          <CardDescription>Zulässige Bereiche prüft auch die Datenbank.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <div className="flex items-center gap-2">
                <Input id={f.key} inputMode="decimal" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-28" />
                <span className="text-sm text-muted-foreground">{f.unit}</span>
              </div>
              {errors[f.key] ? <p className="text-xs text-destructive">{errors[f.key]}</p> : <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="bid_visibility">Angebote für Studios</Label>
            <Select value={toggles.bid_visibility} onValueChange={(v) => setToggles({ ...toggles, bid_visibility: v as Toggles["bid_visibility"] })}>
              <SelectTrigger id="bid_visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lowest_price">Bestes Angebot sichtbar</SelectItem>
                <SelectItem value="sealed">Verdeckt</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Ob Studios das aktuell niedrigste Angebot sehen.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automatik</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {toggle("auto_publish_funnel_a", "Anfragen sofort veröffentlichen", "Aus: Jede Anfrage wartet im Admin auf Freigabe.")}
          {toggle("auto_publish_funnel_c", "Traumküchen-Projekte sofort veröffentlichen", "Aus: Freigabe im Admin nötig.")}
          {toggle("auto_issue_invoices", "Rechnungen automatisch versenden", "Aus: Rechnungen bleiben als Entwurf unter Finanzen zur Prüfung.")}
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Speichern
      </Button>
    </div>
  );
}
