/**
 * Record Payment Dialog Component
 * Allows admin to record full or partial payments for invoices
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
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
      if (!invoice || !user) throw new Error("Missing invoice or user");
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error("Ungültiger Betrag");
      }

      if (paymentAmount > remainingAmount + 0.01) {
        throw new Error("Betrag übersteigt offenen Restbetrag");
      }

      // Calculate new totals
      const newAmountPaid = currentPaid + paymentAmount;
      const newRemaining = totalAmount - newAmountPaid;

      // Determine new status
      let newStatus = "partial";
      let paidAt = null;
      if (newRemaining <= 0.01) {
        newStatus = "paid";
        paidAt = new Date().toISOString();
      }

      // 1. Insert payment record into dealer_payment_history
      const { error: historyError } = await supabase
        .from("dealer_payment_history")
        .insert({
          dealer_id: invoice.dealer_id,
          invoice_id: invoice.id,
          amount: paymentAmount,
          payment_method: paymentMethod,
          payment_reference: reference || null,
          notes: notes || null,
          processed_by: user.id,
          status: "completed",
        });

      if (historyError) throw historyError;

      // 2. Update invoice with new amount_paid and status
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          payment_status: newStatus,
          payment_method: paymentMethod,
          payment_reference: reference || null,
          ...(paidAt ? { paid_at: paidAt } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (invoiceError) throw invoiceError;

      return { newStatus, paymentAmount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["financial-stats"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-invoices"] });

      const statusText = data.newStatus === "paid" ? "vollständig bezahlt" : "Teilzahlung erfasst";
      toast.success(`Zahlung erfasst`, {
        description: `€${data.paymentAmount.toLocaleString("de-DE")} - ${statusText}`,
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
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                  placeholder="0.00"
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
          {parseFloat(amount) > 0 && parseFloat(amount) < remainingAmount - 0.01 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Dies ist eine Teilzahlung. Der verbleibende Betrag von{" "}
                <strong>
                  €{(remainingAmount - parseFloat(amount)).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
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
              disabled={recordPaymentMutation.isPending || !amount || parseFloat(amount) <= 0}
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
