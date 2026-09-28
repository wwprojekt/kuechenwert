/**
 * Manueller Rechnungsversand aus dem Admin-Backend.
 * PDF-Erzeugung und Versand laufen in den Edge Functions
 * `generate-invoice-pdf` und `send-invoice-email`.
 */

import { invokeWithAuth } from '@/lib/sessionGuard';
import { logger } from './logger';

/**
 * Generate fresh PDF + send invoice email in one go.
 *
 * Used by the manual "Send/Resend" button in AdminFinancials.
 *
 * Scheitert die PDF-Erzeugung, verschickt send-invoice-email das bereits
 * gespeicherte PDF; ohne PDF lehnt die Function den Versand ab (409).
 * Ausgestellte Rechnungen erzeugen immer dasselbe PDF (write-once).
 */
export async function sendInvoiceWithPdf(invoiceId: string): Promise<{ pdfGenerated: boolean }> {
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
