/**
 * Dealer Instant-Buy Alert Card
 *
 * UI-Card fuer den Sofortkauf-Suchagent. Haendler konfigurieren hier
 * Filter (Preis, Hersteller, Aufbauart, Land, Baujahr, Kilometer) und
 * erhalten alle 15 Minuten eine Email, sobald ein neues Sofortkauf-
 * Listing den Filter matcht (siehe Edge Function `send-instant-buy-alert`).
 *
 * Der Toggle "Sofortkauf-Alerts aktivieren" ist orthogonal zum normalen
 * `email_new_auction`-Toggle in NotificationPreferences:
 *   - email_new_auction=true + alert enabled=false  => Digest nur via
 *     send-dealer-auction-digest (Tages-/Wochen-Zusammenfassung)
 *   - email_new_auction=true + alert enabled=true   => zusaetzlich
 *     Echtzeit-Alert bei passendem Sofortkauf-Listing
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BellRing, Zap } from "lucide-react";
import {
  popularManufacturers,
  wohnwagenManufacturers,
  bodyTypes,
  wohnwagenBodyTypes,
} from "@/lib/vehicle-data";

const COUNTRY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "CH", label: "Schweiz" },
  { code: "NL", label: "Niederlande" },
  { code: "FR", label: "Frankreich" },
  { code: "IT", label: "Italien" },
  { code: "ES", label: "Spanien" },
  { code: "BE", label: "Belgien" },
  { code: "LU", label: "Luxemburg" },
  { code: "DK", label: "Dänemark" },
  { code: "PL", label: "Polen" },
];

interface AlertRow {
  enabled: boolean;
  min_price: number | null;
  max_price: number | null;
  manufacturers: string[];
  body_types: string[];
  countries: string[];
  min_year: number | null;
  max_year: number | null;
  max_mileage: number | null;
}

const DEFAULT_STATE: AlertRow = {
  enabled: true,
  min_price: null,
  max_price: null,
  manufacturers: [],
  body_types: [],
  countries: ["DE"],
  min_year: null,
  max_year: null,
  max_mileage: null,
};

function toOptionalInt(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toOptionalNumber(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface MultiSelectChipsProps {
  options: readonly string[] | string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}

const MultiSelectChips = ({ options, selected, onChange, emptyLabel }: MultiSelectChipsProps) => {
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((x) => x !== val));
    } else {
      onChange([...selected, val]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {selected.length === 0 && emptyLabel && (
        <span className="text-xs text-muted-foreground italic">{emptyLabel}</span>
      )}
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={
              "text-xs px-2.5 py-1 rounded-full border transition-colors " +
              (active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted")
            }
            aria-pressed={active}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
};

export const DealerInstantBuyAlertCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const manufacturerOptions = useMemo(
    () => Array.from(new Set([...popularManufacturers, ...wohnwagenManufacturers])).sort(),
    []
  );
  const bodyTypeOptions = useMemo(
    () => Array.from(new Set([...bodyTypes, ...wohnwagenBodyTypes])),
    []
  );

  const [state, setState] = useState<AlertRow>(DEFAULT_STATE);

  const { data, isLoading } = useQuery({
    queryKey: ["dealer-instant-buy-alerts", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("dealer_instant_buy_alerts")
        .select(
          "enabled, min_price, max_price, manufacturers, body_types, countries, min_year, max_year, max_mileage"
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as AlertRow | null;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (data) {
      setState({
        enabled: data.enabled ?? true,
        min_price: data.min_price,
        max_price: data.max_price,
        manufacturers: data.manufacturers ?? [],
        body_types: data.body_types ?? [],
        countries: data.countries ?? ["DE"],
        min_year: data.min_year,
        max_year: data.max_year,
        max_mileage: data.max_mileage,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: AlertRow) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("dealer_instant_buy_alerts")
        .upsert(
          {
            user_id: user.id,
            enabled: next.enabled,
            min_price: next.min_price,
            max_price: next.max_price,
            manufacturers: next.manufacturers,
            body_types: next.body_types,
            countries: next.countries,
            min_year: next.min_year,
            max_year: next.max_year,
            max_mileage: next.max_mileage,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealer-instant-buy-alerts", user?.id] });
      toast({
        title: "Sofortkauf-Alert gespeichert",
        description: state.enabled
          ? "Sie erhalten ab jetzt passende Sofortkauf-Listings per Email (max. alle 15 Min)."
          : "Der Alert ist deaktiviert. Keine Email-Benachrichtigungen bei neuen Sofortkauf-Listings.",
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({
        title: "Fehler beim Speichern",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const hasAnyFilter =
    state.min_price != null ||
    state.max_price != null ||
    state.manufacturers.length > 0 ||
    state.body_types.length > 0 ||
    state.min_year != null ||
    state.max_year != null ||
    state.max_mileage != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Sofortkauf-Alert (Suchagent)
          <Badge variant="secondary" className="ml-2 text-[10px] uppercase tracking-wide">
            Alle 15 Min
          </Badge>
        </CardTitle>
        <CardDescription>
          Erhalten Sie eine Email, sobald ein neues Sofortkauf-Inserat Ihre Filter erfüllt.
          Ein leerer Filter bedeutet "alles erlaubt". Die Zustellung respektiert Ihre Ruhezeiten.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  <BellRing className="h-4 w-4" />
                  Sofortkauf-Alerts aktivieren
                </div>
                <div className="text-sm text-muted-foreground">
                  Schaltet den Suchagent global an oder aus.
                </div>
              </div>
              <Switch
                checked={state.enabled}
                onCheckedChange={(enabled) => setState((s) => ({ ...s, enabled }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ib-min-price">Mindestpreis (€)</Label>
                <Input
                  id="ib-min-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={500}
                  value={state.min_price ?? ""}
                  onChange={(e) =>
                    setState((s) => ({ ...s, min_price: toOptionalNumber(e.target.value) }))
                  }
                  placeholder="z. B. 20000"
                  disabled={!state.enabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ib-max-price">Höchstpreis (€)</Label>
                <Input
                  id="ib-max-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={500}
                  value={state.max_price ?? ""}
                  onChange={(e) =>
                    setState((s) => ({ ...s, max_price: toOptionalNumber(e.target.value) }))
                  }
                  placeholder="z. B. 80000"
                  disabled={!state.enabled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hersteller</Label>
              <p className="text-xs text-muted-foreground">
                {state.manufacturers.length === 0
                  ? "Kein Filter = alle Hersteller."
                  : `${state.manufacturers.length} ausgewählt`}
              </p>
              <div className={state.enabled ? "" : "opacity-50 pointer-events-none"}>
                <MultiSelectChips
                  options={manufacturerOptions}
                  selected={state.manufacturers}
                  onChange={(manufacturers) => setState((s) => ({ ...s, manufacturers }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Aufbauart</Label>
              <p className="text-xs text-muted-foreground">
                {state.body_types.length === 0
                  ? "Kein Filter = alle Aufbauten."
                  : `${state.body_types.length} ausgewählt`}
              </p>
              <div className={state.enabled ? "" : "opacity-50 pointer-events-none"}>
                <MultiSelectChips
                  options={bodyTypeOptions}
                  selected={state.body_types}
                  onChange={(body_types) => setState((s) => ({ ...s, body_types }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Länder</Label>
              <p className="text-xs text-muted-foreground">
                {state.countries.length === 0
                  ? "Kein Filter = alle Länder."
                  : `${state.countries.length} ausgewählt`}
              </p>
              <div className={state.enabled ? "" : "opacity-50 pointer-events-none"}>
                <MultiSelectChips
                  options={COUNTRY_OPTIONS.map((c) => c.code)}
                  selected={state.countries}
                  onChange={(countries) => setState((s) => ({ ...s, countries }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ib-min-year">Baujahr ab</Label>
                <Input
                  id="ib-min-year"
                  type="number"
                  inputMode="numeric"
                  min={1970}
                  max={2100}
                  value={state.min_year ?? ""}
                  onChange={(e) =>
                    setState((s) => ({ ...s, min_year: toOptionalInt(e.target.value) }))
                  }
                  placeholder="z. B. 2015"
                  disabled={!state.enabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ib-max-year">Baujahr bis</Label>
                <Input
                  id="ib-max-year"
                  type="number"
                  inputMode="numeric"
                  min={1970}
                  max={2100}
                  value={state.max_year ?? ""}
                  onChange={(e) =>
                    setState((s) => ({ ...s, max_year: toOptionalInt(e.target.value) }))
                  }
                  placeholder="z. B. 2025"
                  disabled={!state.enabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ib-max-mileage">Max. Kilometer</Label>
                <Input
                  id="ib-max-mileage"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5000}
                  value={state.max_mileage ?? ""}
                  onChange={(e) =>
                    setState((s) => ({ ...s, max_mileage: toOptionalInt(e.target.value) }))
                  }
                  placeholder="z. B. 80000"
                  disabled={!state.enabled}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {hasAnyFilter
                  ? "Filter aktiv – nur passende Sofortkauf-Listings lösen eine Email aus."
                  : "Keine Filter gesetzt – Sie erhalten einen Alert für JEDEN neuen Sofortkauf."}
              </p>
              <Button
                onClick={() => save.mutate(state)}
                disabled={save.isPending}
                size="sm"
              >
                {save.isPending ? "Speichert…" : "Alert speichern"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DealerInstantBuyAlertCard;
