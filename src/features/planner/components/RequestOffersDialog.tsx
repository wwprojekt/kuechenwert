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
import { TermsLinks, TermsNotice } from "@/components/funnel/terms-consent";
import { TextField } from "@/features/funnel-a/components/ContactFields";
import { OFFERS_LATER_TERMS } from "../../../../supabase/functions/_shared/lead-terms.ts";
import { PHONE_ERROR, TIMEFRAMES, isValidPhone } from "../steps/LeadSteps";

export interface OffersRequest {
  timeframeMonths: number | null;
  /** Nur, wenn zum Projekt noch keine Telefonnummer gespeichert ist. */
  phone?: string;
}

/**
 * Angebote für eine Planung ohne Ausschreibung nachfordern (bis 30.09.2026
 * konnten Kunden im Planer „nur Küche & Preis“ wählen). Angebote gibt es nur
 * mit Telefonnummer: needsPhone fragt sie ab, wenn keine gespeichert ist.
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
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const confirm = () => {
    if (needsPhone && !isValidPhone(phone)) {
      setPhoneError(PHONE_ERROR);
      document.getElementById("offers-phone")?.focus();
      return;
    }
    onConfirm({ timeframeMonths: Number(timeframe) || null, ...(needsPhone ? { phone: phone.trim() } : {}) });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl sm:rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Kostenlose Angebote anfordern</AlertDialogTitle>
          <AlertDialogDescription>
            Mehrere geprüfte Küchenstudios aus Ihrer Region können Ihnen unverbindliche Angebote für genau diese Küche machen.
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
          <select id="offers-timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="input-field">
            <option value="">Keine Angabe</option>
            {TIMEFRAMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <TermsNotice className="text-xs">
            {OFFERS_LATER_TERMS.notice} <TermsLinks />
          </TermsNotice>
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
