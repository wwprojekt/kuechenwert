import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/features/marketplace/api-client";
import { QUALITY_LEVELS, labelOf } from "@/features/planner/core";
import { fetchAiSettings, fetchCalibration, fetchCalibrationRuns, recomputeCalibration, setPriceCalibrationEnabled, type CalibrationRow } from "./api";
import { PriceAccuracy } from "./PriceAccuracy";

function segmentLabel(segment: string): string {
  const [kind, value = ""] = segment.split(":");
  if (kind === "global") return "Gesamt";
  if (kind === "source") return value === "a" ? "Anfrageformular (A)" : "Traumküchen-Planer (C)";
  if (kind === "quality") return `Qualität ${labelOf(QUALITY_LEVELS, value)}`;
  return `PLZ-Region ${value}`;
}

const change = (factor: number | null) => {
  if (factor === null) return "–";
  const p = Math.round((factor - 1) * 100);
  return `${p > 0 ? "+" : ""}${p} %`;
};

export function PriceLearningCard() {
  const qc = useQueryClient();
  const calibration = useQuery({ queryKey: ["admin-price-calibration"], queryFn: fetchCalibration });
  const runs = useQuery({ queryKey: ["admin-price-calibration-runs"], queryFn: () => fetchCalibrationRuns(1) });
  const settings = useQuery({ queryKey: ["admin-ai-settings"], queryFn: fetchAiSettings });
  const enabled = settings.data?.price_calibration_enabled !== false;
  const refresh = () => {
    for (const key of ["admin-price-calibration", "admin-price-calibration-runs", "admin-ai-settings", "admin-ai-settings-history", "kw-price-model"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
  const recompute = useMutation({
    mutationFn: recomputeCalibration,
    onSuccess: (result) => {
      toast.success(`Neu berechnet aus ${result.observations} Ausschreibungen mit Angeboten.`);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      await setPriceCalibrationEnabled(next);
      return recomputeCalibration();
    },
    onSuccess: (_, next) => {
      toast.success(next ? "Marktabgleich an: Schätzungen folgen den Studio-Angeboten." : "Marktabgleich aus: Schätzungen nutzen nur die Preistabelle.");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const rows = calibration.data ?? [];
  const global = rows.find((r) => r.segment === "global");
  const learned = rows.filter((r) => r.segment !== "global" && r.sample_count > 0);
  const updated = rows.reduce<string | null>((max, r) => (!max || r.updated_at > max ? r.updated_at : max), null);
  const shown: CalibrationRow[] = [...(global ? [global] : []), ...learned];
  const busy = recompute.isPending || toggle.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Preis-Engine lernt aus Studio-Angeboten</CardTitle>
          <CardDescription>
            Jede Ausschreibung mit Angeboten vergleicht die Schätzung mit dem Median der Studiopreise. Mit wenigen Daten bleibt die
            Schätzung fast unverändert, mit vielen folgt sie dem Markt (Gesamtwirkung höchstens −30 % bis +45 %). Neuere Ausschreibungen und
            solche mit mehreren Angeboten zählen mehr. Täglich um 03:40 Uhr.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => recompute.mutate()} disabled={busy} className="flex-none">
          {recompute.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Jetzt neu berechnen
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-3">
          <div>
            <Label htmlFor="price-calibration-enabled">Marktabgleich anwenden</Label>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "Browser und Server rechnen mit den gelernten Faktoren."
                : "Aus: Schätzungen nutzen nur die Preistabelle. Gelernt und angezeigt wird weiter, damit Sie vor dem Einschalten sehen, was sich ändert."}
            </p>
          </div>
          <Switch
            id="price-calibration-enabled"
            checked={enabled}
            disabled={busy || !settings.data}
            onCheckedChange={(next) => toggle.mutate(next)}
          />
        </div>

        <PriceAccuracy run={runs.data?.[0]} />

        {calibration.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : calibration.isError ? (
          <p className="text-sm text-destructive">{errorMessage(calibration.error)}</p>
        ) : !global || global.sample_count === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Studio-Angebote ausgewertet – die Schätzung nutzt die Preistabelle. Mit jeder Ausschreibung lernt die Engine dazu.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bereich</TableHead>
                <TableHead className="text-right">Ausschreibungen</TableHead>
                <TableHead className="text-right">Angebote vs. Schätzung</TableHead>
                <TableHead className="text-right">Angewendet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.segment}>
                  <TableCell className="font-medium">{segmentLabel(r.segment)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.sample_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{change(r.observed_ratio)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{enabled ? change(r.factor) : "aus"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {updated && <p className="text-xs text-muted-foreground">Zuletzt berechnet: {new Date(updated).toLocaleString("de-DE")}</p>}
      </CardContent>
    </Card>
  );
}
