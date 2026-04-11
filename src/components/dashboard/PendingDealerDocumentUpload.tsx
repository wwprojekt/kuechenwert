/**
 * PendingDealerDocumentUpload
 *
 * Shown in the dealer dashboard when the dealer application is still pending
 * or has been rejected. Allows the dealer to upload:
 *   1. Gewerbenachweis / Trade licence (country-specific label)
 *   2. Ausweis Vorderseite (ID front)
 *   3. Ausweis Rückseite (ID back)
 *
 * Uploads go through the Edge Function `dealer-document-upload` which stores
 * files in the `dealer-documents` storage bucket and creates entries in the
 * `legal_documents` table for admin tracking and verification.
 *
 * The component also queries existing legal_documents for the application
 * so the dealer can see what has already been uploaded and its verification status.
 *
 * Fully localised based on the dealer's country code.
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { optimizeImage } from "@/lib/imageOptimization";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Trash2,
  Shield,
  CreditCard,
  Loader2,
  RefreshCw,
  FileWarning,
} from "lucide-react";
import {
  getPendingDealerTranslations,
  type PendingDealerTranslations,
} from "@/lib/pendingDealerTranslations";
import { getLanguageForCountry } from "@/lib/dealerRegistrationTranslations";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocumentSlot {
  /** Key used as `file_type` / `document_type` in DB */
  type: string;
  /** Human-readable label (resolved from translations) */
  label: string;
  /** Short description shown below the label */
  description: string;
  /** Icon component */
  icon: React.ElementType;
  /** Whether this document is required */
  required: boolean;
}

interface LegalDocument {
  id: string;
  document_type: string;
  document_name: string | null;
  file_url: string | null;
  document_url: string | null;
  original_filename: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string | null;
  verified: boolean | null;
  verified_at: string | null;
  notes: string | null;
}

interface PendingDealerDocumentUploadProps {
  dealerApplicationId: string;
  /** ISO country code for localisation (e.g. "DE", "FR", "NL") */
  countryCode?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Build document slots with translated labels */
function buildDocumentSlots(tr: PendingDealerTranslations): DocumentSlot[] {
  return [
    {
      type: "gewerbenachweis",
      label: tr.docTradeLicenseLabel,
      description: tr.docTradeLicenseDesc,
      icon: FileText,
      required: true,
    },
    {
      type: "ausweis_front",
      label: tr.docIdFrontLabel,
      description: tr.docIdFrontDesc,
      icon: CreditCard,
      required: true,
    },
    {
      type: "ausweis_back",
      label: tr.docIdBackLabel,
      description: tr.docIdBackDesc,
      icon: CreditCard,
      required: true,
    },
  ];
}

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/heic",
  "image/heif",
];

/** Extensions that are valid even when MIME type is empty or octet-stream (iOS HEIC issue) */
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif'];

const MAX_FILE_SIZE_IMAGE = 50 * 1024 * 1024; // 50 MB (will be auto-compressed)
const MAX_FILE_SIZE_PDF = 25 * 1024 * 1024; // 25 MB

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PendingDealerDocumentUpload({
  dealerApplicationId,
  countryCode = "DE",
}: PendingDealerDocumentUploadProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tr = getPendingDealerTranslations(countryCode);
  const documentSlots = buildDocumentSlots(tr);

  // Resolve locale string for date formatting
  const lang = getLanguageForCountry(countryCode);
  const localeMap: Record<string, string> = {
    de: "de-DE",
    en: "en-GB",
    nl: "nl-NL",
    fr: "fr-FR",
    it: "it-IT",
    es: "es-ES",
    pt: "pt-PT",
    pl: "pl-PL",
  };
  const dateLocale = localeMap[lang] ?? "en-GB";

  // Upload state per slot
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ---- Fetch existing legal documents for this application ----
  const {
    data: documents = [],
    isLoading: docsLoading,
    refetch: refetchDocs,
  } = useQuery({
    queryKey: ["pendingDealerDocs", dealerApplicationId],
    queryFn: async (): Promise<LegalDocument[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from("legal_documents")
        .select(
          "id, document_type, document_name, file_url, document_url, original_filename, file_size, mime_type, uploaded_at, verified, verified_at, notes"
        )
        .eq("dealer_application_id", dealerApplicationId)
        .order("uploaded_at", { ascending: false });

      if (error) {
        logger.error("Error fetching legal documents:", error);
        throw error;
      }
      return (data || []) as LegalDocument[];
    },
    enabled: !!dealerApplicationId,
    staleTime: 30_000,
  });

  // ---- Helpers ----

  /** Get the latest document for a given slot type */
  const getDocForSlot = useCallback(
    (slotType: string): LegalDocument | undefined =>
      documents.find((d) => d.document_type === slotType),
    [documents]
  );

  /** Count how many required slots have been uploaded */
  const requiredSlots = documentSlots.filter((s) => s.required);
  const uploadedRequired = requiredSlots.filter((s) => getDocForSlot(s.type));
  const completionPct =
    requiredSlots.length > 0
      ? Math.round((uploadedRequired.length / requiredSlots.length) * 100)
      : 0;

  // ---- Upload handler ----

  const handleUpload = async (slotType: string, file: File) => {
    if (!user) return;

    // Validate MIME (with fallback to extension for HEIC/HEIF on iOS)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);
    const isExtValid = ALLOWED_EXTENSIONS.includes(fileExt);
    if (!isMimeValid && !(isExtValid && (file.type === '' || file.type === 'application/octet-stream'))) {
      toast.error(tr.docInvalidType);
      return;
    }

    const isImage = file.type.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "heif"].includes(fileExt);
    const maxSize = isImage ? MAX_FILE_SIZE_IMAGE : MAX_FILE_SIZE_PDF;
    if (file.size > maxSize) {
      toast.error(tr.docFileTooLarge);
      return;
    }

    // Auto-compress images > 1MB for fast uploads
    let fileToUpload = file;
    if (isImage && file.size > 1 * 1024 * 1024) {
      try {
        const result = await optimizeImage(file, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 0.85,
          format: "jpeg",
        });
        logger.info(`Document auto-compressed: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(result.file.size / 1024 / 1024).toFixed(1)}MB`);
        fileToUpload = result.file;
      } catch (err) {
        logger.warn("Image compression failed, using original:", err);
      }
    }

    setUploadingSlot(slotType);
    setUploadProgress(10);

    try {
      // Build FormData for the edge function
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("user_id", user.id);
      formData.append("file_type", slotType);
      formData.append("dealer_application_id", dealerApplicationId);

      setUploadProgress(30);

      const { data: result, error: invokeError } = await invokeWithAuth('dealer-document-upload', {
        body: formData,
      });

      setUploadProgress(80);

      if (invokeError) {
        throw new Error(invokeError.message || tr.docUploadFailed);
      }

      if (!(result as any)?.success) {
        throw new Error((result as any)?.error || tr.docUploadFailed);
      }

      setUploadProgress(100);

      const slotLabel =
        documentSlots.find((s) => s.type === slotType)?.label || "Dokument";
      toast.success(`${slotLabel} ${tr.docUploadSuccess}`);

      // Refresh document list
      await refetchDocs();
      queryClient.invalidateQueries({
        queryKey: ["adminDealerDetail"],
      });
    } catch (error: any) {
      if (error instanceof SessionExpiredError) {
        toast.error(tr.docNotLoggedIn);
        return;
      }
      logger.error("Document upload error:", error);
      toast.error(error.message || tr.docUploadFailed);
    } finally {
      setUploadingSlot(null);
      setUploadProgress(0);
      // Reset file input
      const input = fileInputRefs.current[slotType];
      if (input) input.value = "";
    }
  };

  // ---- Delete handler ----

  const handleDelete = async (doc: LegalDocument) => {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      const { error } = await supabase
        .from("legal_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast.success(tr.docDeleted);
      await refetchDocs();
    } catch (error: any) {
      logger.error("Error deleting document:", error);
      toast.error(tr.docDeleteFailed);
    }
  };

  // ---- Render ----

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{tr.docTitle}</CardTitle>
              <CardDescription>{tr.docDescription}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchDocs()}
            title={tr.docTitle}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {tr.docRequiredDocuments}
            </span>
            <span className="font-medium">
              {uploadedRequired.length} {tr.docOf} {requiredSlots.length}
            </span>
          </div>
          <Progress value={completionPct} className="h-2" />
          {completionPct === 100 && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {tr.docAllUploaded}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {docsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          documentSlots.map((slot) => {
            const doc = getDocForSlot(slot.type);
            const isUploading = uploadingSlot === slot.type;
            const SlotIcon = slot.icon;

            return (
              <div
                key={slot.type}
                className={`rounded-xl border p-4 transition-colors ${
                  doc
                    ? doc.verified
                      ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                      : "border-blue-200 bg-card dark:border-blue-800 dark:bg-slate-900/50"
                    : "border-dashed border-muted-foreground/30 bg-muted/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      doc
                        ? doc.verified
                          ? "bg-green-100 dark:bg-green-900/50"
                          : "bg-blue-100 dark:bg-blue-900/50"
                        : "bg-muted"
                    }`}
                  >
                    {doc ? (
                      doc.verified ? (
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )
                    ) : (
                      <SlotIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{slot.label}</h4>
                      {slot.required && !doc && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {tr.docRequired}
                        </Badge>
                      )}
                      {doc && !doc.verified && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          <Clock className="w-2.5 h-2.5 mr-1" />
                          {tr.docUnderReview}
                        </Badge>
                      )}
                      {doc?.verified && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0">
                          <CheckCircle className="w-2.5 h-2.5 mr-1" />
                          {tr.docVerified}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      {slot.description}
                    </p>

                    {/* Uploaded file info */}
                    {doc && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {doc.original_filename && (
                          <p className="truncate">
                            <span className="font-medium">{tr.docFile}</span>{" "}
                            {doc.original_filename}
                          </p>
                        )}
                        {doc.uploaded_at && (
                          <p>
                            <span className="font-medium">
                              {tr.docUploadedAt}
                            </span>{" "}
                            {new Date(doc.uploaded_at).toLocaleDateString(
                              dateLocale,
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        )}
                        {doc.verified_at && (
                          <p className="text-green-600 dark:text-green-400">
                            <span className="font-medium">
                              {tr.docVerifiedAt}
                            </span>{" "}
                            {new Date(doc.verified_at).toLocaleDateString(
                              dateLocale,
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              }
                            )}
                          </p>
                        )}
                        {doc.notes && (
                          <p className="mt-1 p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <FileWarning className="w-3 h-3 inline mr-1" />
                            <span className="font-medium">
                              {tr.docAdminNote}
                            </span>{" "}
                            {doc.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Upload progress */}
                    {isUploading && (
                      <div className="mt-2 space-y-1">
                        <Progress value={uploadProgress} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground text-center">
                          {uploadProgress < 100
                            ? tr.docUploading
                            : tr.docProcessing}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {doc && (doc.file_url || doc.document_url) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          window.open(
                            doc.file_url || doc.document_url || "",
                            "_blank"
                          )
                        }
                        title={tr.docFile}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Delete button – only if not yet verified */}
                    {doc && !doc.verified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc)}
                        title={tr.docDeleted}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Upload / Re-upload button */}
                    {!doc?.verified && (
                      <>
                        <input
                          ref={(el) => {
                            fileInputRefs.current[slot.type] = el;
                          }}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(slot.type, file);
                          }}
                        />
                        <Button
                          variant={doc ? "outline" : "default"}
                          size="sm"
                          disabled={isUploading}
                          onClick={() =>
                            fileInputRefs.current[slot.type]?.click()
                          }
                          className="h-8"
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 mr-1" />
                          )}
                          {doc ? tr.docReplace : tr.docUpload}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Info box */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{tr.docInfoBox}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
