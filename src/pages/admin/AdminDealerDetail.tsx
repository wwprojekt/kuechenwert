/**
 * Admin Dealer Detail Page
 * Comprehensive view of dealer application, business info, documents, and activity
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { approveDealerApplication, rejectDealerApplication, deleteDealerApplication } from "@/lib/dealerApplications";
import { adminSuspendUser } from "@/lib/adminSuspendUser";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  FileText,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  AlertTriangle,
  Trash2,
  Euro,
  Gavel,
  Ban,
  ExternalLink,
  CreditCard,
  Users,
  Award,
  Shield,
  Upload as UploadIcon,
  Eye,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminDetailLayout,
  DetailSection,
  InfoGrid,
  InfoItem,
  StatsCard,
} from "@/components/admin/AdminDetailLayout";
import { DealerEditDialog } from "@/components/admin/DealerEditDialog";
import { CountryFlag } from "@/components/CountryFlag";
import { logger } from "@/lib/logger";
import { openPrivateDocument, downloadPrivateDocument } from "@/lib/storageUtils";

export default function AdminDealerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logEvent } = useAuditLog();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [docNoteDialogId, setDocNoteDialogId] = useState<string | null>(null);
  const [docNote, setDocNote] = useState("");

  // Fetch dealer application with all related data
  // NOTE: Cannot use Supabase JOIN syntax profile:user_id(...) because
  // there is no foreign key between dealer_applications.user_id and profiles.id.
  // Fetch all related data separately and join in code.
  const { data: dealer, isLoading, error } = useQuery({
    queryKey: ["adminDealerDetail", id],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      // 1. Fetch the dealer application
      const { data, error } = await supabase
        .from("dealer_applications")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // 2. Fetch profile separately
      let profile = null;
      if (data.user_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, phone, is_suspended, created_at")
          .eq("id", data.user_id)
          .single();
        profile = profileData;
      }

      // 3. Fetch legal documents (extended with verification fields)
      const { data: legalDocs } = await supabase
        .from("legal_documents")
        .select("id, document_type, document_name, file_url, document_url, original_filename, file_size, mime_type, uploaded_at, verified, verified_at, verified_by, notes")
        .eq("dealer_application_id", data.id)
        .order("uploaded_at", { ascending: false });

      // 3b. Fallback: If no legal_documents exist, create virtual entries from
      // dealer_applications document URLs (gewerbenachweis_url, trade_license_document_url)
      let effectiveLegalDocs = legalDocs || [];
      if (effectiveLegalDocs.length === 0) {
        const fallbackDocs: any[] = [];
        if (data.gewerbenachweis_url) {
          fallbackDocs.push({
            id: `fallback-gewerbenachweis-${data.id}`,
            document_type: "gewerbenachweis",
            document_name: "Gewerbenachweis",
            file_url: data.gewerbenachweis_url,
            document_url: data.gewerbenachweis_url,
            original_filename: data.gewerbenachweis_url.split("/").pop() || "Gewerbenachweis",
            file_size: null,
            mime_type: null,
            uploaded_at: data.created_at,
            verified: false,
            verified_at: null,
            verified_by: null,
            notes: "Aus Händler-Registrierung importiert",
          });
        }
        if (data.trade_license_document_url) {
          // Detect if this is an ID document (ausweis) based on filename
          const filename = (data.trade_license_document_url.split("/").pop() || "").toLowerCase();
          const isAusweis = filename.includes("ausweis");
          const docType = isAusweis
            ? (filename.includes("back") ? "ausweis_back" : filename.includes("front") ? "ausweis_front" : "ausweis_back")
            : "trade_license";
          const docName = isAusweis
            ? (docType === "ausweis_back" ? "Ausweis – Rückseite" : "Ausweis – Vorderseite")
            : "Gewerbeschein";
          fallbackDocs.push({
            id: `fallback-trade-license-${data.id}`,
            document_type: docType,
            document_name: docName,
            file_url: data.trade_license_document_url,
            document_url: data.trade_license_document_url,
            original_filename: data.trade_license_document_url.split("/").pop() || "Dokument",
            file_size: null,
            mime_type: null,
            uploaded_at: data.created_at,
            verified: false,
            verified_at: null,
            verified_by: null,
            notes: "Aus Händler-Registrierung importiert",
          });
        }
        if (data.hrb_document_url) {
          fallbackDocs.push({
            id: `fallback-hrb-${data.id}`,
            document_type: "hrb_register",
            document_name: "Handelsregisterauszug",
            file_url: data.hrb_document_url,
            document_url: data.hrb_document_url,
            original_filename: data.hrb_document_url.split("/").pop() || "HRB-Dokument",
            file_size: null,
            mime_type: null,
            uploaded_at: data.created_at,
            verified: false,
            verified_at: null,
            verified_by: null,
            notes: "Aus Händler-Registrierung importiert",
          });
        }
        effectiveLegalDocs = fallbackDocs;
      }

      // 4. Fetch SEPA mandates
      const { data: sepaMandates } = await supabase
        .from("sepa_mandates")
        .select("id, status, mandate_reference, created_at")
        .eq("dealer_application_id", data.id);

      // 5. Fetch dealer's bids if approved
      let bids: any[] = [];
      let wonAuctions: any[] = [];
      
      if (data.status === "approved" && data.user_id) {
        const { data: bidsData } = await supabase
          .from("bids")
          .select(`
            id,
            amount,
            created_at,
            auction:auctions(
              id,
              status,
              current_bid,
              kitchen:kitchens(manufacturer, model, year)
            )
          `)
          .eq("bidder_id", data.user_id)
          .order("created_at", { ascending: false })
          .limit(10);
        
        bids = bidsData || [];

        // Get won auctions
        const { data: wonData } = await supabase
          .from("auctions")
          .select(`
            id,
            status,
            current_bid,
            end_time,
            kitchen:kitchens(id, manufacturer, model, year, sold_to)
          `)
          .eq("kitchen.sold_to", data.user_id)
          .order("end_time", { ascending: false })
          .limit(5);

        wonAuctions = wonData || [];
      }

      // 6. Fetch invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("dealer_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(5);

      // 7. Check email confirmation status via auth
      let emailConfirmed = true;
      if (data.user_id) {
        try {
          const { data: authCheck } = await invokeWithAuth('get-dealer-auth-status', {
            body: { userId: data.user_id },
          });
          if (authCheck && typeof authCheck.emailConfirmed === 'boolean') {
            emailConfirmed = authCheck.emailConfirmed;
          }
        } catch { /* ignore – assume confirmed */ }
      }

      return {
        ...data,
        profile,
        legal_documents: effectiveLegalDocs,
        sepa_mandates: sepaMandates || [],
        bids,
        wonAuctions,
        invoices: invoices || [],
        emailConfirmed,
      };
    },
    enabled: !!id,
  });

  // Approve dealer mutation – uses RPC-based function for transactional safety
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Application ID is required');
      await approveDealerApplication(id);
    },
    onSuccess: () => {
      toast.success("Händler erfolgreich genehmigt");
      logEvent({ action: "dealer_approved", entityType: "dealer", entityId: id, details: { company: dealer?.company_name } });
      queryClient.invalidateQueries({ queryKey: ["adminDealerDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
    },
    onError: (error) => {
      logger.error("Approve dealer error:", error);
      toast.error("Fehler beim Genehmigen des Händlers");
    },
  });

  // Reject dealer mutation – uses shared function with notification
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Application ID is required');
      await rejectDealerApplication(id, rejectReason);
    },
    onSuccess: () => {
      toast.success("Händlerantrag abgelehnt");
      logEvent({ action: "dealer_rejected", entityType: "dealer", entityId: id, details: { reason: rejectReason } });
      setShowRejectDialog(false);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["adminDealerDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
    },
    onError: (error) => {
      logger.error("Reject dealer error:", error);
      toast.error("Fehler beim Ablehnen des Händlerantrags");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Application ID is required');
      return await deleteDealerApplication(id);
    },
    onSuccess: (result) => {
      if (result.mailSent) {
        toast.success("Händlerantrag gelöscht. Bewerber wurde per E-Mail informiert.");
      } else if (result.mailError) {
        toast.warning(`Antrag gelöscht – E-Mail-Versand fehlgeschlagen: ${result.mailError}`);
      } else {
        toast.success("Händlerantrag gelöscht (keine E-Mail-Adresse hinterlegt).");
      }
      logEvent({ action: "delete", entityType: "dealer", entityId: id });
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      navigate("/admin/dealers");
    },
    onError: (error) => {
      logger.error("Delete dealer error:", error);
      toast.error("Fehler beim Löschen des Antrags");
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (suspend: boolean) => {
      if (!dealer?.user_id) throw new Error("Händler nicht geladen");
      return await adminSuspendUser(dealer.user_id, suspend);
    },
    onSuccess: (result, suspend) => {
      const baseMsg = suspend ? "Händler gesperrt" : "Händler entsperrt";
      if (result.mailSent) {
        toast.success(`${baseMsg} – Händler wurde per E-Mail informiert.`);
      } else if (result.mailError) {
        toast.warning(`${baseMsg} – E-Mail-Versand fehlgeschlagen: ${result.mailError}`);
      } else {
        toast.success(baseMsg);
      }
      logEvent({ action: suspend ? "user_suspended" : "user_unsuspended", entityType: "dealer", entityId: id, details: { user_id: dealer?.user_id } });
      queryClient.invalidateQueries({ queryKey: ["adminDealerDetail", id] });
    },
    onError: (error) => {
      logger.error("Suspend dealer error:", error);
      toast.error("Fehler beim Aktualisieren des Händlerstatus");
    },
  });

  // Verify document mutation
  const verifyDocMutation = useMutation({
    mutationFn: async ({ docId, verified }: { docId: string; verified: boolean }) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      const { error } = await supabase
        .from("legal_documents")
        .update({
          verified,
          verified_at: verified ? new Date().toISOString() : null,
          verified_by: verified ? (await supabase.auth.getUser()).data.user?.id : null,
        })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: (_, { verified }) => {
      toast.success(verified ? "Dokument verifiziert" : "Verifizierung aufgehoben");
      setVerifyingDocId(null);
      queryClient.invalidateQueries({ queryKey: ["adminDealerDetail", id] });
    },
    onError: (error) => {
      logger.error("Verify document error:", error);
      toast.error("Fehler beim Aktualisieren des Dokuments");
    },
  });

  // Add note to document mutation
  const addDocNoteMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: string; notes: string }) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      const { error } = await supabase
        .from("legal_documents")
        .update({ notes })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hinweis gespeichert");
      setDocNoteDialogId(null);
      setDocNote("");
      queryClient.invalidateQueries({ queryKey: ["adminDealerDetail", id] });
    },
    onError: (error) => {
      logger.error("Add doc note error:", error);
      toast.error("Fehler beim Speichern des Hinweises");
    },
  });

  /** Human-readable label for document types */
  const getDocTypeLabel = (docType: string): string => {
    const labels: Record<string, string> = {
      gewerbenachweis: "Gewerbenachweis",
      ausweis_front: "Ausweis – Vorderseite",
      ausweis_back: "Ausweis – Rückseite",
      trade_license: "Gewerbeschein",
      hrb_register: "Handelsregisterauszug",
      hrb: "Handelsregisterauszug",
      ust_id_certificate: "USt-ID Bescheinigung",
      other: "Sonstiges Dokument",
    };
    return labels[docType] || docType.replace(/_/g, " ");
  };

  /** Check if a document was uploaded after the initial application */
  const isPostRegistrationUpload = (docUploadedAt: string | null, appCreatedAt: string | null): boolean => {
    if (!docUploadedAt || !appCreatedAt) return false;
    const docDate = new Date(docUploadedAt).getTime();
    const appDate = new Date(appCreatedAt).getTime();
    // If uploaded more than 10 minutes after application creation, it's a post-registration upload
    return docDate - appDate > 10 * 60 * 1000;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Händler nicht gefunden</h2>
          <p className="mt-2 text-muted-foreground">
            Der angeforderte Händler existiert nicht.
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/dealers")}>
            Zurück zur Übersicht
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy HH:mm", { locale: de });
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Ausstehend", variant: "secondary" },
      approved: { label: "Genehmigt", variant: "default" },
      rejected: { label: "Abgelehnt", variant: "destructive" },
    };
    return statusConfig[status] || { label: status, variant: "outline" };
  };

  // Ensure all Supabase relations are always arrays (Supabase may return a single object for 1:N)
  const safeArray = (val: any): any[] => Array.isArray(val) ? val : val ? [val] : [];
  const dealerBids = safeArray(dealer?.bids);
  const dealerLegalDocs = safeArray(dealer?.legal_documents);
  const dealerSepaMandates = safeArray(dealer?.sepa_mandates);
  const dealerInvoices = safeArray(dealer?.invoices);
  const dealerWonAuctions = safeArray(dealer?.wonAuctions);

  const totalBidAmount = dealerBids.reduce((sum: number, bid: any) => sum + bid.amount, 0) || 0;

  return (
    <AdminDetailLayout
      title={dealer?.company_name || "Händler"}
      subtitle={dealer?.company_city ? `${dealer.company_address || ""}, ${dealer.company_postal_code || ""} ${dealer.company_city}` : undefined}
      status={dealer ? getStatusBadge(dealer.status) : undefined}
      backUrl="/admin/dealers"
      backLabel="Alle Händler"
      isLoading={isLoading}
      icon={<Building2 className="w-6 h-6" />}
      actions={
        dealer && (
          <div className="flex gap-2">
            {dealer.status === "approved" && (
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Bearbeiten
              </Button>
            )}
            {dealer.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Genehmigen
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Ablehnen
                </Button>
              </>
            )}
            {dealer.status === "rejected" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteMutation.isPending ? "Löschen..." : "Antrag löschen"}
              </Button>
            )}
            {dealer.status === "approved" && (
              dealer.profile?.is_suspended ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-600 hover:bg-green-50"
                  onClick={() => suspendMutation.mutate(false)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Entsperren
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => suspendMutation.mutate(true)}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Sperren
                </Button>
              )
            )}
          </div>
        )
      }
    >
      {dealer && (
        <div className="space-y-6">
          {/* Email Verification Warning */}
          {dealer.emailConfirmed === false && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  E-Mail nicht bestätigt
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Dieser Händler hat seine E-Mail-Adresse noch nicht bestätigt und kann sich daher nicht einloggen oder bieten.
                  {dealer.status === 'approved' && ' Trotzdem genehmigt – bitte Händler kontaktieren.'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-400 text-amber-700 hover:bg-amber-100"
                onClick={async () => {
                  try {
                    await invokeWithAuth('resend-confirmation-email', {
                      body: { email: dealer.profile?.email },
                    });
                    toast.success("Bestätigungsmail erneut gesendet");
                  } catch {
                    toast.error("Fehler beim Senden");
                  }
                }}
              >
                <Mail className="w-4 h-4 mr-2" />
                Erneut senden
              </Button>
            </div>
          )}

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label="Gebote gesamt"
              value={dealerBids.length}
              icon={<Gavel className="w-5 h-5" />}
            />
            <StatsCard
              label="Gebotsvolumen"
              value={formatPrice(totalBidAmount)}
              icon={<Euro className="w-5 h-5" />}
            />
            <StatsCard
              label="Gewonnene Auktionen"
              value={dealerWonAuctions.length}
              icon={<Award className="w-5 h-5" />}
            />
            <StatsCard
              label="Rechnungen"
              value={dealerInvoices.length}
              icon={<FileText className="w-5 h-5" />}
            />
          </div>

          {/* Rejection Notice */}
          {dealer.status === "rejected" && dealer.rejection_reason && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Antrag abgelehnt</span>
              </div>
              <p className="text-sm">{dealer.rejection_reason}</p>
              {dealer.reviewed_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Abgelehnt am: {formatDate(dealer.reviewed_at)}
                </p>
              )}
            </div>
          )}

          {/* Suspended Notice */}
          {dealer.profile?.is_suspended && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
              <div className="flex items-center gap-2 text-amber-600">
                <Ban className="w-5 h-5" />
                <span className="font-semibold">Händlerkonto gesperrt</span>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tabs for Details */}
              <Tabs defaultValue="company" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="company">Firma</TabsTrigger>
                  <TabsTrigger value="contact">Kontakt</TabsTrigger>
                  <TabsTrigger value="documents">Dokumente</TabsTrigger>
                  <TabsTrigger value="activity">Aktivität</TabsTrigger>
                </TabsList>

                <TabsContent value="company">
                  <DetailSection title="Firmendaten" icon={<Building2 className="w-5 h-5" />}>
                    <InfoGrid columns={2}>
                      <InfoItem label="Firmenname" value={dealer.company_name} />
                      <InfoItem label="Rechtsform" value={dealer.legal_form} />
                      <InfoItem label="Gründungsjahr" value={dealer.founded_year?.toString()} />
                      <InfoItem label="Mitarbeiter" value={dealer.employee_count?.toString()} icon={<Users className="w-3 h-3" />} />
                      <InfoItem label="Steuernummer" value={dealer.tax_id} />
                      <InfoItem label="Gewerbeschein-Nr." value={dealer.trade_license_number} />
                      <InfoItem label="Handelsregister-Nr." value={dealer.handelsregister_number} />
                    </InfoGrid>

                    <Separator className="my-6" />

                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Adresse
                    </h4>
                    <InfoGrid columns={2}>
                      <InfoItem label="Straße" value={dealer.company_address} />
                      <InfoItem label="PLZ / Stadt" value={`${dealer.company_postal_code || ""} ${dealer.company_city || ""}`} />
                      <InfoItem label="Land" value={
                        <CountryFlag countryCode={dealer.country || "DE"} showName={true} />
                      } />
                    </InfoGrid>

                    {dealer.business_description && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Geschäftsbeschreibung</p>
                        <p className="text-sm whitespace-pre-wrap">{dealer.business_description}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="contact">
                  <DetailSection title="Kontaktdaten" icon={<User className="w-5 h-5" />}>
                    <InfoGrid columns={2}>
                      <InfoItem label="Ansprechpartner" value={dealer.contact_person_name} />
                      <InfoItem label="Position" value={dealer.contact_person_position} />
                      <InfoItem label="E-Mail" value={dealer.profile?.email} icon={<Mail className="w-3 h-3" />} />
                      <InfoItem label="Telefon" value={dealer.phone || dealer.profile?.phone} icon={<Phone className="w-3 h-3" />} />
                      <InfoItem label="Website" value={dealer.website} icon={<Globe className="w-3 h-3" />} />
                    </InfoGrid>

                    {dealer.profile && (
                      <>
                        <Separator className="my-6" />
                        <h4 className="font-semibold mb-4">Verknüpftes Benutzerkonto</h4>
                        <div className="p-4 rounded-lg border">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {dealer.profile.first_name} {dealer.profile.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">{dealer.profile.email}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/users/${dealer.profile.id}`)}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Profil
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Banking Info */}
                    {(dealer.iban || dealer.bic) && (
                      <>
                        <Separator className="my-6" />
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Bankverbindung
                        </h4>
                        <InfoGrid columns={2}>
                          <InfoItem label="IBAN" value={dealer.iban} />
                          <InfoItem label="BIC" value={dealer.bic} />
                        </InfoGrid>
                      </>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="documents">
                  <DetailSection title="Verifizierungsdokumente" icon={<Shield className="w-5 h-5" />}>
                    {/* Required documents checklist */}
                    {dealer.status === "pending" && (
                      <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-amber-800 dark:text-amber-200">
                          <AlertTriangle className="w-4 h-4" />
                          Erforderliche Dokumente für Freischaltung
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {["gewerbenachweis", "ausweis_front", "ausweis_back"].map((reqType) => {
                            const hasDoc = dealerLegalDocs.some((d: any) => d.document_type === reqType);
                            const isVerified = dealerLegalDocs.some((d: any) => d.document_type === reqType && d.verified);
                            return (
                              <div key={reqType} className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                                isVerified
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                  : hasDoc
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                              }`}>
                                {isVerified ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : hasDoc ? (
                                  <Clock className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="font-medium">{getDocTypeLabel(reqType)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Document list */}
                    {dealerLegalDocs.length > 0 ? (
                      <div className="space-y-3">
                        {dealerLegalDocs.map((doc: any) => {
                          const isPostReg = isPostRegistrationUpload(doc.uploaded_at, dealer.created_at);
                          return (
                            <div
                              key={doc.id}
                              className={`p-4 rounded-lg border transition-colors ${
                                doc.verified
                                  ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                                  : "border-border"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    doc.verified
                                      ? "bg-green-100 dark:bg-green-900/50"
                                      : "bg-muted"
                                  }`}>
                                    {doc.verified ? (
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                      <FileText className="w-5 h-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-semibold text-sm">
                                        {getDocTypeLabel(doc.document_type)}
                                      </p>
                                      {doc.verified && (
                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">
                                          <CheckCircle className="w-2.5 h-2.5 mr-1" />
                                          Verifiziert
                                        </Badge>
                                      )}
                                      {isPostReg && (
                                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300">
                                          <UploadIcon className="w-2.5 h-2.5 mr-1" />
                                          Nachträglich hochgeladen
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                      {doc.original_filename && (
                                        <p className="truncate">Datei: {doc.original_filename}</p>
                                      )}
                                      <p>Hochgeladen: {formatDate(doc.uploaded_at)}</p>
                                      {doc.file_size && (
                                        <p>Größe: {(doc.file_size / 1024).toFixed(0)} KB</p>
                                      )}
                                      {doc.verified_at && (
                                        <p className="text-green-600 dark:text-green-400">
                                          Geprüft am: {formatDate(doc.verified_at)}
                                        </p>
                                      )}
                                    </div>
                                    {doc.notes && (
                                      <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                        <MessageSquare className="w-3 h-3 inline mr-1" />
                                        <strong>Hinweis:</strong> {doc.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {/* View document */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="Dokument öffnen"
                                    onClick={async () => {
                                      const url = doc.file_url || doc.document_url;
                                      if (url) {
                                        await openPrivateDocument(url, "dealer-documents");
                                      }
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>

                                  {/* Add/edit note – only for real DB documents */}
                                  {!String(doc.id).startsWith("fallback-") && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      title="Hinweis hinzufügen"
                                      onClick={() => {
                                        setDocNoteDialogId(doc.id);
                                        setDocNote(doc.notes || "");
                                      }}
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                    </Button>
                                  )}

                                  {/* Verify / Unverify – only for real DB documents */}
                                  {!String(doc.id).startsWith("fallback-") && (
                                    <Button
                                      variant={doc.verified ? "outline" : "default"}
                                      size="sm"
                                      className={`h-8 ${
                                        doc.verified
                                          ? ""
                                          : "bg-green-600 hover:bg-green-700 text-white"
                                      }`}
                                      disabled={verifyDocMutation.isPending}
                                      onClick={() =>
                                        verifyDocMutation.mutate({
                                          docId: doc.id,
                                          verified: !doc.verified,
                                        })
                                      }
                                      title={doc.verified ? "Verifizierung aufheben" : "Als verifiziert markieren"}
                                    >
                                      {doc.verified ? (
                                        <><XCircle className="w-4 h-4 mr-1" /> Aufheben</>
                                      ) : (
                                        <><CheckCircle2 className="w-4 h-4 mr-1" /> Verifizieren</>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Keine Dokumente hochgeladen</p>
                        {dealer.status === "pending" && (
                          <p className="text-sm mt-2 text-amber-600">Der Händler hat noch keine Dokumente eingereicht.</p>
                        )}
                      </div>
                    )}

                    {/* SEPA Mandates */}
                    {dealerSepaMandates.length > 0 && (
                      <>
                        <Separator className="my-6" />
                        <h4 className="font-semibold mb-4">SEPA-Lastschriftmandate</h4>
                        <div className="space-y-3">
                          {dealerSepaMandates.map((mandate: any) => (
                            <div key={mandate.id} className="flex items-center justify-between p-3 rounded-lg border">
                              <div>
                                <p className="font-mono text-sm">{mandate.mandate_reference}</p>
                                <p className="text-xs text-muted-foreground">
                                  Erstellt: {formatDate(mandate.created_at)}
                                </p>
                              </div>
                              <Badge variant={mandate.status === "active" ? "default" : "outline"}>
                                {mandate.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="activity">
                  <DetailSection title="Gebotsaktivität" icon={<Gavel className="w-5 h-5" />}>
                    {dealerBids.length > 0 ? (
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Auktion</TableHead>
                            <TableHead>Betrag</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Zeitpunkt</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dealerBids.map((bid: any) => (
                            <TableRow key={bid.id}>
                              <TableCell>
                                <p className="font-medium">
                                  {bid.auction?.kitchen?.manufacturer} {bid.auction?.kitchen?.model}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {bid.auction?.kitchen?.year}
                                </p>
                              </TableCell>
                              <TableCell className="font-semibold">{formatPrice(bid.amount)}</TableCell>
                              <TableCell>
                                <Badge variant={bid.auction?.status === "active" ? "default" : "outline"}>
                                  {bid.auction?.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(bid.created_at)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={!bid.auction?.id}
                                  title="Auktion öffnen"
                                  onClick={() => bid.auction?.id && navigate(`/admin/auctions/${bid.auction.id}`)}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Gavel className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Keine Gebotsaktivität</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Status Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Antragsstatus
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={getStatusBadge(dealer.status).variant}>
                      {getStatusBadge(dealer.status).label}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Eingereicht</span>
                      <span>{formatDate(dealer.created_at)}</span>
                    </div>
                    {dealer.reviewed_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Geprüft</span>
                        <span>{formatDate(dealer.reviewed_at)}</span>
                      </div>
                    )}
                    {dealer.updated_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aktualisiert</span>
                        <span>{formatDate(dealer.updated_at)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Invoices */}
              {dealerInvoices.length > 0 && (
                <DetailSection title="Letzte Rechnungen" icon={<FileText className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {dealerInvoices.map((invoice: any) => (
                      <div key={invoice.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm">{invoice.invoice_number}</span>
                          <Badge variant={invoice.status === "paid" ? "default" : "outline"}>
                            {invoice.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {formatDate(invoice.created_at)}
                          </span>
                          <span className="font-semibold">{formatPrice(invoice.total_amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Schnellaktionen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dealer.profile && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => navigate(`/admin/users/${dealer.profile.id}`)}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Benutzerprofil
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate(`/admin/financials?dealer=${dealer.user_id}`)}
                  >
                    <Euro className="w-4 h-4 mr-2" />
                    Finanzen anzeigen
                  </Button>
                  {dealer.trade_license_url && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={async () => {
                        await openPrivateDocument(dealer.trade_license_url, "dealer-documents");
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Gewerbeschein
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {dealer && dealer.status === "approved" && (
        <DealerEditDialog
          dealer={dealer}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Document Note Dialog */}
      <Dialog open={!!docNoteDialogId} onOpenChange={(open) => { if (!open) { setDocNoteDialogId(null); setDocNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hinweis zum Dokument</DialogTitle>
            <DialogDescription>
              Fügen Sie einen Hinweis hinzu, der dem Händler in seinem Dashboard angezeigt wird (z.B. "Bitte in besserer Qualität erneut hochladen").
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Hinweis eingeben..."
            value={docNote}
            onChange={(e) => setDocNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDocNoteDialogId(null); setDocNote(""); }}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                if (docNoteDialogId) {
                  addDocNoteMutation.mutate({ docId: docNoteDialogId, notes: docNote });
                }
              }}
              disabled={addDocNoteMutation.isPending}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Händlerantrag ablehnen</DialogTitle>
            <DialogDescription>
              Bitte geben Sie einen Grund für die Ablehnung an.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Grund für die Ablehnung..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Antrag endgültig löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Der Antrag von <strong>{dealer?.company_name}</strong> wird unwiderruflich gelöscht.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dealer?.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
              <p className="font-medium text-red-800 mb-1">Ablehnungsgrund:</p>
              <p className="text-red-700">{dealer.rejection_reason}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Löschen..." : "Endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminDetailLayout>
  );
}
