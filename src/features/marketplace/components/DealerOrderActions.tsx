import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CANCEL_REASON_LABELS, canReportCancellation, dealerNextSteps, type CancelReason, type Order, type OrderStep } from "../order";

export interface OrderUpdateInput {
  step: OrderStep;
  at?: string | null;
  valueEur?: number | null;
  reason?: CancelReason | null;
  note?: string | null;
}

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

function stepLabel(step: OrderStep, order: Order): string {
  switch (step) {
    case "contacted":
      return "Kontakt aufgenommen";
    case "measurement":
      return order.measurement_at ? "Aufmaß-Termin ändern" : "Aufmaß-Termin eintragen";
    case "contract":
      return "Kaufvertrag erfassen";
    case "installation":
      return order.installation_at ? "Montagetermin ändern" : "Montagetermin eintragen";
    case "completed":
      return "Montage abgeschlossen";
    case "cancelled":
      return "Auftrag kam nicht zustande";
    case "note":
      return "Notiz hinzufügen";
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO-Zeitpunkt als Wert für <input type="date"> bzw. "datetime-local" (lokale Zeit). */
function toInputValue(iso: string | null, withTime: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

const fromInputValue = (value: string, withTime: boolean) => (value ? new Date(withTime ? value : `${value}T00:00`).toISOString() : null);

function StepForm(props: { title: string; hint?: string; submitLabel: string; pending: boolean; valid: boolean; destructive?: boolean; onSubmit: () => void; children?: ReactNode }) {
  return (
    <form
      className="space-y-3 rounded-xl border bg-muted/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (props.valid) props.onSubmit();
      }}
    >
      <p className="text-sm font-semibold">{props.title}</p>
      {props.children}
      {props.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
      <Button type="submit" size="sm" variant={props.destructive ? "destructive" : "default"} disabled={props.pending || !props.valid}>
        {props.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {props.submitLabel}
      </Button>
    </form>
  );
}

/** Nächste Etappen, Notiz und Absage für das beauftragte Studio. */
export function DealerOrderActions({ order, pending, onSubmit }: { order: Order; pending: boolean; onSubmit: (input: OrderUpdateInput) => void }) {
  const steps = dealerNextSteps(order);
  const [open, setOpen] = useState<OrderStep | null>(steps[0] ?? null);
  const [measurementAt, setMeasurementAt] = useState(toInputValue(order.measurement_at, true));
  const [contractValue, setContractValue] = useState(order.contract_value_eur ? String(order.contract_value_eur) : "");
  const [contractDate, setContractDate] = useState(toInputValue(new Date().toISOString(), false));
  const [installationDate, setInstallationDate] = useState(toInputValue(order.installation_at, false));
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<CancelReason | "">("");

  const contractNumber = Number(contractValue.replace(",", "."));
  const toggle = (step: OrderStep) => setOpen((current) => (current === step ? null : step));

  if (steps.length === 0 && !canReportCancellation(order)) return null;

  return (
    <div className="mt-5 space-y-3 border-t pt-4">
      {steps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {steps.map((step, i) => (
            <Button key={step} size="sm" variant={open === step ? "default" : i === 0 ? "secondary" : "outline"} onClick={() => toggle(step)}>
              {stepLabel(step, order)}
            </Button>
          ))}
        </div>
      )}

      {open === "contacted" && (
        <StepForm title="Kontakt aufgenommen?" hint="Sie haben die Kundin bzw. den Kunden erreicht und das weitere Vorgehen besprochen." submitLabel="Speichern" pending={pending} valid onSubmit={() => onSubmit({ step: "contacted" })} />
      )}

      {open === "measurement" && (
        <StepForm title="Termin für das Aufmaß" hint="Die Kundin bzw. der Kunde erhält den Termin per E-Mail." submitLabel="Termin speichern" pending={pending} valid={!!measurementAt} onSubmit={() => onSubmit({ step: "measurement", at: fromInputValue(measurementAt, true) })}>
          <Label htmlFor="order-measurement" className="sr-only">Termin für das Aufmaß</Label>
          <Input id="order-measurement" type="datetime-local" required value={measurementAt} onChange={(e) => setMeasurementAt(e.target.value)} />
        </StepForm>
      )}

      {open === "contract" && (
        <StepForm
          title="Kaufvertrag erfassen"
          hint={`Angenommenes Angebot: ${euro(order.offer_price_eur)}. Tragen Sie den tatsächlichen Auftragswert laut Kaufvertrag ein – er ist Grundlage der Provisionsabrechnung.`}
          submitLabel="Kaufvertrag speichern"
          pending={pending}
          valid={Number.isFinite(contractNumber) && contractNumber >= 500 && !!contractDate}
          onSubmit={() => onSubmit({ step: "contract", valueEur: contractNumber, at: fromInputValue(contractDate, false) })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-contract-value">Auftragswert brutto (€)</Label>
              <Input id="order-contract-value" inputMode="decimal" required value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder={String(Math.round(order.offer_price_eur))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-contract-date">Unterschrieben am</Label>
              <Input id="order-contract-date" type="date" required value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
            </div>
          </div>
        </StepForm>
      )}

      {open === "installation" && (
        <StepForm title="Montagetermin" hint="Die Kundin bzw. der Kunde erhält den Termin per E-Mail." submitLabel="Termin speichern" pending={pending} valid={!!installationDate} onSubmit={() => onSubmit({ step: "installation", at: fromInputValue(installationDate, false) })}>
          <Label htmlFor="order-installation" className="sr-only">Montagetermin</Label>
          <Input id="order-installation" type="date" required value={installationDate} onChange={(e) => setInstallationDate(e.target.value)} />
        </StepForm>
      )}

      {open === "completed" && (
        <StepForm title="Montage abgeschlossen?" hint="Wir bitten die Kundin bzw. den Kunden anschließend um eine kurze Bestätigung." submitLabel="Als abgeschlossen melden" pending={pending} valid onSubmit={() => onSubmit({ step: "completed" })} />
      )}

      {open === "note" && (
        <StepForm title="Notiz zum Auftrag" hint="Nur für Sie und KüchenWert sichtbar, nicht für die Kundin bzw. den Kunden." submitLabel="Notiz speichern" pending={pending} valid={note.trim().length > 0} onSubmit={() => onSubmit({ step: "note", note: note.trim() })}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={3} aria-label="Notiz" />
        </StepForm>
      )}

      {open === "cancelled" && (
        <StepForm
          title="Auftrag kam nicht zustande"
          hint="KüchenWert meldet sich bei Ihnen und bei der Kundin bzw. dem Kunden und prüft die Provisionsrechnung gemäß AGB."
          submitLabel="Verbindlich melden"
          destructive
          pending={pending}
          valid={!!reason && (reason !== "other" || note.trim().length > 0)}
          onSubmit={() => onSubmit({ step: "cancelled", reason: reason || null, note: note.trim() || null })}
        >
          <Select value={reason} onValueChange={(v) => setReason(v as CancelReason)}>
            <SelectTrigger aria-label="Grund">
              <SelectValue placeholder="Grund auswählen" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CANCEL_REASON_LABELS) as CancelReason[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {CANCEL_REASON_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={2} placeholder={reason === "other" ? "Bitte kurz beschreiben" : "Optional: kurze Erläuterung"} aria-label="Erläuterung" />
        </StepForm>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {open !== "note" && (
          <button type="button" className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => toggle("note")}>
            Notiz hinzufügen
          </button>
        )}
        {canReportCancellation(order) && open !== "cancelled" && (
          <button type="button" className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => toggle("cancelled")}>
            Auftrag kam nicht zustande
          </button>
        )}
      </div>
    </div>
  );
}
