import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLiveData } from "@/hooks/useLiveData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download, Clock, CheckCircle, AlertCircle, Euro, TrendingUp, Hash, Loader2 } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useToast } from "@/hooks/use-toast";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DealerProfile {
  customer_number: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  net_amount: number;
  tax_amount: number;
  gross_amount: number;
  amount_paid: number | null;
  status: string;
  payment_status: string;
  pdf_url: string | null;
  created_at: string | null;
  auction?: {
    id: string;
    vehicle?: {
      manufacturer: string;
      model: string;
    };
  };
}

export default function MyInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [customerNumber, setCustomerNumber] = useState<string | null>(null);

  const { sortField, sortDirection, handleSort, sortData } = useTableSort<Invoice>('invoice_date', 'desc');

  const invoiceSortAccessors: Record<string, (i: Invoice) => unknown> = {
    invoice_number: (i) => i.invoice_number || '',
    vehicle: (i) => `${i.auction?.vehicle?.manufacturer || ''} ${i.auction?.vehicle?.model || ''}`.toLowerCase(),
    invoice_date: (i) => i.invoice_date || '',
    due_date: (i) => i.due_date || '',
    gross_amount: (i) => i.gross_amount || 0,
  };

  const sortedInvoices = useMemo(() => sortData(invoices, invoiceSortAccessors), [invoices, sortData]);

  const loadInvoices = useCallback(async () => {
    if (!user) return;

    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('customer_number')
        .eq('id', user.id)
        .single();
      if (profileData?.customer_number) setCustomerNumber(profileData.customer_number);

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          auction:auctions (
            id,
            vehicle:vehicles (
              manufacturer,
              model
            )
          )
        `)
        .eq("dealer_id", user.id)
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      setInvoices((data as unknown as Invoice[]) || []);
      setLoadError(false);
    } catch (error) {
      console.error("Error loading invoices:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useLiveData(loadInvoices, { enabled: !!user, pollingInterval: 60_000 });

  const openInvoicePdf = async (invoice: Invoice) => {
    setPdfLoading(invoice.id);
    try {
      // 1) Try stored pdf_url
      if (invoice.pdf_url) {
        window.open(invoice.pdf_url, '_blank');
        return;
      }
      // 2) Fallback: generate fresh signed URL from storage
      if (user?.id && invoice.invoice_number) {
        const storagePath = `${user.id}/${invoice.invoice_number}.pdf`;
        const { data } = await supabase.storage
          .from('invoices')
          .createSignedUrl(storagePath, 3600);
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
          return;
        }
      }
      toast({
        title: 'PDF nicht verfügbar',
        description: 'Die Rechnung konnte nicht geladen werden. Bitte kontaktieren Sie den Support.',
        variant: 'destructive',
      });
    } catch (err) {
      console.error('Error opening invoice PDF:', err);
      toast({
        title: 'Fehler',
        description: 'Die Rechnung konnte nicht geöffnet werden.',
        variant: 'destructive',
      });
    } finally {
      setPdfLoading(null);
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    const status = invoice.payment_status || invoice.status;
    const isOverdue = new Date(invoice.due_date) < new Date();
    
    switch (status) {
      case "paid":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
            <CheckCircle className="w-3 h-3" />
            Bezahlt
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600 gap-1">
            <TrendingUp className="w-3 h-3" />
            Teilbezahlt
          </Badge>
        );
      case "pending":
      default:
        if (isOverdue) {
          return (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              Überfällig
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-600 gap-1">
            <Clock className="w-3 h-3" />
            Offen
          </Badge>
        );
    }
  };

  // Calculate actual outstanding amount (gross_amount - amount_paid for non-paid invoices)
  const totalOutstanding = invoices
    .filter(inv => (inv.payment_status || inv.status) !== "paid")
    .reduce((sum, inv) => sum + (inv.gross_amount - (inv.amount_paid || 0)), 0);

  // Calculate total amount paid (sum of all amount_paid)
  const totalPaid = invoices
    .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);

  // Count partial payments
  const partialCount = invoices.filter(inv => inv.payment_status === "partial").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Meine Rechnungen</h1>
          <p className="text-muted-foreground">
            Übersicht Ihrer Rechnungen und Zahlungen
          </p>
        </div>
        {customerNumber && (
          <div className="inline-flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-4 py-2">
            <Hash className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground font-medium">Kundennummer:</span>
            <span className="text-sm font-bold text-primary">{customerNumber}</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesamt Rechnungen</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </div>
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offener Betrag</p>
                <p className="text-2xl font-bold text-orange-600">
                  {totalOutstanding.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bezahlt</p>
                <p className="text-2xl font-bold text-green-600">
                  {totalPaid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        {partialCount > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Teilbezahlt</p>
                  <p className="text-2xl font-bold text-blue-600">{partialCount}</p>
                  <p className="text-xs text-muted-foreground">Rechnungen</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Rechnungsübersicht
          </CardTitle>
          <CardDescription>
            Alle Ihre Rechnungen im Überblick
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : loadError ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Laden fehlgeschlagen</h3>
              <p className="text-muted-foreground mb-4">
                Rechnungen konnten nicht geladen werden.
              </p>
              <Button variant="outline" onClick={loadInvoices}>Erneut versuchen</Button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Keine Rechnungen</h3>
              <p className="text-muted-foreground">
                Sie haben noch keine Rechnungen erhalten.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="invoice_number" label="Rechnungsnr." sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="vehicle" label="Fahrzeug" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="invoice_date" label="Datum" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="due_date" label="Fällig" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="gross_amount" label="Betrag" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right" />
                  <TableHead>Zahlung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInvoices.map((invoice) => {
                  const amountPaid = invoice.amount_paid || 0;
                  const remaining = invoice.gross_amount - amountPaid;
                  const paymentProgress = (amountPaid / invoice.gross_amount) * 100;
                  const isPaid = (invoice.payment_status || invoice.status) === "paid";
                  
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        {invoice.auction?.vehicle ? (
                          <span>
                            {invoice.auction.vehicle.manufacturer} {invoice.auction.vehicle.model}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoice_date), "dd.MM.yyyy", { locale: de })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.due_date), "dd.MM.yyyy", { locale: de })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <Euro className="w-3 h-3" />
                          {invoice.gross_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isPaid ? (
                          <span className="text-green-600 text-sm font-medium">Vollständig</span>
                        ) : (
                          <div className="min-w-[120px]">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                €{amountPaid.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="font-medium">
                                {Math.round(paymentProgress)}%
                              </span>
                            </div>
                            <Progress value={paymentProgress} className="h-1.5" />
                            {remaining > 0.01 && (
                              <div className="text-xs text-orange-600 mt-0.5">
                                Offen: €{remaining.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pdfLoading === invoice.id}
                            onClick={() => openInvoicePdf(invoice)}
                          >
                            {pdfLoading === invoice.id ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 mr-1" />
                            )}
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
