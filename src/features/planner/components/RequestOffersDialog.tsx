import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ConsentCheckbox, TextField } from "@/features/funnel-a/components/ContactFields";
import { OFFERS_CONSENT_TEXT, PHONE_ERROR, TIMEFRAMES, isValidPhone } from "../steps/LeadSteps";

export interface OffersRequest {
  timeframeMonths: number | null;
  contactByPhone: boolean;
  /** Nur, wenn zum Projekt noch keine Telefonnummer gespeichert ist. */
  phone?: string;
}

/**
 * Nachträglich Angebote anfordern, mit demselben Einwilligungstext wie im
 * Funnel. Angebote gibt es nur mit Telefonnummer: needsPhone fragt sie ab,
 * wenn beim Abschluss keine angegeben wurde.
 */
export function RequestOffersDialog({
  open,
  onOpenChange,
  busy,
  error,
  needsPhone = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  error: string | null;
  needsPhone?: boolean;
  onConfirm: (request: OffersRequest) => void;
}) {
  const [timeframe, setTimeframe] = useState("");
  const [call, setCall] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const confirm = () => {
    if (needsPhone && !isValidPhone(phone)) {
      setPhoneError(PHONE_ERROR);
      document.getElementById("offers-phone")?.focus();
      return;
    }
    onConfirm({ timeframeMonths: Number(timeframe) || null, contactByPhone: call, ...(needsPhone ? { phone: phone.trim() } : {}) });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl sm:rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Kostenlose Angebote anfordern</AlertDialogTitle>
          <AlertDialogDescription>
            Geprüfte Küchenstudios aus Ihrer Region schicken Ihnen unverbindliche Angebote und Kostenvoranschläge für genau diese Küche.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          {needsPhone && (
            <TextField
              id="offers-phone"
              label="Telefon"
              type="tel"
              required
              autoComplete="tel"
              maxLength={40}
              hint="Für Rückfragen der Studios zu Ihrem Angebot"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(undefined);
              }}
              error={phoneError}
            />
          )}
          <label htmlFor="offers-timeframe" className="block text-sm font-medium">
            Wann soll die Küche kommen? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select
            id="offers-timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="input-field"
          >
            <option value="">Keine Angabe</option>
            {TIMEFRAMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <ConsentCheckbox id="offers-call" checked={call} onChange={setCall}>
            Studios und KüchenWert dürfen mich zu meinem Projekt auch anrufen.
          </ConsentCheckbox>
          <p className="text-xs leading-snug text-muted-foreground">{OFFERS_CONSENT_TEXT.replace("Mit „Ja“", "Mit „Angebote anfordern“")}</p>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
          <Button onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Angebote anfordern
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
