/**
 * Admin Financial Dashboard
 * Complete financial management and invoice overview
 * Supports full and partial payment tracking
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
import { useToast } from '@/hooks/use-toast';
import { 
  Euro, 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Download,
  Send,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { getInvoiceStatistics } from '@/lib/invoiceGenerator';
import { RecordPaymentDialog } from '@/components/admin/RecordPaymentDialog';

export default function AdminFinancials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Fetch financial statistics
  const { data: stats } = useQuery({
    queryKey: ['financial-stats'],
    queryFn: getInvoiceStatistics,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email),
          auction:auctions(
            motorhome:motorhomes(manufacturer, model)
          ),
          reminders:payment_reminders(reminder_level, reminder_date)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch overdue invoices (includes pending and partial)
  const { data: overdueInvoices } = useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email)
        `)
        .in('payment_status', ['pending', 'partial'])
        .lt('due_date', new Date().toISOString())
        .order('due_date');
      
      if (error) throw error;
      return data;
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
    
    const isOverdue = new Date(invoice.due_date) < new Date();
    const reminderCount = invoice.reminders?.length || 0;
    
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

  const filteredInvoices = invoices?.filter(invoice => {
    const matchesSearch = searchTerm === '' || 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.dealer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.dealer.company_name && invoice.dealer.company_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'paid' && invoice.payment_status === 'paid') ||
      (statusFilter === 'pending' && invoice.payment_status === 'pending') ||
      (statusFilter === 'partial' && invoice.payment_status === 'partial') ||
      (statusFilter === 'overdue' && (invoice.payment_status === 'pending' || invoice.payment_status === 'partial') && new Date(invoice.due_date) < new Date());
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Finanzen & Rechnungen</h1>
          <p className="text-muted-foreground">
            Übersicht über alle Rechnungen und Zahlungen
          </p>
        </div>
      </div>

      {/* Financial Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtumsatz</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) || '€0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Bezahlte Rechnungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.outstandingAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) || '€0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Offene Forderungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Überfällig</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.overdueInvoices || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Rechnungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bezahlt</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.paidInvoices || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Rechnungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalInvoices || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Rechnungen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Rechnungsübersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Suchen nach Rechnungsnummer, E-Mail oder Firma..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
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
          </div>

          {/* Invoice List */}
          <div className="space-y-4">
            {invoicesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              filteredInvoices?.map((invoice: any) => {
                const amountPaid = invoice.amount_paid || 0;
                const remaining = invoice.gross_amount - amountPaid;
                const paymentProgress = (amountPaid / invoice.gross_amount) * 100;
                
                return (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-6">
                        <div className="min-w-[140px]">
                          <div className="font-medium">{invoice.invoice_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {invoice.dealer.company_name || 
                             `${invoice.dealer.first_name} ${invoice.dealer.last_name}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Fällig: {format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: de })}
                          </div>
                        </div>
                        
                        {/* Payment Progress Section */}
                        <div className="flex-1 max-w-xs">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Bezahlt</span>
                            <span className="font-medium">
                              €{amountPaid.toLocaleString('de-DE', { minimumFractionDigits: 2 })} / €{invoice.gross_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <Progress value={paymentProgress} className="h-2" />
                          {remaining > 0.01 && (
                            <div className="text-xs text-orange-600 mt-1">
                              Offen: €{remaining.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right min-w-[100px]">
                          <div className="text-sm text-muted-foreground">
                            {invoice.auction?.motorhome?.manufacturer} {invoice.auction?.motorhome?.model}
                          </div>
                        </div>
                        
                        {getStatusBadge(invoice)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {invoice.pdf_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.pdf_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {invoice.payment_status !== 'paid' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendReminderMutation.mutate(invoice.id)}
                            disabled={sendReminderMutation.isPending}
                            title="Zahlungserinnerung senden"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Zahlung erfassen
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            
            {filteredInvoices?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Keine Rechnungen gefunden
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Invoices Alert */}
      {overdueInvoices && overdueInvoices.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Überfällige Rechnungen ({overdueInvoices.length})
            </CardTitle>
            <CardDescription className="text-red-700">
              Diese Rechnungen sind überfällig und benötigen Aufmerksamkeit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueInvoices.slice(0, 5).map((invoice: any) => {
                const daysPastDue = Math.floor(
                  (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
                );
                
                return (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-white rounded border">
                    <div>
                      <div className="font-medium">{invoice.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {invoice.dealer.company_name || 
                         `${invoice.dealer.first_name} ${invoice.dealer.last_name}`} • 
                        {daysPastDue} Tage überfällig
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600">
                        €{invoice.gross_amount.toLocaleString('de-DE')}
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => sendReminderMutation.mutate(invoice.id)}
                      >
                        Mahnung senden
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Umsatzentwicklung</CardTitle>
          <CardDescription>
            Monatliche Umsätze der letzten 12 Monate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {/* Placeholder for revenue chart - would need historical data */}
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                <p>Umsatzdiagramm</p>
                <p className="text-sm">Wird mit historischen Daten gefüllt</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        invoice={selectedInvoice}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
    </div>
  );
}
