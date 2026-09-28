import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FAL_MODELS, falModel, type FalModelKind } from "../../../supabase/functions/_shared/fal-models.ts";

export const NONE = "__none__";

/** Auswahl aus der Modell-Registry; `emptyLabel` erlaubt „kein Modell“ (Wert null). */
export function ModelSelect({
  id,
  label,
  kind,
  value,
  onChange,
  emptyLabel,
  exclude,
  hint,
}: {
  id: string;
  label: string;
  kind: FalModelKind;
  value: string | null;
  onChange: (value: string | null) => void;
  emptyLabel?: string;
  exclude?: string | null;
  hint?: string;
}) {
  const selected = falModel(value, kind);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={selected?.id ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {FAL_MODELS.filter((m) => m.kind === kind && m.id !== exclude).map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.label} · {m.vendor} · ca. {(m.costCents / 100).toLocaleString("de-DE", { style: "currency", currency: "USD" })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{selected ? selected.note : hint}</p>
    </div>
  );
}
