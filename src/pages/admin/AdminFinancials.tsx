/**
 * Admin Financial Dashboard
 * Complete financial management and invoice overview
 * Features: Search by invoice/customer number, delete invoices, extended stats,
 * customer number display, date range filter, payment history
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithAuth, ensureValidRLSSession } from '@/lib/sessionGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Euro, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Send,
  CreditCard,
  Search,
  Users,
  BarChart3,
  History,
  RefreshCw,
  Eye,
  Mail,
  Percent,
  ArrowUpRight,
  Calendar,
  Clock,
  Gavel,
  Scale,
  Truck,
  ExternalLink,
  XCircle,
  Shield,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import { format, subDays, subMonths, startOfDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { sendInvoiceWithPdf } from '@/lib/invoiceGenerator';
import { getInvoiceStoragePath } from '@/lib/invoiceStorage';
import { deriveInvoice } from '@/lib/invoiceDerived';
import { RecordPaymentDialog } from '@/components/admin/RecordPaymentDialog';
import { CreateSellerPenaltyDialog } from '@/components/admin/CreateSellerPenaltyDialog';
import { useSettings } from '@/contexts/SettingsContext';
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";

/**
 * Map a stored `payment_reminders.reminder_level` (1, 2, 3) to the
 * customer-facing label used both in the e-mail subject sent by
 * `process-dunning` and in this admin UI. Centralising this mapping
 * prevents the off-by-one drift that previously made the badge claim
 * "1. Mahnung" while the actual e-mail was titled "Zahlungserinnerung".
 *
 *   Level 1 → Zahlungserinnerung
 *   Level 2 → 1. Mahnung
 *   Level 3 → 2. Mahnung (Letzte Mahnung)
 *
 * Source of truth: `supabase/functions/process-dunning/index.ts`
 */
const REMINDER_LEVEL_LABEL: Record<number, string> = {
  0: 'Überfällig',
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung (Letzte)',
};

function getReminderLevelLabel(level: number): string {
  return REMINDER_LEVEL_LABEL[level] ?? `Mahnstufe ${level}`;
}

export default function AdminFinancials() {
  const navigate = useNavigate();
  const { settings } = useSettings();

  // Configurable dunning levels from admin settings
  const dunningLevel1Days = settings?.dunning_level1_days ?? 14;
  const dunningLevel2Days = settings?.dunning_level2_days ?? 28;
  const dunningLevel3Days = settings?.dunning_level3_days ?? 42;
  const dunningLevel1Fee = settings?.dunning_level1_fee ?? 5.00;
  const dunningLevel2Fee = settings?.dunning_level2_fee ?? 10.00;
  const dunningLevel3Fee = settings?.dunning_level3_fee ?? 15.00;
  // The reminder level at which `process-dunning` flips
  // `profiles.account_restricted = true`. 0 disables auto-restriction.
  // Mirrors `restrictAtLevel` in supabase/functions/process-dunning/index.ts.
  // The complementary auto-LIFT lives in record-invoice-payment, which clears
  // the flag when a dealer's last overdue invoice is fully paid.
  const dunningRestrictAtLevel = settings?.dunning_restrict_at_level ?? 2;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [activeTab, setActiveTab] = useState('invoices');
  const [penaltyDialogOpen, setPenaltyDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  // Open invoice PDF.
  //
  // Strategy (kept intentionally simple and resilient against expired URLs
  // and storage-key drift, both of which were observed in production):
  //   1. Always mint a fresh signed URL from the canonical storage path.
  //      Avoids serving a stored `pdf_url` that may have expired (signed
  //      URLs are valid for one year, after which the stored value silently
  //      breaks).
  //   2. If the file does not exist, call `generate-invoice-pdf` which
  //      creates the PDF, uploads it AND returns a fresh signed URL so we
  //      can open it directly – no second click required.
  //   3. As a last resort fall back to the stored `pdf_url` (which may be
  //      stale but is better than nothing).
  const openInvoicePdf = async (invoice: any) => {
    if (!invoice?.id || !invoice?.dealer_id || !invoice?.invoice_number) {
      toast({
        title: 'PDF nicht verfügbar',
        description: 'Rechnungsdaten unvollständig.',
        variant: 'destructive',
      });
      return;
    }

    const storagePath = getInvoiceStoragePath(invoice.dealer_id, invoice.invoice_number);

    const { data: signed } = await supabase.storage
      .from('invoices')
      .createSignedUrl(storagePath, 3600);
    if (signed?.signedUrl) {
      window.open(signed.signedUrl, '_blank');
      return;
    }

    // Storage object missing → regenerate. Edge Function returns a freshly
    // signed URL we can open directly.
    const { data: genData, error: genError } = await invokeWithAuth(
      'generate-invoice-pdf',
      { body: { invoiceId: invoice.id } }
    );
    const pdfUrl = (genData as { pdfUrl?: string } | null)?.pdfUrl;
    if (!genError && pdfUrl) {
      await queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      window.open(pdfUrl, '_blank');
      return;
    }

    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank');
      return;
    }

    toast({
      title: 'PDF nicht verfügbar',
      description:
        genError?.message ||
        'Für diese Rechnung ist kein PDF vorhanden. Bitte generieren Sie die Rechnung neu.',
      variant: 'destructive',
    });
  };

  // Force-regenerate the invoice PDF (overwrites the file in storage). Useful
  // when the template has changed or the recipient address was updated after
  // the original PDF was created.
  const regenerateInvoicePdf = async (invoice: any) => {
    toast({ title: 'PDF wird neu erstellt …' });
    const { data: genData, error: genError } = await invokeWithAuth(
      'generate-invoice-pdf',
      { body: { invoiceId: invoice.id } }
    );
    if (genError) {
      toast({
        title: 'Neugenerierung fehlgeschlagen',
        description: genError.message ?? 'Unbekannter Fehler',
        variant: 'destructive',
      });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    const pdfUrl = (genData as { pdfUrl?: string } | null)?.pdfUrl;
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
    toast({
      title: 'PDF neu erstellt',
      description: `Rechnung ${invoice.invoice_number} wurde neu generiert${pdfUrl ? ' und geöffnet' : ''}.`,
    });
  };

  // Fetch all invoices with customer_number
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email, customer_number),
          auction:auctions(
            id,
            kitchen:kitchens(id, manufacturer, model)
          ),
          reminders:payment_reminders(reminder_level, reminder_date)
        `)
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch payment history
  const { data: paymentHistory } = useQuery({
    queryKey: ['payment-history'],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from('dealer_payment_history')
        .select(`
          *,
          invoice:invoices(
            invoice_number,
            customer_number,
            auction:auctions(id, kitchen:kitchens(id, manufacturer, model))
          ),
          dealer:profiles(first_name, last_name, company_name, customer_number)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch overdue invoices
  const { data: overdueInvoices } = useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email, customer_number),
          auction:auctions(id, kitchen:kitchens(id, manufacturer, model))
        `)
        .in('payment_status', ['pending', 'partial'])
        .neq('status', 'cancelled')
        .lt('due_date', new Date().toISOString())
        .order('due_date');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch dunning invoices (level1+ days overdue = active dunning process)
  const dunningThresholdDate = new Date();
  dunningThresholdDate.setDate(dunningThresholdDate.getDate() - dunningLevel1Days);

  const { data: dunningInvoices } = useQuery({
    queryKey: ['dunning-invoices'],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email, customer_number, phone, account_restricted, restriction_reason, restricted_at),
          auction:auctions(id, kitchen:kitchens(id, manufacturer, model)),
          reminders:payment_reminders(id, reminder_level, reminder_date, reminder_fee, total_amount)
        `)
        .in('payment_status', ['pending', 'partial'])
        .neq('status', 'cancelled')
        .lt('due_date', dunningThresholdDate.toISOString())
        .order('due_date');
      
      if (error) throw error;
      return data;
    },
  });

  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "finanzen",
    columns: [
      { key: "invoice_number", label: "Rechnungsnummer" },
      { key: "customer_number", label: "Kundennummer" },
      { key: "dealer", label: "Händler", format: (value: any) => value?.company_name || `${value?.first_name || ''} ${value?.last_name || ''}`.trim() },
      { key: "dealer", label: "Kd.-Nr.", format: (value: any) => value?.customer_number || '' },
      { key: "auction", label: "Fahrzeug", format: (value: any) => value?.kitchen ? `${value.kitchen.manufacturer} ${value.kitchen.model}` : "" },
      { key: "invoice_type", label: "Typ", format: (value: any) => value === 'seller_penalty' ? 'Vertragsstrafe' : 'Provision' },
      { key: "net_amount", label: "Netto", format: (value: any) => Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 }) },
      { key: "tax_amount", label: "MwSt", format: (value: any) => Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 }) },
      { key: "tax_rate", label: "MwSt-%", format: (value: any) => `${Number(value || 0)}%` },
      { key: "gross_amount", label: "Brutto", format: (value: any) => Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 }) },
      { key: "amount_paid", label: "Bezahlt", format: (value: any) => Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 }) },
      { key: "gross_amount", label: "Restbetrag", format: (_value: any, row: any) => (Number(row.gross_amount) - Number(row.amount_paid || 0)).toLocaleString("de-DE", { minimumFractionDigits: 2 }) },
      { key: "status", label: "Status", format: (value: any, row: any) => row.status === 'cancelled' ? 'Storniert' : row.payment_status === 'paid' ? 'Bezahlt' : row.payment_status === 'partial' ? 'Teilbezahlt' : 'Offen' },
      { key: "reverse_charge", label: "Reverse Charge", format: (value: any) => value ? 'Ja' : 'Nein' },
      { key: "payment_method", label: "Zahlungsart", format: (value: any) => value === 'bank_transfer' ? 'Überweisung' : value === 'cash' ? 'Bar' : value || '' },
      { key: "invoice_date", label: "Rechnungsdatum", format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "" },
      { key: "due_date", label: "Fällig am", format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "" },
      { key: "paid_at", label: "Bezahlt am", format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "" },
    ],
  });

  // Send reminder mutation
  //
  // Triggers `process-dunning` in single-invoice mode. The Edge Function
  // returns:
  //   { success, singleMode, primary: { success, skipped, reason, reminderLevel, error } }
  // We surface the precise outcome to the admin so they can tell whether
  // an e-mail actually went out, the invoice was already at max level, or
  // an error occurred. Previously this said "versendet" regardless.
  const sendReminderMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await invokeWithAuth('process-dunning', {
        body: { invoiceId },
      });
      if (error) throw error;
      return data as {
        success?: boolean;
        singleMode?: boolean;
        message?: string;
        primary?: {
          success?: boolean;
          skipped?: boolean;
          reason?: string;
          reminderLevel?: number;
          error?: string;
        } | null;
      } | null;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dunning-invoices'] });

      const primary = result?.primary;
      if (primary?.success) {
        toast({
          title: 'Mahnung versendet',
          description: `${getReminderLevelLabel(primary.reminderLevel ?? 1)} per E-Mail an den Empfänger gesendet.`,
        });
      } else if (primary?.skipped) {
        toast({
          title: 'Keine Mahnung versendet',
          description: primary.reason || 'Mahnung wurde übersprungen.',
        });
      } else if (primary?.error) {
        toast({
          title: 'Mahnung fehlgeschlagen',
          description: primary.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Hinweis',
          description: result?.message || 'Keine Mahnung versendet.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message || 'Zahlungserinnerung konnte nicht versendet werden',
        variant: 'destructive',
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return sendInvoiceWithPdf(invoiceId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      toast({
        title: 'Rechnung versendet',
        description: result.pdfGenerated
          ? 'Die Rechnung wurde mit aktuellem PDF an den Empfänger gemailt.'
          : 'Rechnung gemailt, PDF konnte nicht generiert werden – bitte prüfen.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error?.message || 'E-Mail konnte nicht gesendet werden',
        variant: 'destructive',
      });
    },
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: string; reason: string | null }) => {
      // Atomic server-side flow: cancel invoice + send Storno email + audit log.
      // Replaces the silent client-side update which never informed the dealer.
      const { data, error } = await invokeWithAuth("cancel-invoice", {
        body: {
          invoiceId,
          reason,
          sendEmail: true,
        },
      });
      if (error) throw error;
      const result = data as {
        success?: boolean;
        emailSent?: boolean;
        emailError?: string | null;
      } | null;
      if (!result?.success) throw new Error("Stornierung fehlgeschlagen");
      return {
        emailSent: !!result.emailSent,
        emailError: result.emailError ?? null,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dunning-invoices'] });
      const emailHint = data.emailSent
        ? 'Storno-E-Mail an Händler versendet.'
        : 'ACHTUNG: Storno-E-Mail konnte nicht versendet werden – bitte manuell informieren.';
      toast({
        title: 'Rechnung storniert',
        description: `Die Rechnung wurde erfolgreich storniert. ${emailHint}`,
      });
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      setCancelReason('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Stornieren',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (invoice: any) => {
    // Kanonische Ableitung (src/lib/invoiceDerived.ts). Bisher war die
    // Reihenfolge paid→partial→cancelled→overdue/open; cancelled kam zu spät
    // und wäre bei hypothetischem `payment_status='partial' + status='cancelled'`
    // als "Teilbezahlt" durchgerutscht. Der Helper priorisiert jetzt korrekt
    // cancelled zuerst und hält die Mahnstufen-Logik unten separat.
    const derived = deriveInvoice(invoice);

    if (derived.displayStatus === 'cancelled') {
      return <Badge className="bg-gray-100 text-gray-800">Storniert</Badge>;
    }
    if (derived.displayStatus === 'paid') {
      return <Badge className="bg-green-100 text-green-800">Bezahlt</Badge>;
    }
    if (derived.displayStatus === 'partial') {
      return <Badge className="bg-blue-100 text-blue-800">Teilbezahlt</Badge>;
    }

    const safeRem = Array.isArray(invoice.reminders)
      ? invoice.reminders
      : invoice.reminders
        ? [invoice.reminders]
        : [];
    const maxLevel = safeRem.reduce(
      (m: number, r: any) => Math.max(m, Number(r?.reminder_level ?? 0)),
      0
    );

    if (derived.isOverdue) {
      if (maxLevel >= 3) {
        return <Badge variant="destructive">{getReminderLevelLabel(3)}</Badge>;
      }
      if (maxLevel >= 2) {
        return <Badge className="bg-orange-100 text-orange-800">{getReminderLevelLabel(2)}</Badge>;
      }
      if (maxLevel >= 1) {
        return <Badge className="bg-amber-100 text-amber-800">{getReminderLevelLabel(1)}</Badge>;
      }
      return <Badge className="bg-yellow-100 text-yellow-800">Überfällig</Badge>;
    }

    return <Badge variant="outline">Offen</Badge>;
  };

  // Date filter logic
  //
  // Normalisierung auf `startOfDay`: Bisher verglichen die "Letzte X Tage"-
  // Filter mit `subDays(now, 7)`, was "jetzt minus 7×24h" bedeutet. Eine
  // Rechnung, die vor 7 Tagen erstellt wurde (UTC-Midnight), fiel damit
  // unterhalb der Schwelle und wurde ausgeblendet – der Filter zeigte faktisch
  // ~6 statt 7 Tage. `startOfDay(subDays(now, N))` normalisiert auf die lokale
  // Tagesgrenze und liefert den semantisch korrekten "N volle Tage zurück"-
  // Anker (Bug 2026-04-25).
  const filterByDate = (invoice: any) => {
    if (dateFilter === 'all') return true;
    const invoiceDate = new Date(invoice.invoice_date || invoice.created_at);
    const now = new Date();

    switch (dateFilter) {
      case '7days':
        return invoiceDate >= startOfDay(subDays(now, 7));
      case '30days':
        return invoiceDate >= startOfDay(subDays(now, 30));
      case 'thisMonth':
        return isWithinInterval(invoiceDate, { start: startOfMonth(now), end: endOfMonth(now) });
      case 'lastMonth': {
        const lastMonth = subMonths(now, 1);
        return isWithinInterval(invoiceDate, { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) });
      }
      case '3months':
        return invoiceDate >= startOfDay(subMonths(now, 3));
      case '6months':
        return invoiceDate >= startOfDay(subMonths(now, 6));
      case '12months':
        return invoiceDate >= startOfDay(subMonths(now, 12));
      default:
        return true;
    }
  };

  const getVehicleLabel = (invoice: any) => {
    if (!invoice) return null;
    const m = invoice.auction?.kitchen;
    if (!m) return null;
    return `${m.manufacturer || ''} ${m.model || ''}`.trim() || null;
  };

  const navigateToVehicle = (invoice: any) => {
    if (!invoice) return;
    const kitchenId = invoice.auction?.kitchen?.id || invoice.kitchen_id;
    if (kitchenId) {
      navigate(`/admin/kitchens/${kitchenId}`);
    } else if (invoice.auction_id) {
      navigate(`/admin/auctions/${invoice.auction_id}`);
    }
  };

  const filteredInvoices = invoices?.filter(invoice => {
    const searchLower = searchTerm.toLowerCase();
    const vehicleStr = getVehicleLabel(invoice)?.toLowerCase() || '';
    const matchesSearch = searchTerm === '' || 
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.customer_number?.toLowerCase().includes(searchLower) ||
      invoice.dealer?.email?.toLowerCase().includes(searchLower) ||
      invoice.dealer?.customer_number?.toLowerCase().includes(searchLower) ||
      (invoice.dealer?.company_name && invoice.dealer.company_name.toLowerCase().includes(searchLower)) ||
      (`${invoice.dealer?.first_name || ''} ${invoice.dealer?.last_name || ''}`.toLowerCase().includes(searchLower)) ||
      vehicleStr.includes(searchLower);
    
    // Status-Filter via deriveInvoice(): kanonische Ableitung, kein erneutes
    // Interpretieren der Rohfelder. "Überfällig" = pending/partial + aktiv +
    // noch nicht vollbezahlt + Tagesvergleich due_date < heute (exakt wie der
    // Server-Filter .lt('due_date', now())).
    const derived = deriveInvoice(invoice);
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'paid' && derived.displayStatus === 'paid') ||
      (statusFilter === 'pending' && derived.displayStatus === 'open') ||
      (statusFilter === 'partial' && derived.displayStatus === 'partial') ||
      (statusFilter === 'cancelled' && derived.displayStatus === 'cancelled') ||
      (statusFilter === 'overdue' && derived.isOverdue);
    
    const matchesType = typeFilter === 'all' ||
      (typeFilter === 'commission' && (invoice.invoice_type === 'commission' || !invoice.invoice_type)) ||
      (typeFilter === 'seller_penalty' && invoice.invoice_type === 'seller_penalty');

    const matchesDate = filterByDate(invoice);
    
    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  // Extended statistics – exclude cancelled invoices from all KPIs
  const activeInvoices = invoices?.filter(inv => inv.status !== 'cancelled') || [];
  const totalNet = activeInvoices.reduce((sum, inv) => sum + Number(inv.net_amount || 0), 0);
  const totalTax = activeInvoices.reduce((sum, inv) => sum + Number(inv.tax_amount || 0), 0);
  const totalGross = activeInvoices.reduce((sum, inv) => sum + Number(inv.gross_amount || 0), 0);
  const totalPaid = activeInvoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
  const totalOutstanding = totalGross - totalPaid;
  // KPI-Kachel "Überfällig" nutzt dieselbe `deriveInvoice`-Ableitung wie
  // Badges, Filter und Server-Query. `isOverdue` schließt storniert/paid
  // bereits aus (Bug 2026-04-25: heute fällige Rechnung zählte client-seitig
  // überfällig, server-seitig nicht → KPI "1" bei leerer Liste).
  const overdueInvoicesLocal = activeInvoices.filter(
    (inv) => deriveInvoice(inv).isOverdue,
  );
  const overdueCount = overdueInvoicesLocal.length;
  const overdueAmount = overdueInvoicesLocal.reduce(
    (sum, inv) => sum + deriveInvoice(inv).remainingAmount,
    0
  );
  const paidCount = activeInvoices.filter(inv => inv.payment_status === 'paid').length;
  const cancelledCount = invoices?.filter(inv => inv.status === 'cancelled').length || 0;
  const avgInvoiceAmount = activeInvoices.length ? totalGross / activeInvoices.length : 0;
  const paymentRate = totalGross > 0 ? (totalPaid / totalGross) * 100 : 0;
  const dunningCount = dunningInvoices?.length || 0;
  const dunningAmount = dunningInvoices?.reduce((sum, inv) => sum + Number(inv.gross_amount || 0) - Number(inv.amount_paid || 0), 0) || 0;

  // This month stats – also exclude cancelled
  const thisMonthInvoices = activeInvoices.filter(inv => {
    const d = new Date(inv.invoice_date || inv.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthRevenue = thisMonthInvoices.reduce((sum, inv) => sum + Number(inv.gross_amount || 0), 0);
  const thisMonthCount = thisMonthInvoices.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Finanzen & Rechnungen</h1>
          <p className="text-muted-foreground">
            Komplette Finanzübersicht mit Rechnungs- und Zahlungsverwaltung
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setPenaltyDialogOpen(true)}
          >
            <Scale className="h-4 w-4 mr-2" />
            Vertragsstrafe erstellen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
              queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
              queryClient.invalidateQueries({ queryKey: ['dunning-invoices'] });
              queryClient.invalidateQueries({ queryKey: ['payment-history'] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Extended Financial Statistics - Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtumsatz (brutto)</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-green-600 break-words">
              {totalGross.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
              <span>Netto: {totalNet.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
              <span>MwSt: {totalTax.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {activeInvoices.length} Rechnungen{cancelledCount > 0 && ` (${cancelledCount} storniert)`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Einnahmen</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-green-600 break-words">
              {totalPaid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {paidCount} bezahlte Rechnungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-orange-600 break-words">
              {totalOutstanding.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-muted-foreground">
              Offene Forderungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Überfällig</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-red-600 break-words">
              {overdueAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {overdueCount} überfällige Rechnungen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Extended Statistics - Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zahlungsquote</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-blue-600">
              {paymentRate.toFixed(1)}%
            </div>
            <Progress value={paymentRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ø Rechnungsbetrag</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold break-words">
              {avgInvoiceAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-muted-foreground">
              Durchschnitt pro Rechnung
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diesen Monat</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-primary break-words">
              {thisMonthRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {thisMonthCount} neue Rechnungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kunden</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">
              {new Set(activeInvoices.map((inv) => inv.dealer_id)).size || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Aktive Rechnungsempfänger
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Rechnungen / Überfällig / Zahlungshistorie */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto gap-1 flex-nowrap overflow-x-auto no-scrollbar w-full justify-start sm:inline-flex sm:w-auto sm:h-10">
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            Rechnungen
            {invoices?.length ? <Badge variant="secondary" className="ml-1">{invoices.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Überfällig
            {overdueCount > 0 && <Badge variant="destructive" className="ml-1">{overdueCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dunning" className="gap-2">
            <Gavel className="h-4 w-4" />
            Mahnprozess
            {dunningCount > 0 && <Badge variant="destructive" className="ml-1">{dunningCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <History className="h-4 w-4" />
            Zahlungshistorie
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Rechnungen ──────────────────────────────────────── */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Rechnungsübersicht</CardTitle>
              <CardDescription>
                Suchen Sie nach Rechnungsnummer, Kundennummer, Firma, E-Mail oder Fahrzeug
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechnungsnr., Kundennr., Firma, E-Mail oder Fahrzeug..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="pending">Offen</SelectItem>
                    <SelectItem value="partial">Teilbezahlt</SelectItem>
                    <SelectItem value="paid">Bezahlt</SelectItem>
                    <SelectItem value="overdue">Überfällig</SelectItem>
                    <SelectItem value="cancelled">Storniert</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Typen</SelectItem>
                    <SelectItem value="commission">Provisionen</SelectItem>
                    <SelectItem value="seller_penalty">Vertragsstrafen</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Zeiträume</SelectItem>
                    <SelectItem value="7days">Letzte 7 Tage</SelectItem>
                    <SelectItem value="30days">Letzte 30 Tage</SelectItem>
                    <SelectItem value="thisMonth">Dieser Monat</SelectItem>
                    <SelectItem value="lastMonth">Letzter Monat</SelectItem>
                    <SelectItem value="3months">Letzte 3 Monate</SelectItem>
                    <SelectItem value="6months">Letzte 6 Monate</SelectItem>
                    <SelectItem value="12months">Letzte 12 Monate</SelectItem>
                  </SelectContent>
                </Select>
                <ExportButton
                  onExportCSV={() => exportCSV(filteredInvoices || [])}
                  onExportExcel={() => exportExcel(filteredInvoices || [])}
                  isExporting={isExporting}
                />
              </div>

              {/* Results count */}
              {searchTerm && (
                <p className="text-sm text-muted-foreground mb-4">
                  {filteredInvoices?.length || 0} Ergebnis{(filteredInvoices?.length || 0) !== 1 ? 'se' : ''} gefunden
                  {searchTerm && ` für "${searchTerm}"`}
                </p>
              )}

              {/* Invoice List */}
              <div className="space-y-3">
                {invoicesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : filteredInvoices?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Keine Rechnungen gefunden</p>
                    <p className="text-sm">Passen Sie Ihre Suchkriterien oder Filter an.</p>
                  </div>
                ) : (
                  filteredInvoices?.map((invoice: any) => {
                    const amountPaid = Number(invoice.amount_paid || 0);
                    const grossAmount = Number(invoice.gross_amount);
                    const rowDerived = deriveInvoice(invoice);
                    const paymentProgress = rowDerived.paymentProgress;
                    const dealerName = invoice.dealer?.company_name ||
                      `${invoice.dealer?.first_name || ''} ${invoice.dealer?.last_name || ''}`.trim() || 'Unbekannt';
                    const custNum = invoice.customer_number || invoice.dealer?.customer_number || '';
                    
                    return (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-6">
                            {/* Invoice Number + Customer */}
                            <div className="min-w-[160px]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary cursor-pointer hover:underline" onClick={() => openInvoicePdf(invoice)}>
                                  {invoice.invoice_number}
                                </span>
                                {invoice.invoice_type === 'seller_penalty' && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    <Scale className="h-3 w-3 mr-0.5" />
                                    Strafe
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {dealerName}
                              </div>
                              {custNum && (
                                <div className="text-xs text-blue-600 font-medium">
                                  {custNum}
                                </div>
                              )}
                            </div>

                            {/* Vehicle / Penalty Reason */}
                            <div className="hidden lg:block min-w-[150px]">
                              {invoice.invoice_type === 'seller_penalty' ? (
                                <>
                                  <div className="font-medium text-sm text-destructive">
                                    {invoice.penalty_reason === 'anderweitiger_verkauf' ? 'Anderweitiger Verkauf' :
                                     invoice.penalty_reason === 'vorzeitige_ruecknahme' ? 'Vorzeitige Rücknahme' :
                                     invoice.penalty_reason === 'falsche_angaben' ? 'Falsche Angaben' :
                                     'Vertragsstrafe'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd.MM.yyyy', { locale: de }) : ''}
                                  </div>
                                </>
                              ) : (
                                <>
                                  {getVehicleLabel(invoice) ? (
                                    <button
                                      onClick={() => navigateToVehicle(invoice)}
                                      className="flex items-center gap-1.5 font-medium text-sm text-primary hover:underline text-left"
                                    >
                                      <Truck className="h-3.5 w-3.5 shrink-0" />
                                      {getVehicleLabel(invoice)}
                                      <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                                    </button>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">Kein Fahrzeug</div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd.MM.yyyy', { locale: de }) : ''}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Netto: {Number(invoice.net_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                    {invoice.reverse_charge && <span className="ml-1 text-amber-600">(RC)</span>}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Status + Progress */}
                            <div className="flex-1 min-w-[180px]">
                              <div className="flex justify-between text-sm mb-1">
                                <span>{getStatusBadge(invoice)}</span>
                                <span className="font-semibold">
                                  {amountPaid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} / {grossAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                </span>
                              </div>
                              <Progress value={paymentProgress} className="h-2" />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 ml-4">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => openInvoicePdf(invoice)}
                            title="Rechnung ansehen"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => regenerateInvoicePdf(invoice)}
                            title="PDF neu generieren (z. B. nach Adressänderung)"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (invoice.sent_at) {
                                if (!window.confirm(
                                  `Rechnung ${invoice.invoice_number} wurde bereits am ${new Date(invoice.sent_at).toLocaleDateString('de-DE')} versendet. Erneut senden?`
                                )) return;
                              }
                              sendEmailMutation.mutate(invoice.id);
                            }}
                            disabled={sendEmailMutation.isPending}
                            title={invoice.sent_at ? `Versendet am ${new Date(invoice.sent_at).toLocaleDateString('de-DE')} – Klick: erneut senden` : 'Rechnung per E-Mail senden'}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentDialogOpen(true);
                            }}
                            disabled={!rowDerived.canRecordPayment}
                            title={
                              rowDerived.displayStatus === 'cancelled'
                                ? 'Stornierte Rechnung – keine Zahlung möglich'
                                : rowDerived.displayStatus === 'paid'
                                  ? 'Rechnung bereits vollständig bezahlt'
                                  : 'Zahlung erfassen'
                            }
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendReminderMutation.mutate(invoice.id)}
                            disabled={sendReminderMutation.isPending || !rowDerived.canSendReminder}
                            title={
                              rowDerived.displayStatus === 'cancelled'
                                ? 'Stornierte Rechnung – keine Mahnung möglich'
                                : rowDerived.displayStatus === 'paid'
                                  ? 'Rechnung bereits bezahlt'
                                  : 'Mahnung senden'
                            }
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setInvoiceToDelete(invoice);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={!rowDerived.canCancel}
                            title={
                              rowDerived.displayStatus === 'cancelled'
                                ? 'Bereits storniert'
                                : rowDerived.displayStatus === 'paid'
                                  ? 'Bezahlte Rechnungen können nicht storniert werden'
                                  : 'Rechnung stornieren'
                            }
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Überfällig ──────────────────────────────────────── */}
        <TabsContent value="overdue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Überfällige Rechnungen
              </CardTitle>
              <CardDescription>
                Rechnungen die das Fälligkeitsdatum überschritten haben
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!overdueInvoices?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg font-medium">Keine überfälligen Rechnungen</p>
                  <p className="text-sm">Alle Rechnungen sind im Zeitplan.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueInvoices.map((invoice: any) => {
                    const derivedRow = deriveInvoice(invoice);
                    const daysOverdue = derivedRow.daysOverdue;
                    const remaining = derivedRow.remainingAmount;
                    const custNum = invoice.customer_number || invoice.dealer?.customer_number || '';
                    
                    return (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50/50">
                        <div className="flex items-center gap-6">
                          <div className="min-w-[140px]">
                            <div className="font-semibold text-red-700">{invoice.invoice_number}</div>
                            <div className="text-xs text-muted-foreground">
                              {invoice.dealer?.company_name || `${invoice.dealer?.first_name || ''} ${invoice.dealer?.last_name || ''}`}
                            </div>
                            {custNum && (
                              <div className="text-xs text-blue-600 font-medium">{custNum}</div>
                            )}
                          </div>
                          {getVehicleLabel(invoice) && (
                            <div className="hidden md:block min-w-[130px]">
                              <button
                                onClick={() => navigateToVehicle(invoice)}
                                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                              >
                                <Truck className="h-3.5 w-3.5 shrink-0" />
                                {getVehicleLabel(invoice)}
                              </button>
                            </div>
                          )}
                          <div>
                            <Badge variant="destructive">{daysOverdue} Tage überfällig</Badge>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-red-700">
                              {remaining.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Fällig: {format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: de })}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Zahlung
                          </Button>
                          <Button 
                            variant="destructive"
                            size="sm"
                            onClick={() => sendReminderMutation.mutate(invoice.id)}
                            disabled={sendReminderMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Mahnung
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>        {/* ── Tab: Mahnprozess ────────────────────────────────────────── */}
        <TabsContent value="dunning">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-red-600" />
                    Aktive Mahnverfahren
                  </CardTitle>
                  <CardDescription>
                    Rechnungen die seit mehr als {dunningLevel1Days} Tagen überfällig sind und sich im Mahnprozess befinden
                  </CardDescription>
                </div>
                {dunningCount > 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">
                      {dunningAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                    <div className="text-xs text-muted-foreground">{dunningCount} offene Mahnverfahren</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/*
                Restriction-policy banner.

                Surfaces the value of `site_settings.dunning_restrict_at_level`
                (which `process-dunning` enforces server-side) so admins can
                see the active policy without leaving the page. When the
                policy is OFF (level = 0) we show a warning instead, because
                "no auto-restriction" is a deliberate but risky choice and
                should not be silent.

                Lift behaviour is described too — that is `record-invoice-payment`
                automatically clearing the flag when the dealer's last
                overdue invoice is paid (Stage 1 of this fix).
              */}
              {dunningRestrictAtLevel > 0 ? (
                <Alert className="mb-4 border-blue-200 bg-blue-50/60">
                  <Shield className="h-4 w-4 text-blue-700" />
                  <AlertDescription className="text-blue-900">
                    Händlerkonten werden ab der{' '}
                    <strong>
                      {getReminderLevelLabel(dunningRestrictAtLevel)}
                    </strong>{' '}
                    automatisch gesperrt (Bieten und Sofortkauf blockiert).
                    Bei vollständigem Zahlungseingang wird die Sperre
                    automatisch wieder aufgehoben.{' '}
                    <Link
                      to="/admin/settings"
                      className="underline font-medium hover:text-blue-700"
                    >
                      Schwelle ändern
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="mb-4 border-amber-200 bg-amber-50/60">
                  <ShieldAlert className="h-4 w-4 text-amber-700" />
                  <AlertDescription className="text-amber-900">
                    Automatische Kontosperre ist <strong>deaktiviert</strong>.
                    Überfällige Händler können weiterhin bieten und kaufen.{' '}
                    <Link
                      to="/admin/settings"
                      className="underline font-medium hover:text-amber-700"
                    >
                      Aktivieren
                    </Link>
                  </AlertDescription>
                </Alert>
              )}

              {!dunningInvoices?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Scale className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg font-medium">Keine aktiven Mahnverfahren</p>
                  <p className="text-sm">Es gibt derzeit keine Rechnungen im Mahnprozess ({dunningLevel1Days}+ Tage überfällig).</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dunningInvoices.map((invoice: any) => {
                    const derivedRow = deriveInvoice(invoice);
                    const daysOverdue = derivedRow.daysOverdue;
                    const remaining = derivedRow.remainingAmount;
                    const custNum = invoice.customer_number || invoice.dealer?.customer_number || '';
                    const safeReminders = Array.isArray(invoice.reminders) ? invoice.reminders : invoice.reminders ? [invoice.reminders] : [];
                    const reminderCount = safeReminders.length;
                    const maxLevel = safeReminders.reduce((max: number, r: any) => Math.max(max, r.reminder_level || 0), 0);
                    const lastReminder = [...safeReminders].sort((a: any, b: any) => new Date(b.reminder_date).getTime() - new Date(a.reminder_date).getTime())[0];
                    const totalFees = safeReminders.reduce((sum: number, r: any) => sum + Number(r.reminder_fee || 0), 0);
                    
                    // Dunning level classification.
                    //
                    // Aligned with process-dunning's reminder_level numbering:
                    //   level 1 = Zahlungserinnerung (after `level1Days` days)
                    //   level 2 = 1. Mahnung         (after `level2Days` days)
                    //   level 3 = 2. Mahnung (Letzte Mahnung)
                    //
                    // We pick the higher of "what we have already sent" and
                    // "what the day-thresholds would imply". The fee shown is
                    // the fee for the NEXT step the cron would assess.
                    const thresholdLevel =
                      daysOverdue >= dunningLevel3Days
                        ? 3
                        : daysOverdue >= dunningLevel2Days
                          ? 2
                          : daysOverdue >= dunningLevel1Days
                            ? 1
                            : 0;
                    const effectiveLevel = Math.max(maxLevel, thresholdLevel);
                    const feeForLevel =
                      effectiveLevel >= 3
                        ? dunningLevel3Fee
                        : effectiveLevel >= 2
                          ? dunningLevel2Fee
                          : effectiveLevel >= 1
                            ? dunningLevel1Fee
                            : 0;

                    let levelColor = 'bg-yellow-100 border-yellow-300 text-yellow-800';
                    let levelLabel = 'Überfällig';
                    let levelBg = 'bg-yellow-50/50 border-yellow-200';
                    if (effectiveLevel >= 3) {
                      levelColor = 'bg-red-100 border-red-300 text-red-800';
                      levelLabel = `${getReminderLevelLabel(3)} (${feeForLevel.toFixed(2)} € Gebühr)`;
                      levelBg = 'bg-red-50/80 border-red-300';
                    } else if (effectiveLevel >= 2) {
                      levelColor = 'bg-orange-100 border-orange-300 text-orange-800';
                      levelLabel = `${getReminderLevelLabel(2)} (${feeForLevel.toFixed(2)} € Gebühr)`;
                      levelBg = 'bg-orange-50/50 border-orange-200';
                    } else if (effectiveLevel >= 1) {
                      levelColor = 'bg-amber-100 border-amber-300 text-amber-800';
                      levelLabel = `${getReminderLevelLabel(1)} (${feeForLevel.toFixed(2)} € Gebühr)`;
                      levelBg = 'bg-amber-50/50 border-amber-200';
                    }

                    // Restriction-status helpers.
                    //
                    // `isDealerInvoice` mirrors the carve-out in
                    // `process-dunning`: penalty invoices issued to private
                    // sellers do NOT trigger the auto-restriction, so we
                    // suppress the related warnings on those rows.
                    //
                    // `isCurrentlyRestricted` reflects the live state of the
                    // dealer profile (loaded via the dunning query). It does
                    // NOT necessarily mean THIS invoice caused the lock —
                    // another overdue invoice from the same dealer may have.
                    //
                    // `nextReminderTriggersRestriction` is shown as a
                    // warning icon next to rows where the next dunning step
                    // (current effective level + 1) would cross the
                    // configured `dunningRestrictAtLevel` threshold.
                    const isDealerInvoice =
                      invoice.invoice_type !== 'seller_penalty' &&
                      invoice.invoice_type !== 'private_penalty';
                    const isCurrentlyRestricted =
                      isDealerInvoice &&
                      Boolean(invoice.dealer?.account_restricted);
                    const nextReminderTriggersRestriction =
                      isDealerInvoice &&
                      dunningRestrictAtLevel > 0 &&
                      effectiveLevel < dunningRestrictAtLevel &&
                      effectiveLevel + 1 >= dunningRestrictAtLevel;

                    return (
                      <div key={invoice.id} className={`p-5 border rounded-lg ${levelBg}`}>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left: Invoice + Dealer Info */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="min-w-[160px]">
                              <div className="font-bold text-lg">{invoice.invoice_number}</div>
                              <div className="text-sm text-muted-foreground">
                                {invoice.dealer?.company_name || `${invoice.dealer?.first_name || ''} ${invoice.dealer?.last_name || ''}`}
                              </div>
                              {/*
                                Restriction badge — visible iff the dealer's
                                profile currently has account_restricted = true
                                AND this row is a dealer invoice (skip on
                                penalty rows where the badge would be
                                misleading because penalties never restrict).
                              */}
                              {isCurrentlyRestricted && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="destructive"
                                      className="mt-1 gap-1"
                                    >
                                      <Ban className="h-3 w-3" />
                                      Konto gesperrt
                                      {invoice.dealer?.restricted_at && (
                                        <span className="font-normal opacity-90">
                                          {' '}seit{' '}
                                          {format(
                                            new Date(invoice.dealer.restricted_at),
                                            'dd.MM.yyyy',
                                          )}
                                        </span>
                                      )}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {invoice.dealer?.restriction_reason ||
                                      'Händler ist aktuell für Bieten und Sofortkauf gesperrt'}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {custNum && (
                                <div className="text-xs text-blue-600 font-semibold mt-0.5">{custNum}</div>
                              )}
                              {invoice.dealer?.email && (
                                <div className="text-xs text-muted-foreground">{invoice.dealer.email}</div>
                              )}
                              {getVehicleLabel(invoice) && (
                                <button
                                  onClick={() => navigateToVehicle(invoice)}
                                  className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                                >
                                  <Truck className="h-3 w-3 shrink-0" />
                                  {getVehicleLabel(invoice)}
                                </button>
                              )}
                            </div>
                            
                            {/* Dunning Status */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Badge className={levelColor}>{levelLabel}</Badge>
                                {/*
                                  Warns admin BEFORE clicking "Mahnung senden"
                                  on a row whose next step would auto-restrict
                                  the dealer's account. Suppressed if the
                                  dealer is already restricted (no new info).
                                */}
                                {nextReminderTriggersRestriction &&
                                  !isCurrentlyRestricted && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-amber-700">
                                          <ShieldAlert className="h-4 w-4" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Achtung: Die nächste Mahnung sperrt
                                        das Händlerkonto automatisch
                                        (Schwelle: {getReminderLevelLabel(dunningRestrictAtLevel)}).
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="font-medium text-red-600">{daysOverdue} Tage überfällig</span>
                                <span>·</span>
                                <span>{reminderCount} Mahnung(en) versendet</span>
                                {totalFees > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>Mahngebühren: {totalFees.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                                  </>
                                )}
                              </div>
                              {lastReminder && (
                                <div className="text-xs text-muted-foreground">
                                  Letzte Mahnung: {format(new Date(lastReminder.reminder_date), 'dd.MM.yyyy', { locale: de })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Amount + Actions */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="text-right min-w-[140px]">
                              <div className="text-xl font-bold text-red-700">
                                {remaining.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                von {Number(invoice.gross_amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Fällig: {format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: de })}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button 
                                size="sm"
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setPaymentDialogOpen(true);
                                }}
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Zahlung erfassen
                              </Button>
                              <Button 
                                variant="destructive"
                                size="sm"
                                onClick={() => sendReminderMutation.mutate(invoice.id)}
                                disabled={sendReminderMutation.isPending}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Nächste Mahnung
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setInvoiceToDelete(invoice);
                                  setDeleteDialogOpen(true);
                                }}
                                title="Rechnung stornieren"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Stornieren
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Zahlungshistorie ──────────────────────────────────────── */}     <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Zahlungshistorie
              </CardTitle>
              <CardDescription>
                Letzte 50 erfasste Zahlungseingänge
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!paymentHistory?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Keine Zahlungen erfasst</p>
                  <p className="text-sm">Zahlungseingänge werden hier chronologisch angezeigt.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentHistory.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-6">
                        <div className="min-w-[120px]">
                          <div className="font-semibold text-green-700">
                            +{Number(payment.amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                          </div>
                        </div>
                        <div className="min-w-[140px]">
                          <div className="text-sm font-medium">{payment.invoice?.invoice_number || '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {payment.dealer?.company_name || `${payment.dealer?.first_name || ''} ${payment.dealer?.last_name || ''}`}
                          </div>
                          {payment.dealer?.customer_number && (
                            <div className="text-xs text-blue-600 font-medium">{payment.dealer.customer_number}</div>
                          )}
                        </div>
                        {payment.invoice?.auction?.kitchen && (
                          <div className="hidden md:block">
                            <button
                              onClick={() => navigate(`/admin/kitchens/${payment.invoice?.auction?.kitchen?.id}`)}
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <Truck className="h-3 w-3 shrink-0" />
                              {payment.invoice?.auction?.kitchen?.manufacturer} {payment.invoice?.auction?.kitchen?.model}
                            </button>
                          </div>
                        )}
                        <div>
                          <Badge variant="outline">
                            {payment.payment_method === 'bank_transfer' ? 'Überweisung' :
                             payment.payment_method === 'cash' ? 'Bar' :
                             payment.payment_method === 'paypal' ? 'PayPal' :
                             payment.payment_method === 'credit_card' ? 'Kreditkarte' :
                             payment.payment_method === 'direct_debit' ? 'Lastschrift' :
                             payment.payment_method || 'Sonstige'}
                          </Badge>
                        </div>
                        {payment.payment_reference && (
                          <div className="text-xs text-muted-foreground">
                            Ref: {payment.payment_reference}
                          </div>
                        )}
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        {payment.status === 'completed' ? 'Abgeschlossen' : payment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      {selectedInvoice && (
        <RecordPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          invoice={selectedInvoice}
        />
      )}

      {/* Storno Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Rechnung stornieren?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {/*
                Radix's AlertDialogDescription renders as `<p>` by default,
                which makes nesting block elements like additional `<p>` or
                `<div>` invalid HTML and triggers React DOM-nesting warnings.
                We use `asChild` so Radix forwards the aria-describedby to
                our own `<div>` instead, preserving accessibility while
                allowing rich content.
              */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  Sie sind dabei, die Rechnung <strong>{invoiceToDelete?.invoice_number}</strong> zu stornieren.
                </div>
                {invoiceToDelete?.dealer && (
                  <div>
                    Kunde:{' '}
                    <strong>
                      {invoiceToDelete.dealer.company_name ||
                        `${invoiceToDelete.dealer.first_name || ''} ${invoiceToDelete.dealer.last_name || ''}`}
                    </strong>
                    {(invoiceToDelete.customer_number || invoiceToDelete.dealer?.customer_number) && (
                      <> ({invoiceToDelete.customer_number || invoiceToDelete.dealer.customer_number})</>
                    )}
                  </div>
                )}
                {getVehicleLabel(invoiceToDelete) && (
                  <div>
                    Fahrzeug: <strong>{getVehicleLabel(invoiceToDelete)}</strong>
                  </div>
                )}
                <div>
                  Betrag:{' '}
                  <strong>
                    {Number(invoiceToDelete?.gross_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </strong>
                  {' '}(Netto: {Number(invoiceToDelete?.net_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  {' '}+ MwSt: {Number(invoiceToDelete?.tax_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})
                </div>
                <div className="text-amber-700 font-medium mt-3">
                  Die Rechnung wird als storniert markiert und bleibt aus Aufbewahrungsgründen im System erhalten.
                  Offene Forderungen werden auf 0 gesetzt. Der Händler erhält automatisch eine Storno-E-Mail.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Grund der Stornierung (optional, wird in der E-Mail mitgeteilt)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="z.B. Auftrag rückgängig gemacht, Versehen, Kulanz …"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                invoiceToDelete &&
                cancelInvoiceMutation.mutate({
                  invoiceId: invoiceToDelete.id,
                  reason: cancelReason.trim() || null,
                })
              }
              disabled={cancelInvoiceMutation.isPending}
            >
              {cancelInvoiceMutation.isPending ? 'Wird storniert...' : 'Rechnung stornieren'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Seller Penalty Dialog */}
      <CreateSellerPenaltyDialog
        open={penaltyDialogOpen}
        onOpenChange={setPenaltyDialogOpen}
      />
    </div>
  );
}
