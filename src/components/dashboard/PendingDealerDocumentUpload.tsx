/**
 * PendingDealerDocumentUpload
 *
 * Shown in the dealer dashboard when the dealer application is still pending
 * or has been rejected. Allows the dealer to upload:
 *   1. Gewerbenachweis (trade/business license)
 *   2. Ausweis Vorderseite (ID front)
 *   3. Ausweis Rückseite (ID back)
 *
 * Uploads go through the Edge Function `dealer-document-upload` which stores
 * files in the `dealer-documents` storage bucket and creates entries in the
 * `legal_documents` table for admin tracking and verification.
 *
 * The component also queries existing legal_documents for the application
 * so the dealer can see what has already been uploaded and its verification status.
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocumentSlot {
  /** Key used as `file_type` / `document_type` in DB */
  type: string;
  /** Human-readable label */
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
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DOCUMENT_SLOTS: DocumentSlot[] = [
  {
    type: "gewerbenachweis",
    label: "Gewerbenachweis",
    description:
      "Gewerbeanmeldung, Gewerbeummeldung oder aktueller Gewerbeschein",
    icon: FileText,
    required: true,
  },
  {
    type: "ausweis_front",
    label: "Ausweis – Vorderseite",
    description:
      "Personalausweis oder Reisepass (Vorderseite) des Geschäftsführers",
    icon: CreditCard,
    required: true,
  },
  {
    type: "ausweis_back",
    label: "Ausweis – Rückseite",
    description:
      "Personalausweis oder Reisepass (Rückseite) des Geschäftsführers",
    icon: CreditCard,
    required: true,
  },
];

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
// SUPABASE_ANON_KEY no longer needed – we use the user's JWT token instead
const _UNUSED_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PendingDealerDocumentUpload({
  dealerApplicationId,
}: PendingDealerDocumentUploadProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
  const requiredSlots = DOCUMENT_SLOTS.filter((s) => s.required);
  const uploadedRequired = requiredSlots.filter((s) => getDocForSlot(s.type));
  const completionPct =
    requiredSlots.length > 0
      ? Math.round((uploadedRequired.length / requiredSlots.length) * 100)
      : 0;

  // ---- Upload handler ----

  const handleUpload = async (slotType: string, file: File) => {
    if (!user) return;

    // Validate MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error("Ungültiger Dateityp. Erlaubt: PDF, JPG, PNG");
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Datei zu groß. Maximal 10 MB erlaubt.");
      return;
    }

    setUploadingSlot(slotType);
    setUploadProgress(10);

    try {
      // Build FormData for the edge function
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", user.id);
      formData.append("file_type", slotType);
      formData.append("dealer_application_id", dealerApplicationId);

      setUploadProgress(30);

      // Get the user's JWT token for authenticated upload
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Nicht angemeldet. Bitte laden Sie die Seite neu.");
      }

      // Call the edge function with user JWT
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/dealer-document-upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      setUploadProgress(80);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload fehlgeschlagen");
      }

      setUploadProgress(100);

      toast.success(
        `${DOCUMENT_SLOTS.find((s) => s.type === slotType)?.label || "Dokument"} erfolgreich hochgeladen`
      );

      // Refresh document list
      await refetchDocs();
      queryClient.invalidateQueries({
        queryKey: ["adminDealerDetail"],
      });
    } catch (error: any) {
      logger.error("Document upload error:", error);
      toast.error(error.message || "Upload fehlgeschlagen");
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
      const { error } = await supabase
        .from("legal_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast.success("Dokument gelöscht");
      await refetchDocs();
    } catch (error: any) {
      logger.error("Error deleting document:", error);
      toast.error("Dokument konnte nicht gelöscht werden");
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
              <CardTitle className="text-lg">
                Dokumente für Verifizierung
              </CardTitle>
              <CardDescription>
                Bitte laden Sie die folgenden Dokumente hoch, damit wir Ihren
                Händlerantrag prüfen können.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchDocs()}
            title="Status aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Erforderliche Dokumente
            </span>
            <span className="font-medium">
              {uploadedRequired.length} von {requiredSlots.length}
            </span>
          </div>
          <Progress value={completionPct} className="h-2" />
          {completionPct === 100 && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Alle erforderlichen Dokumente hochgeladen – wir prüfen Ihren
              Antrag.
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
          DOCUMENT_SLOTS.map((slot) => {
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
                      : "border-blue-200 bg-white dark:border-blue-800 dark:bg-slate-900/50"
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
                          Erforderlich
                        </Badge>
                      )}
                      {doc && !doc.verified && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          <Clock className="w-2.5 h-2.5 mr-1" />
                          Wird geprüft
                        </Badge>
                      )}
                      {doc?.verified && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0">
                          <CheckCircle className="w-2.5 h-2.5 mr-1" />
                          Verifiziert
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
                            <span className="font-medium">Datei:</span>{" "}
                            {doc.original_filename}
                          </p>
                        )}
                        {doc.uploaded_at && (
                          <p>
                            <span className="font-medium">Hochgeladen:</span>{" "}
                            {new Date(doc.uploaded_at).toLocaleDateString(
                              "de-DE",
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
                            <span className="font-medium">Geprüft am:</span>{" "}
                            {new Date(doc.verified_at).toLocaleDateString(
                              "de-DE",
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
                            <span className="font-medium">Admin-Hinweis:</span>{" "}
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
                            ? "Wird hochgeladen..."
                            : "Verarbeitung..."}
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
                        title="Dokument ansehen"
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
                        title="Dokument löschen"
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
                          accept=".pdf,.jpg,.jpeg,.png"
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
                          {doc ? "Ersetzen" : "Hochladen"}
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
            <span>
              Erlaubte Dateiformate: <strong>PDF, JPG, PNG</strong> (max. 10 MB).
              Ihre Dokumente werden vertraulich behandelt und nur zur
              Verifizierung Ihres Händlerkontos verwendet. Nach der Prüfung
              erhalten Sie eine E-Mail-Benachrichtigung.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
