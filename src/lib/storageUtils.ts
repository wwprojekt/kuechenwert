/**
 * Storage Utilities
 * 
 * Helper functions for working with Supabase Storage, especially
 * for private buckets that require signed URLs instead of public URLs.
 * 
 * Private buckets: dealer-documents, invoices, purchase-contracts
 * Public buckets: kitchen-photos, branding
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Extract the storage path from a Supabase public URL.
 * 
 * Public URLs have the format:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * 
 * We need to extract `<path>` to use with createSignedUrl().
 */
export function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null;

  try {
    // Pattern 1: Standard Supabase public URL
    const publicPattern = `/storage/v1/object/public/${bucket}/`;
    const publicIdx = url.indexOf(publicPattern);
    if (publicIdx !== -1) {
      return decodeURIComponent(url.substring(publicIdx + publicPattern.length));
    }

    // Pattern 2: Signed URL format
    const signedPattern = `/storage/v1/object/sign/${bucket}/`;
    const signedIdx = url.indexOf(signedPattern);
    if (signedIdx !== -1) {
      const pathWithQuery = url.substring(signedIdx + signedPattern.length);
      return decodeURIComponent(pathWithQuery.split("?")[0]);
    }

    // Pattern 3: Just the path (no full URL)
    if (!url.startsWith("http")) {
      return url;
    }

    logger.warn("Could not extract storage path from URL", { url, bucket });
    return null;
  } catch (err) {
    logger.error("Error extracting storage path:", err);
    return null;
  }
}

/**
 * Get a signed URL for a file in a private bucket.
 * 
 * @param url - The stored URL (typically a non-functional public URL)
 * @param bucket - The storage bucket name
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns The signed URL, or the original URL if signing fails
 */
export async function getSignedUrl(
  url: string,
  bucket: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!url) return url;

  const path = extractStoragePath(url, bucket);
  if (!path) {
    logger.warn("Could not extract path for signed URL, returning original", { url });
    return url;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      logger.error("Error creating signed URL:", { error: error.message, path, bucket });
      return url; // Fallback to original URL
    }

    return data.signedUrl;
  } catch (err) {
    logger.error("Unexpected error creating signed URL:", err);
    return url;
  }
}

/**
 * Get a signed URL specifically for dealer documents.
 */
export async function getDealerDocumentSignedUrl(url: string): Promise<string> {
  return getSignedUrl(url, "dealer-documents");
}

/**
 * Get a signed URL specifically for invoices.
 */
export async function getInvoiceSignedUrl(url: string): Promise<string> {
  return getSignedUrl(url, "invoices");
}

/**
 * Get a signed URL specifically for purchase contracts.
 */
export async function getContractSignedUrl(url: string): Promise<string> {
  return getSignedUrl(url, "purchase-contracts");
}

/**
 * Open a document from a private bucket in a new tab.
 * Generates a signed URL on-the-fly and opens it.
 */
export async function openPrivateDocument(
  url: string,
  bucket: string,
  toast?: (msg: { title: string; description: string; variant?: string }) => void
): Promise<void> {
  try {
    const signedUrl = await getSignedUrl(url, bucket);
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  } catch (err) {
    logger.error("Error opening private document:", err);
    if (toast) {
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht geöffnet werden",
        variant: "destructive",
      });
    }
  }
}

/**
 * Download a file from a private bucket.
 * Uses Supabase's download() method which handles auth automatically.
 */
export async function downloadPrivateDocument(
  url: string,
  bucket: string,
  filename?: string
): Promise<void> {
  const path = extractStoragePath(url, bucket);
  if (!path) {
    // Fallback: try opening the URL directly
    window.open(url, "_blank");
    return;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;

    // Create a download link
    const blobUrl = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || path.split("/").pop() || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    logger.error("Error downloading private document:", err);
    // Fallback: try opening the URL directly
    window.open(url, "_blank");
  }
}
