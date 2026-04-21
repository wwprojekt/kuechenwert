/**
 * Record Payment Dialog Component
 * Allows admin to record full or partial payments for invoices
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeWithAuth } from "@/lib/sessionGuard";
import { parseGermanNumber } from "@/lib/parseGermanNumber";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Euro, CreditCard, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Invoice {
  id: string;
  invoice_number: string;
  dealer_id: string;
  gross_amount: number;
  amount_paid: number | null;
  payment_status: string;
  dealer?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string;
  };
}

interface RecordPaymentDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paymentMethods = [
  { value: "bank_transfer", label: "Banküberweisung" },
  { value: "cash", label: "Barzahlung" },
  { value: "paypal", label: "PayPal" },
  { value: "credit_card", label: "Kreditkarte" },
  { value: "direct_debit", label: "Lastschrift" },
  { value: "other", label: "Sonstige" },
];

export function RecordPaymentDialog({
  invoice,
  open,
  onOpenChange,
}: RecordPaymentDialogProps) {
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Calculate amounts
  const currentPaid = invoice?.amount_paid || 0;
  const totalAmount = invoice?.gross_amount || 0;
  const remainingAmount = totalAmount - currentPaid;

  // Reset form when dialog opens with new invoice
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && invoice) {
      setAmount(remainingAmount.toFixed(2));
      setPaymentMethod("bank_transfer");
      setReference("");
      setNotes("");
    }
    onOpenChange(newOpen);
  };

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("Missing invoice");

      const paymentAmount = parseGermanNumber(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error("Ungültiger Betrag");
      }

      if (paymentAmount > remainingAmount + 0.01) {
        throw new Error("Betrag übersteigt offenen Restbetrag");
      }

      // Atomic server-side flow: insert payment_history + update invoice +
      // send confirmation email + audit log in one call. This replaces the
      // old 2-step browser update which never sent the dealer a receipt.
      const { data, error } = await invokeWithAuth(
        "record-invoice-payment",
        {
          body: {
            invoiceId: invoice.id,
            amount: paymentAmount,
            paymentMethod,
            paymentReference: reference || null,
            notes: notes || null,
            sendEmail: true,
          },
        },
      );

      if (error) throw error;

      const result = data as {
        success?: boolean;
        newPaymentStatus?: string;
        fullyPaid?: boolean;
        emailSent?: boolean;
        emailError?: string | null;
        // Added with the auto-lift restriction logic in record-invoice-payment.
        // True iff this payment cleared the dealer's account_restricted flag.
        restrictionLifted?: boolean;
        restrictionLiftSkippedReason?: string | null;
        restrictionLiftError?: string | null;
      } | null;

      if (!result?.success) {
        throw new Error("Zahlung konnte nicht gebucht werden");
      }

      return {
        newStatus: result.newPaymentStatus ?? (result.fullyPaid ? "paid" : "partial"),
        paymentAmount,
        emailSent: !!result.emailSent,
        emailError: result.emailError ?? null,
        // Surfaced from record-invoice-payment when the dealer's account
        // restriction (set by process-dunning) is automatically cleared
        // because this payment was the last overdue invoice.
        restrictionLifted: !!result.restrictionLifted,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["financial-stats"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-invoices"] });
      // Mahnprozess tab in AdminFinancials reads this query; without
      // invalidation, the "Konto gesperrt" badge would stay stuck after
      // a payment that just lifted the restriction.
      queryClient.invalidateQueries({ queryKey: ["dunning-invoices"] });

      const statusText = data.newStatus === "paid" ? "vollständig bezahlt" : "Teilzahlung erfasst";
      const emailHint = data.emailSent
        ? "Bestätigungs-E-Mail an Händler versendet."
        : "ACHTUNG: Bestätigungs-E-Mail konnte nicht versendet werden – bitte manuell informieren.";
      const restrictionHint = data.restrictionLifted
        ? " Konto-Sperre des Händlers wurde automatisch aufgehoben."
        : "";
      toast.success(`Zahlung erfasst`, {
        description: `€${data.paymentAmount.toLocaleString("de-DE")} – ${statusText}. ${emailHint}${restrictionHint}`,
      });

      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Fehler beim Erfassen der Zahlung", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordPaymentMutation.mutate();
  };

  const handlePayFullAmount = () => {
    setAmount(remainingAmount.toFixed(2));
  };

  if (!invoice) return null;

  const dealerName = invoice.dealer?.company_name ||
    `${invoice.dealer?.first_name || ""} ${invoice.dealer?.last_name || ""}`.trim() ||
    "Unbekannt";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Zahlungseingang erfassen
          </DialogTitle>
          <DialogDescription>
            Rechnung {invoice.invoice_number} - {dealerName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Rechnungsbetrag</p>
              <p className="text-lg font-bold">
                €{totalAmount.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Bereits bezahlt</p>
              <p className="text-lg font-bold text-green-600">
                €{currentPaid.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Offener Betrag</p>
              <p className="text-lg font-bold text-orange-600">
                €{remainingAmount.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Erhaltener Betrag</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                  className="pl-9"
                  placeholder="z.B. 25.432,50"
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handlePayFullAmount}
                className="whitespace-nowrap"
              >
                Vollbetrag
              </Button>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Zahlungsart</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Zahlungsart wählen" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference">Zahlungsreferenz (optional)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="z.B. Transaktionsnummer, Buchungsreferenz"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interne Notizen zur Zahlung..."
              rows={2}
            />
          </div>

          {/* Partial Payment Warning */}
          {parseGermanNumber(amount) > 0 && parseGermanNumber(amount) < remainingAmount - 0.01 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Dies ist eine Teilzahlung. Der verbleibende Betrag von{" "}
                <strong>
                  €{(remainingAmount - parseGermanNumber(amount)).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </strong>{" "}
                bleibt offen.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={recordPaymentMutation.isPending || !amount || parseGermanNumber(amount) <= 0}
            >
              {recordPaymentMutation.isPending ? "Wird gespeichert..." : "Zahlung erfassen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default RecordPaymentDialog;
