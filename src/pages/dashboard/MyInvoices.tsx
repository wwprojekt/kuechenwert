import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { FileText, Download, Clock, CheckCircle, AlertCircle, Euro, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
    motorhome?: {
      manufacturer: string;
      model: string;
    };
  };
}

export default function MyInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadInvoices = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select(`
            *,
            auction:auctions (
              id,
              motorhome:motorhomes (
                manufacturer,
                model
              )
            )
          `)
          .eq("dealer_id", user.id)
          .order("invoice_date", { ascending: false });

        if (error) throw error;
        setInvoices((data as unknown as Invoice[]) || []);
      } catch (error) {
        console.error("Error loading invoices:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, [user]);

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
      <div>
        <h1 className="text-3xl font-bold">Meine Rechnungen</h1>
        <p className="text-muted-foreground">
          Übersicht Ihrer Rechnungen und Zahlungen
        </p>
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
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Keine Rechnungen</h3>
              <p className="text-muted-foreground">
                Sie haben noch keine Rechnungen erhalten.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rechnungsnr.</TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Fällig</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Zahlung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
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
                        {invoice.auction?.motorhome ? (
                          <span>
                            {invoice.auction.motorhome.manufacturer} {invoice.auction.motorhome.model}
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
                          {invoice.pdf_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4 mr-1" />
                                PDF
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
