/**
 * Admin Dealer Detail Page
 * Comprehensive view of dealer application, business info, documents, and activity
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { approveDealerApplication, rejectDealerApplication, deleteDealerApplication } from "@/lib/dealerApplications";
import { toast } from "sonner";
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
import { logger } from "@/lib/logger";

export default function AdminDealerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Fetch dealer application with all related data
  // NOTE: Cannot use Supabase JOIN syntax profile:user_id(...) because
  // there is no foreign key between dealer_applications.user_id and profiles.id.
  // Fetch all related data separately and join in code.
  const { data: dealer, isLoading, error } = useQuery({
    queryKey: ["adminDealerDetail", id],
    queryFn: async () => {
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

      // 3. Fetch legal documents
      const { data: legalDocs } = await supabase
        .from("legal_documents")
        .select("id, document_type, file_url, uploaded_at")
        .eq("dealer_application_id", data.id);

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
              motorhome:motorhomes(manufacturer, model, year)
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
            motorhome:motorhomes(id, manufacturer, model, year, sold_to)
          `)
          .eq("motorhome.sold_to", data.user_id)
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

      return {
        ...data,
        profile,
        legal_documents: legalDocs || [],
        sepa_mandates: sepaMandates || [],
        bids,
        wonAuctions,
        invoices: invoices || [],
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

  // Delete dealer application mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Application ID is required');
      await deleteDealerApplication(id);
    },
    onSuccess: () => {
      toast.success("Händlerantrag gelöscht");
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      navigate("/admin/dealers");
    },
    onError: (error) => {
      logger.error("Delete dealer error:", error);
      toast.error("Fehler beim Löschen des Antrags");
    },
  });

  // Suspend dealer mutation
  const suspendMutation = useMutation({
    mutationFn: async (suspend: boolean) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_suspended: suspend,
          suspended_at: suspend ? new Date().toISOString() : null,
          suspended_reason: suspend ? "Händlerkonto gesperrt" : null,
        })
        .eq("id", dealer?.user_id);

      if (error) throw error;
    },
    onSuccess: (_, suspend) => {
      toast.success(suspend ? "Händler gesperrt" : "Händler entsperrt");
      queryClient.invalidateQueries({ queryKey: ["adminDealerDetail", id] });
    },
    onError: (error) => {
      logger.error("Suspend dealer error:", error);
      toast.error("Fehler beim Aktualisieren des Händlerstatus");
    },
  });

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

  const totalBidAmount = dealer?.bids?.reduce((sum: number, bid: any) => sum + bid.amount, 0) || 0;

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
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label="Gebote gesamt"
              value={dealer.bids?.length || 0}
              icon={<Gavel className="w-5 h-5" />}
            />
            <StatsCard
              label="Gebotsvolumen"
              value={formatPrice(totalBidAmount)}
              icon={<Euro className="w-5 h-5" />}
            />
            <StatsCard
              label="Gewonnene Auktionen"
              value={dealer.wonAuctions?.length || 0}
              icon={<Award className="w-5 h-5" />}
            />
            <StatsCard
              label="Rechnungen"
              value={dealer.invoices?.length || 0}
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
                  <DetailSection title="Dokumente" icon={<FileText className="w-5 h-5" />}>
                    {dealer.legal_documents && dealer.legal_documents.length > 0 ? (
                      <div className="space-y-3">
                        {dealer.legal_documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium capitalize">{doc.document_type.replace("_", " ")}</p>
                                <p className="text-xs text-muted-foreground">
                                  Hochgeladen: {formatDate(doc.uploaded_at)}
                                </p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Öffnen
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Keine Dokumente hochgeladen</p>
                      </div>
                    )}

                    {/* SEPA Mandates */}
                    {dealer.sepa_mandates && dealer.sepa_mandates.length > 0 && (
                      <>
                        <Separator className="my-6" />
                        <h4 className="font-semibold mb-4">SEPA-Lastschriftmandate</h4>
                        <div className="space-y-3">
                          {dealer.sepa_mandates.map((mandate: any) => (
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
                    {dealer.bids && dealer.bids.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Auktion</TableHead>
                            <TableHead>Betrag</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Zeitpunkt</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dealer.bids.map((bid: any) => (
                            <TableRow key={bid.id}>
                              <TableCell>
                                <p className="font-medium">
                                  {bid.auction?.motorhome?.manufacturer} {bid.auction?.motorhome?.model}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {bid.auction?.motorhome?.year}
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
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
              {dealer.invoices && dealer.invoices.length > 0 && (
                <DetailSection title="Letzte Rechnungen" icon={<FileText className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {dealer.invoices.map((invoice: any) => (
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
                      asChild
                    >
                      <a href={dealer.trade_license_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-4 h-4 mr-2" />
                        Gewerbeschein
                      </a>
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
