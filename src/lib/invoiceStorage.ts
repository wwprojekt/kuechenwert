/**
 * Invoice storage helpers
 *
 * The Edge Function `generate-invoice-pdf` sanitises the invoice number
 * before using it as a storage object key (Supabase Storage rejects keys
 * with several characters). The frontend MUST use the same sanitisation
 * when constructing fallback paths to look up an existing PDF, otherwise
 * a path mismatch results in a 404 even though the file exists.
 *
 * Source of truth lives here. If the sanitisation rule changes, update
 * BOTH this helper AND `supabase/functions/generate-invoice-pdf/index.ts`
 * (search for `replace(/[^a-zA-Z0-9-]/g`).
 */

/**
 * Returns the canonical storage path inside the `invoices` bucket for a
 * given invoice. Mirrors the path constructed in `generate-invoice-pdf`:
 *   `${dealerId}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g,'_')}.pdf`
 */
export function getInvoiceStoragePath(
  dealerId: string,
  invoiceNumber: string
): string {
  const safeNumber = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  return `${dealerId}/${safeNumber}.pdf`;
}
