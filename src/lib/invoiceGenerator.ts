/**
 * Invoice Generator Library
 * German tax-compliant invoice generation and management
 */

import { supabase } from '@/integrations/supabase/client';
import { invokeWithAuth, ensureValidRLSSession } from '@/lib/sessionGuard';
import { logger } from './logger';

export interface InvoiceData {
  id: string;
  invoice_number: string;
  dealer_id: string;
  auction_id?: string;
  invoice_date: string;
  due_date: string;
  net_amount: number;
  tax_rate: number;
  tax_amount: number;
  gross_amount: number;
  amount_paid: number;
  status: string;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  ust_id_seller?: string;
  ust_id_buyer?: string;
}

export interface PaymentRecord {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  processedBy?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  net_amount: number;
  tax_rate: number;
  tax_amount: number;
  gross_amount: number;
  item_type: string;
}

export interface DealerInfo {
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
}

function escapeHtml(unsafe: unknown): string {
  const str = String(unsafe ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class InvoiceGeneratorService {
  /**
   * Create invoice for completed auction
   */
  async createAuctionInvoice(auctionId: string, dealerId: string): Promise<string> {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      // Use the database function to create invoice
      const { data, error } = await supabase
        .rpc('create_auction_invoice', {
          auction_id_param: auctionId,
          dealer_id_param: dealerId
        });

      if (error) throw error;

      const invoiceId = data;
      
      // Generate and upload PDF
      await this.generateInvoicePDF(invoiceId);
      
      // Mark invoice as ready to send
      await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoiceId);

      return invoiceId;
    } catch (error) {
      logger.error('Error creating auction invoice:', error);
      throw error;
    }
  }

  /**
   * Generate PDF for invoice
   */
  async generateInvoicePDF(invoiceId: string): Promise<string> {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      // Fetch invoice with related data
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          dealer:profiles(*),
          auction:auctions(
            *,
            motorhome:motorhomes(*)
          ),
          items:invoice_items(*)
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        throw new Error('Invoice not found');
      }

      // Get site settings for company info
      const { data: settings } = await supabase
        .from('site_settings')
        .select('*')
        .single();

      // Generate PDF content
      const pdfContent = this.generateInvoiceHTML(invoice, settings);

      // For now, store as HTML file (in production, use proper PDF generation)
      const fileName = `invoice_${invoice.invoice_number}.html`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, pdfContent, {
          contentType: 'text/html',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('invoices')
        .createSignedUrl(fileName, 3600);
      if (signedUrlError || !signedUrlData?.signedUrl) throw new Error('Failed to create signed URL for invoice');
      const publicUrl = signedUrlData.signedUrl;

      // Update invoice with PDF URL
      await supabase
        .from('invoices')
        .update({ pdf_url: publicUrl })
        .eq('id', invoiceId);

      return publicUrl;
    } catch (error) {
      logger.error('Error generating invoice PDF:', error);
      throw error;
    }
  }

  /**
   * Generate German tax-compliant invoice HTML
   */
  private generateInvoiceHTML(invoice: any, settings: any): string {
    const dealerName = escapeHtml(invoice.dealer.company_name || 
      `${invoice.dealer.first_name} ${invoice.dealer.last_name}`);
    
    const _motorhomeName = invoice.auction ? 
      `${escapeHtml(invoice.auction.motorhome.manufacturer)} ${escapeHtml(invoice.auction.motorhome.model)}` : 
      'Provision';

    return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${invoice.invoice_number}</title>
  <style>
    body { 
      font-family: 'Arial', sans-serif; 
      line-height: 1.6; 
      color: #333; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px; 
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: start; 
      margin-bottom: 40px; 
      border-bottom: 2px solid #f0f0f0; 
      padding-bottom: 20px; 
    }
    .company-info { text-align: left; }
    .invoice-info { text-align: right; }
    .invoice-title { 
      font-size: 28px; 
      font-weight: bold; 
      color: #2563eb; 
      margin: 20px 0; 
    }
    .customer-info { 
      margin: 30px 0; 
      padding: 20px; 
      background: #f8f9fa; 
      border-left: 4px solid #2563eb; 
    }
    .invoice-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 30px 0; 
    }
    .invoice-table th, .invoice-table td { 
      padding: 12px; 
      text-align: left; 
      border-bottom: 1px solid #ddd; 
    }
    .invoice-table th { 
      background: #f8f9fa; 
      font-weight: bold; 
    }
    .total-row { 
      font-weight: bold; 
      background: #f0f8ff; 
    }
    .payment-info { 
      margin: 40px 0; 
      padding: 20px; 
      background: #fff3cd; 
      border: 1px solid #ffeaa7; 
      border-radius: 4px; 
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #ddd; 
      font-size: 12px; 
      color: #666; 
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>${escapeHtml(settings?.site_name || 'CaravanWert')}</h1>
      <p>${escapeHtml(settings?.company_address || '')}${settings?.company_address ? '<br>' : ''}${escapeHtml(settings?.company_postal_code || '')} ${escapeHtml(settings?.company_city || '')}${(settings?.company_postal_code || settings?.company_city) ? '<br>' : ''}${escapeHtml(settings?.company_country || 'Deutschland')}</p>
      <p>Tel: ${escapeHtml(settings?.support_phone || '')}<br>
         E-Mail: ${escapeHtml(settings?.contact_email || '')}</p>
      <p><strong>USt-ID:</strong> ${escapeHtml(settings?.ust_id || '[BITTE IN EINSTELLUNGEN HINTERLEGEN]')}</p>
    </div>
    <div class="invoice-info">
      <h2 class="invoice-title">RECHNUNG</h2>
      <p><strong>Rechnungsnr.:</strong> ${escapeHtml(invoice.invoice_number)}</p>
      <p><strong>Rechnungsdatum:</strong> ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')}</p>
      <p><strong>Fälligkeitsdatum:</strong> ${new Date(invoice.due_date).toLocaleDateString('de-DE')}</p>
    </div>
  </div>

  <div class="customer-info">
    <h3>Rechnungsempfänger</h3>
    <p><strong>${dealerName}</strong></p>
    ${invoice.ust_id_buyer ? `<p>USt-ID: ${escapeHtml(invoice.ust_id_buyer)}</p>` : ''}
    <p>${escapeHtml(invoice.dealer.email)}</p>
  </div>

  <p>Sehr geehrte Damen und Herren,</p>
  <p>hiermit stellen wir Ihnen folgende Leistungen in Rechnung:</p>

  <table class="invoice-table">
    <thead>
      <tr>
        <th>Position</th>
        <th>Beschreibung</th>
        <th class="text-right">Menge</th>
        <th class="text-right">Einzelpreis (netto)</th>
        <th class="text-right">Gesamtpreis (netto)</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items.map((item: any, index: number) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">€${item.unit_price.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">€${item.net_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4"><strong>Nettobetrag</strong></td>
        <td class="text-right"><strong>€${invoice.net_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
      <tr>
        <td colspan="4">zzgl. ${invoice.tax_rate}% MwSt.</td>
        <td class="text-right">€${invoice.tax_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr class="total-row">
        <td colspan="4"><strong>Gesamtbetrag</strong></td>
        <td class="text-right"><strong>€${invoice.gross_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    </tfoot>
  </table>

  <div class="payment-info">
    <h3>Zahlungsinformationen</h3>
    <p><strong>Zahlungsziel:</strong> ${invoice.payment_terms_days} Tage (bis ${new Date(invoice.due_date).toLocaleDateString('de-DE')})</p>
    <p><strong>Bankverbindung:</strong></p>
    <p>
      IBAN: ${escapeHtml(settings?.bank_iban || '[BITTE IN EINSTELLUNGEN HINTERLEGEN]')}<br>
      BIC: ${escapeHtml(settings?.bank_bic || '[BITTE IN EINSTELLUNGEN HINTERLEGEN]')}<br>
      ${escapeHtml(settings?.bank_name || '[BITTE IN EINSTELLUNGEN HINTERLEGEN]')}<br>
      Verwendungszweck: ${escapeHtml(invoice.invoice_number)}
    </p>
  </div>

  <p>Vielen Dank für Ihr Vertrauen!</p>
  <p>Ihr ${escapeHtml(settings?.site_name || 'CaravanWert')} Team</p>

  <div class="footer">
    <div class="text-center">
      <p>${escapeHtml(settings?.site_name || 'CaravanWert')} • ${settings?.managing_director ? `Geschäftsführer: ${escapeHtml(settings.managing_director)}` : '[Geschäftsführer BITTE ERGÄNZEN]'} • ${escapeHtml(settings?.hrb_number || '[HRB BITTE ERGÄNZEN]')}</p>
      <p>${settings?.tax_number ? `Steuernummer: ${escapeHtml(settings.tax_number)}` : '[Steuernummer BITTE ERGÄNZEN]'} • ${settings?.ust_id ? `USt-ID: ${escapeHtml(settings.ust_id)}` : '[USt-ID BITTE ERGÄNZEN]'}</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Send invoice via email
   */
  async sendInvoiceEmail(invoiceId: string): Promise<void> {
    try {
      const { data: _data, error } = await invokeWithAuth('send-invoice-email', {
        body: { invoiceId },
      });

      if (error) throw error;

      // Mark invoice as sent
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");
      await supabase
        .from('invoices')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', invoiceId);

    } catch (error) {
      logger.error('Error sending invoice email:', error);
      throw error;
    }
  }

  /**
   * Generate fresh PDF + send invoice email in one go.
   *
   * Used for:
   * - Auto-send after creating a Vertragsstrafe (CreateSellerPenaltyDialog)
   * - Manual "Send/Resend" button in AdminFinancials
   *
   * This guarantees the email always carries an up-to-date PDF attachment
   * regardless of whether `pdf_url` was already set on the invoice.
   *
   * Errors during PDF generation are NOT fatal: the email will still be sent
   * (without attachment) so the recipient at least gets the notification.
   */
  async sendInvoiceWithPdf(invoiceId: string): Promise<{ pdfGenerated: boolean }> {
    let pdfBase64: string | undefined;
    let pdfGenerated = false;

    try {
      const { data: pdfResult, error: pdfError } = await invokeWithAuth(
        'generate-invoice-pdf',
        { body: { invoiceId } }
      );

      if (pdfError) {
        logger.error('PDF generation failed before email send:', pdfError);
      } else if (pdfResult && typeof pdfResult === 'object' && 'pdfBase64' in pdfResult) {
        pdfBase64 = (pdfResult as { pdfBase64?: string }).pdfBase64;
        pdfGenerated = !!pdfBase64;
      }
    } catch (pdfErr) {
      logger.error('Unexpected error generating PDF before email send:', pdfErr);
    }

    const { error: emailError } = await invokeWithAuth('send-invoice-email', {
      body: { invoiceId, pdfBase64 },
    });

    if (emailError) throw emailError;

    return { pdfGenerated };
  }

  /**
   * Mark invoice as paid (full payment)
   */
  async markInvoicePaid(
    invoiceId: string, 
    paymentMethod: string, 
    paymentReference?: string
  ): Promise<void> {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      const now = new Date().toISOString();
      
      // Get invoice details first
      const { data: invoice } = await supabase
        .from('invoices')
        .select('dealer_id, gross_amount')
        .eq('id', invoiceId)
        .single();

      if (!invoice) throw new Error('Invoice not found');

      // Update invoice status with full amount paid
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          payment_status: 'paid',
          status: 'paid',
          paid_at: now,
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          amount_paid: invoice.gross_amount,
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // Record payment in history
      await supabase
        .from('dealer_payment_history')
        .insert({
          dealer_id: invoice.dealer_id,
          invoice_id: invoiceId,
          amount: invoice.gross_amount,
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          status: 'completed',
        });

    } catch (error) {
      logger.error('Error marking invoice as paid:', error);
      throw error;
    }
  }

  /**
   * Record a payment (supports partial payments)
   */
  async recordPayment(payment: PaymentRecord): Promise<{ newStatus: string; amountPaid: number }> {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      const { invoiceId, amount, paymentMethod, reference, notes, processedBy } = payment;

      if (amount <= 0) throw new Error('Zahlungsbetrag muss positiv sein');

      // Get current invoice
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('dealer_id, gross_amount, amount_paid')
        .eq('id', invoiceId)
        .single();

      if (fetchError || !invoice) {
        throw new Error('Invoice not found');
      }

      // Calculate new totals
      const currentPaid = invoice.amount_paid || 0;
      const newAmountPaid = currentPaid + amount;
      const remaining = invoice.gross_amount - newAmountPaid;

      // Determine new status
      let newStatus: 'partial' | 'paid' = 'partial';
      let paidAt: string | null = null;

      if (remaining <= 0.01) {
        newStatus = 'paid';
        paidAt = new Date().toISOString();
      }

      // Insert payment record into history
      const { error: historyError } = await supabase
        .from('dealer_payment_history')
        .insert({
          dealer_id: invoice.dealer_id,
          invoice_id: invoiceId,
          amount: amount,
          payment_method: paymentMethod,
          payment_reference: reference || null,
          notes: notes || null,
          processed_by: processedBy || null,
          status: 'completed',
        });

      if (historyError) throw historyError;

      // Update invoice
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          payment_status: newStatus,
          ...(newStatus === 'paid' ? { status: 'paid' } : {}),
          payment_method: paymentMethod,
          payment_reference: reference || null,
          updated_at: new Date().toISOString(),
          ...(paidAt ? { paid_at: paidAt } : {}),
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      logger.info(`Payment recorded for invoice ${invoiceId}: €${amount} (${newStatus})`);

      return { newStatus, amountPaid: newAmountPaid };
    } catch (error) {
      logger.error('Error recording payment:', error);
      throw error;
    }
  }

  /**
   * Get payment history for an invoice
   */
  async getInvoicePaymentHistory(invoiceId: string): Promise<any[]> {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];
      const { data, error } = await supabase
        .from('dealer_payment_history')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching payment history:', error);
      return [];
    }
  }

  /**
   * Get dealer invoices
   */
  async getDealerInvoices(dealerId: string): Promise<InvoiceData[]> {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return [];
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('dealer_id', dealerId)
      .order('invoice_date', { ascending: false });

    if (error) {
      logger.error('Error fetching dealer invoices:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get overdue invoices (includes pending and partial)
   */
  async getOverdueInvoices(): Promise<InvoiceData[]> {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return [];
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email)
      `)
      .lt('due_date', new Date().toISOString())
      .in('payment_status', ['pending', 'partial'])
      .order('due_date');

    if (error) {
      logger.error('Error fetching overdue invoices:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Calculate invoice statistics (includes partial payment tracking)
   */
  async getInvoiceStatistics(): Promise<{
    totalInvoices: number;
    paidInvoices: number;
    partialInvoices: number;
    overdueInvoices: number;
    totalRevenue: number;
    outstandingAmount: number;
  }> {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return {
        totalInvoices: 0,
        paidInvoices: 0,
        partialInvoices: 0,
        overdueInvoices: 0,
        totalRevenue: 0,
        outstandingAmount: 0,
      };
      const { data: allInvoices, error } = await supabase
        .from('invoices')
        .select('payment_status, gross_amount, amount_paid, due_date');

      if (error) throw error;

      const now = new Date();
      const stats = {
        totalInvoices: allInvoices?.length || 0,
        paidInvoices: allInvoices?.filter(inv => inv.payment_status === 'paid').length || 0,
        partialInvoices: allInvoices?.filter(inv => inv.payment_status === 'partial').length || 0,
        overdueInvoices: allInvoices?.filter(inv => 
          (inv.payment_status === 'pending' || inv.payment_status === 'partial') && 
          new Date(inv.due_date) < now
        ).length || 0,
        // Total revenue = sum of amount_paid for all invoices (including partial)
        totalRevenue: allInvoices?.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) || 0,
        // Outstanding = sum of (gross_amount - amount_paid) for non-paid invoices
        outstandingAmount: allInvoices?.filter(inv => inv.payment_status !== 'paid')
          .reduce((sum, inv) => sum + (inv.gross_amount - (inv.amount_paid || 0)), 0) || 0,
      };

      return stats;
    } catch (error) {
      logger.error('Error calculating invoice statistics:', error);
      return {
        totalInvoices: 0,
        paidInvoices: 0,
        partialInvoices: 0,
        overdueInvoices: 0,
        totalRevenue: 0,
        outstandingAmount: 0,
      };
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return amount.toLocaleString('de-DE', {
      style: 'currency',
      currency: 'EUR',
    });
  }

  /**
   * Format date for display
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-DE');
  }
}

// Export singleton instance
export const invoiceGenerator = new InvoiceGeneratorService();

// Export convenience functions
export const createAuctionInvoice = (auctionId: string, dealerId: string) =>
  invoiceGenerator.createAuctionInvoice(auctionId, dealerId);

export const generateInvoicePDF = (invoiceId: string) =>
  invoiceGenerator.generateInvoicePDF(invoiceId);

export const sendInvoiceEmail = (invoiceId: string) =>
  invoiceGenerator.sendInvoiceEmail(invoiceId);

export const sendInvoiceWithPdf = (invoiceId: string) =>
  invoiceGenerator.sendInvoiceWithPdf(invoiceId);

export const markInvoicePaid = (invoiceId: string, paymentMethod: string, paymentReference?: string) =>
  invoiceGenerator.markInvoicePaid(invoiceId, paymentMethod, paymentReference);

export const recordPayment = (payment: PaymentRecord) =>
  invoiceGenerator.recordPayment(payment);

export const getInvoicePaymentHistory = (invoiceId: string) =>
  invoiceGenerator.getInvoicePaymentHistory(invoiceId);

export const getDealerInvoices = (dealerId: string) =>
  invoiceGenerator.getDealerInvoices(dealerId);

export const getOverdueInvoices = () =>
  invoiceGenerator.getOverdueInvoices();

export const getInvoiceStatistics = () =>
  invoiceGenerator.getInvoiceStatistics();
