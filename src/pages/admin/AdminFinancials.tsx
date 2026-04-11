/**
 * Admin Financial Dashboard
 * Complete financial management and invoice overview
 * Features: Search by invoice/customer number, delete invoices, extended stats,
 * customer number display, date range filter, payment history
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Download,
  Send,
  CreditCard,
  Trash2,
  Search,
  Users,
  BarChart3,
  History,
  RefreshCw,
  Eye,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Gavel,
  Scale
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { getInvoiceStatistics } from '@/lib/invoiceGenerator';
import { RecordPaymentDialog } from '@/components/admin/RecordPaymentDialog';
import { useSettings } from '@/contexts/SettingsContext';
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";

export default function AdminFinancials() {
  const { settings } = useSettings();

  // Configurable dunning levels from admin settings
  const dunningLevel1Days = settings?.dunning_level1_days ?? 14;
  const dunningLevel2Days = settings?.dunning_level2_days ?? 28;
  const dunningLevel3Days = settings?.dunning_level3_days ?? 42;
  const dunningLevel1Fee = settings?.dunning_level1_fee ?? 5.00;
  const dunningLevel2Fee = settings?.dunning_level2_fee ?? 10.00;
  const dunningLevel3Fee = settings?.dunning_level3_fee ?? 15.00;
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
  const [activeTab, setActiveTab] = useState('invoices');

  // Open invoice PDF – use stored pdf_url or generate fresh signed URL
  const openInvoicePdf = async (invoice: any) => {
    // 1) Try existing pdf_url
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank');
      return;
    }
    // 2) Fallback: create a fresh signed URL from storage
    const storagePath = `${invoice.dealer_id}/${invoice.invoice_number}.pdf`;
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(storagePath, 3600); // 1h validity
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
      return;
    }
    // 3) Try to regenerate via edge function
    const { error: genError } = await supabase.functions.invoke('generate-invoice-pdf', {
      body: { invoiceId: invoice.id },
    });
    if (!genError) {
      // Refetch invoices so pdf_url is updated, then retry
      await queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      toast({
        title: 'PDF wird generiert',
        description: 'Die Rechnung wird neu erstellt. Bitte versuchen Sie es gleich erneut.',
      });
      return;
    }
    toast({
      title: 'PDF nicht verfügbar',
      description: 'Für diese Rechnung ist kein PDF vorhanden. Bitte generieren Sie die Rechnung neu.',
      variant: 'destructive',
    });
  };

  // Fetch financial statistics
  const { data: stats } = useQuery({
    queryKey: ['financial-stats'],
    queryFn: getInvoiceStatistics,
    refetchInterval: 30000,
  });

  // Fetch all invoices with customer_number
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email, customer_number),
          auction:auctions(
            motorhome:motorhomes(manufacturer, model)
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
      const { data, error } = await supabase
        .from('dealer_payment_history')
        .select(`
          *,
          invoice:invoices(invoice_number, customer_number),
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
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email, customer_number)
        `)
        .in('payment_status', ['pending', 'partial'])
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
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email, customer_number, phone),
          reminders:payment_reminders(id, reminder_level, reminder_date, reminder_fee, total_amount)
        `)
        .in('payment_status', ['pending', 'partial'])
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
      { key: "auction", label: "Fahrzeug", format: (value: any) => value?.motorhome ? `${value.motorhome.manufacturer} ${value.motorhome.model}` : "" },
      { key: "gross_amount", label: "Betrag", format: (value: any) => `€${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` },
      { key: "amount_paid", label: "Bezahlt", format: (value: any) => `€${Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` },
      { key: "gross_amount", label: "Restbetrag", format: (value: any, row: any) => `€${(Number(row.gross_amount) - Number(row.amount_paid || 0)).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` },
      { key: "payment_status", label: "Status" },
      { key: "invoice_date", label: "Rechnungsdatum", format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "" },
      { key: "due_date", label: "Fällig am", format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "" },
    ],
  });

  // Delete invoice mutation
  // WICHTIG: Invoice ZUERST löschen! Der DB-Trigger prevent_invoice_deletion
  // kann das blockieren (Aufbewahrungspflicht). Wenn wir erst die Items löschen
  // und dann die Invoice fehlschlägt, entstehen verwaiste Datensätze.
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      // 1) Invoice ZUERST löschen – kann durch DB-Trigger blockiert werden
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (invoiceError) throw invoiceError;

      // 2) Erst wenn Invoice weg ist, abhängige Daten aufräumen
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);
      if (itemsError) throw itemsError;

      const { error: remindersError } = await supabase
        .from('payment_reminders')
        .delete()
        .eq('invoice_id', invoiceId);
      if (remindersError) throw remindersError;

      const { error: historyError } = await supabase
        .from('dealer_payment_history')
        .delete()
        .eq('invoice_id', invoiceId);
      if (historyError) throw historyError;

      // PDF aus Storage löschen (nicht kritisch)
      try {
        const invoice = invoices?.find((i: any) => i.id === invoiceId);
        if (invoice?.dealer_id && invoice?.invoice_number) {
          await supabase.storage
            .from('invoices')
            .remove([`${invoice.dealer_id}/${invoice.invoice_number}.pdf`]);
        }
      } catch {
        // Storage deletion is non-critical
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      toast({
        title: 'Rechnung gelöscht',
        description: 'Die Rechnung und alle zugehörigen Daten wurden gelöscht.',
      });
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Löschen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('process-dunning', {
        body: { invoiceId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      toast({
        title: 'Erfolg',
        description: 'Zahlungserinnerung versendet',
      });
    },
  });

  const getStatusBadge = (invoice: any) => {
    if (invoice.payment_status === 'paid') {
      return <Badge className="bg-green-100 text-green-800">Bezahlt</Badge>;
    }
    
    if (invoice.payment_status === 'partial') {
      return <Badge className="bg-blue-100 text-blue-800">Teilbezahlt</Badge>;
    }
    
    if (invoice.payment_status === 'cancelled') {
      return <Badge className="bg-gray-100 text-gray-800">Storniert</Badge>;
    }
    
    const isOverdue = new Date(invoice.due_date) < new Date();
    const safeRem = Array.isArray(invoice.reminders) ? invoice.reminders : invoice.reminders ? [invoice.reminders] : [];
    const reminderCount = safeRem.length;
    
    if (isOverdue) {
      if (reminderCount >= 2) {
        return <Badge variant="destructive">2. Mahnung</Badge>;
      } else if (reminderCount >= 1) {
        return <Badge className="bg-orange-100 text-orange-800">1. Mahnung</Badge>;
      } else {
        return <Badge className="bg-yellow-100 text-yellow-800">Überfällig</Badge>;
      }
    }
    
    return <Badge variant="outline">Offen</Badge>;
  };

  // Date filter logic
  const filterByDate = (invoice: any) => {
    if (dateFilter === 'all') return true;
    const invoiceDate = new Date(invoice.invoice_date || invoice.created_at);
    const now = new Date();
    
    switch (dateFilter) {
      case '7days':
        return invoiceDate >= subDays(now, 7);
      case '30days':
        return invoiceDate >= subDays(now, 30);
      case 'thisMonth':
        return isWithinInterval(invoiceDate, { start: startOfMonth(now), end: endOfMonth(now) });
      case 'lastMonth': {
        const lastMonth = subMonths(now, 1);
        return isWithinInterval(invoiceDate, { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) });
      }
      case '3months':
        return invoiceDate >= subMonths(now, 3);
      case '6months':
        return invoiceDate >= subMonths(now, 6);
      case '12months':
        return invoiceDate >= subMonths(now, 12);
      default:
        return true;
    }
  };

  const filteredInvoices = invoices?.filter(invoice => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.customer_number?.toLowerCase().includes(searchLower) ||
      invoice.dealer?.email?.toLowerCase().includes(searchLower) ||
      invoice.dealer?.customer_number?.toLowerCase().includes(searchLower) ||
      (invoice.dealer?.company_name && invoice.dealer.company_name.toLowerCase().includes(searchLower)) ||
      (`${invoice.dealer?.first_name || ''} ${invoice.dealer?.last_name || ''}`.toLowerCase().includes(searchLower));
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'paid' && invoice.payment_status === 'paid') ||
      (statusFilter === 'pending' && invoice.payment_status === 'pending') ||
      (statusFilter === 'partial' && invoice.payment_status === 'partial') ||
      (statusFilter === 'overdue' && (invoice.payment_status === 'pending' || invoice.payment_status === 'partial') && new Date(invoice.due_date) < new Date());
    
    const matchesDate = filterByDate(invoice);
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Extended statistics
  const totalGross = invoices?.reduce((sum, inv) => sum + Number(inv.gross_amount || 0), 0) || 0;
  const totalPaid = invoices?.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0) || 0;
  const totalOutstanding = totalGross - totalPaid;
  const overdueCount = invoices?.filter(inv => 
    (inv.payment_status === 'pending' || inv.payment_status === 'partial') && 
    new Date(inv.due_date) < new Date()
  ).length || 0;
  const overdueAmount = invoices?.filter(inv => 
    (inv.payment_status === 'pending' || inv.payment_status === 'partial') && 
    new Date(inv.due_date) < new Date()
  ).reduce((sum, inv) => sum + Number(inv.gross_amount || 0) - Number(inv.amount_paid || 0), 0) || 0;
  const paidCount = invoices?.filter(inv => inv.payment_status === 'paid').length || 0;
  const avgInvoiceAmount = invoices?.length ? totalGross / invoices.length : 0;
  const paymentRate = totalGross > 0 ? (totalPaid / totalGross) * 100 : 0;
  const dunningCount = dunningInvoices?.length || 0;
  const dunningAmount = dunningInvoices?.reduce((sum, inv) => sum + Number(inv.gross_amount || 0) - Number(inv.amount_paid || 0), 0) || 0;

  // This month stats
  const thisMonthInvoices = invoices?.filter(inv => {
    const d = new Date(inv.invoice_date || inv.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }) || [];
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['financial-stats'] });
            queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['payment-history'] });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Extended Financial Statistics - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtumsatz</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalGross.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {invoices?.length || 0} Rechnungen gesamt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Einnahmen</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
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
            <div className="text-2xl font-bold text-orange-600">
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
            <div className="text-2xl font-bold text-red-600">
              {overdueAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {overdueCount} überfällige Rechnungen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Extended Statistics - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zahlungsquote</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
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
            <div className="text-2xl font-bold">
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
            <div className="text-2xl font-bold text-primary">
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
            <div className="text-2xl font-bold">
              {new Set(invoices?.map(inv => inv.dealer_id)).size || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Aktive Rechnungsempfänger
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Rechnungen / Überfällig / Zahlungshistorie */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
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
                Suchen Sie nach Rechnungsnummer, Kundennummer, Firma oder E-Mail
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechnungsnr., Kundennr., Firma oder E-Mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="pending">Offen</SelectItem>
                    <SelectItem value="partial">Teilbezahlt</SelectItem>
                    <SelectItem value="paid">Bezahlt</SelectItem>
                    <SelectItem value="overdue">Überfällig</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-44">
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
                    const remaining = grossAmount - amountPaid;
                    const paymentProgress = grossAmount > 0 ? (amountPaid / grossAmount) * 100 : 0;
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
                              <div className="font-semibold text-primary cursor-pointer hover:underline" onClick={() => openInvoicePdf(invoice)}>
                                {invoice.invoice_number}
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

                            {/* Vehicle */}
                            <div className="hidden lg:block min-w-[150px]">
                              <div className="font-medium text-sm">
                                {invoice.auction?.motorhome?.manufacturer} {invoice.auction?.motorhome?.model}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd.MM.yyyy', { locale: de }) : ''}
                              </div>
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
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentDialogOpen(true);
                            }}
                            disabled={invoice.payment_status === 'paid'}
                            title="Zahlung erfassen"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={() => sendReminderMutation.mutate(invoice.id)}
                            disabled={sendReminderMutation.isPending || invoice.payment_status === 'paid'}
                            title="Mahnung senden"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setInvoiceToDelete(invoice);
                              setDeleteDialogOpen(true);
                            }}
                            title="Rechnung löschen"
                          >
                            <Trash2 className="h-4 w-4" />
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
                    const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
                    const remaining = Number(invoice.gross_amount) - Number(invoice.amount_paid || 0);
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
              {!dunningInvoices?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Scale className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg font-medium">Keine aktiven Mahnverfahren</p>
                  <p className="text-sm">Es gibt derzeit keine Rechnungen im Mahnprozess ({dunningLevel1Days}+ Tage überfällig).</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dunningInvoices.map((invoice: any) => {
                    const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
                    const remaining = Number(invoice.gross_amount) - Number(invoice.amount_paid || 0);
                    const custNum = invoice.customer_number || invoice.dealer?.customer_number || '';
                    const safeReminders = Array.isArray(invoice.reminders) ? invoice.reminders : invoice.reminders ? [invoice.reminders] : [];
                    const reminderCount = safeReminders.length;
                    const maxLevel = safeReminders.reduce((max: number, r: any) => Math.max(max, r.reminder_level || 0), 0);
                    const lastReminder = [...safeReminders].sort((a: any, b: any) => new Date(b.reminder_date).getTime() - new Date(a.reminder_date).getTime())[0];
                    const totalFees = safeReminders.reduce((sum: number, r: any) => sum + Number(r.reminder_fee || 0), 0);
                    
                    // Dunning level classification
                    let levelColor = 'bg-yellow-100 border-yellow-300 text-yellow-800';
                    let levelLabel = 'Zahlungserinnerung';
                    let levelBg = 'bg-yellow-50/50 border-yellow-200';
                    if (maxLevel >= 3 || daysOverdue > dunningLevel3Days) {
                      levelColor = 'bg-red-100 border-red-300 text-red-800';
                      levelLabel = `3. Mahnung – Letzte Warnung (${dunningLevel3Fee.toFixed(2)} € Gebühr)`;
                      levelBg = 'bg-red-50/80 border-red-300';
                    } else if (maxLevel >= 2 || daysOverdue > dunningLevel2Days) {
                      levelColor = 'bg-orange-100 border-orange-300 text-orange-800';
                      levelLabel = `2. Mahnung (${dunningLevel2Fee.toFixed(2)} € Gebühr)`;
                      levelBg = 'bg-orange-50/50 border-orange-200';
                    } else if (maxLevel >= 1 || daysOverdue > dunningLevel1Days) {
                      levelColor = 'bg-amber-100 border-amber-300 text-amber-800';
                      levelLabel = `1. Mahnung (${dunningLevel1Fee.toFixed(2)} € Gebühr)`;
                      levelBg = 'bg-amber-50/50 border-amber-200';
                    }

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
                              {custNum && (
                                <div className="text-xs text-blue-600 font-semibold mt-0.5">{custNum}</div>
                              )}
                              {invoice.dealer?.email && (
                                <div className="text-xs text-muted-foreground">{invoice.dealer.email}</div>
                              )}
                            </div>
                            
                            {/* Dunning Status */}
                            <div className="space-y-1.5">
                              <Badge className={levelColor}>{levelLabel}</Badge>
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
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => {
                                  setInvoiceToDelete(invoice);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Löschen
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Rechnung unwiderruflich löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Sie sind dabei, die Rechnung <strong>{invoiceToDelete?.invoice_number}</strong> zu löschen.
              </p>
              {invoiceToDelete?.dealer && (
                <p>
                  Kunde: <strong>
                    {invoiceToDelete.dealer.company_name || 
                     `${invoiceToDelete.dealer.first_name || ''} ${invoiceToDelete.dealer.last_name || ''}`}
                  </strong>
                  {(invoiceToDelete.customer_number || invoiceToDelete.dealer?.customer_number) && (
                    <> ({invoiceToDelete.customer_number || invoiceToDelete.dealer.customer_number})</>
                  )}
                </p>
              )}
              <p>
                Betrag: <strong>
                  {Number(invoiceToDelete?.gross_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </strong>
              </p>
              <p className="text-destructive font-medium mt-3">
                Folgende Daten werden ebenfalls gelöscht:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Alle Rechnungspositionen</li>
                <li>Alle Zahlungseingänge zu dieser Rechnung</li>
                <li>Alle Mahnungen zu dieser Rechnung</li>
                <li>Das gespeicherte PDF</li>
              </ul>
              <p className="font-bold text-destructive mt-2">
                Diese Aktion kann nicht rückgängig gemacht werden!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => invoiceToDelete && deleteInvoiceMutation.mutate(invoiceToDelete.id)}
              disabled={deleteInvoiceMutation.isPending}
            >
              {deleteInvoiceMutation.isPending ? 'Wird gelöscht...' : 'Endgültig löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
