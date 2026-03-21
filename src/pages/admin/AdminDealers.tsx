import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { Card } from "@/components/ui/card";
import {
  fetchDealerApplications,
  approveDealerApplication,
  rejectDealerApplication,
} from "@/lib/dealerApplications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Building2,
  Clock,
  FileText,
  MoreHorizontal,
  Edit,
  Users,
  Search,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { DealerEditDialog } from "@/components/admin/DealerEditDialog";

interface DealerProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_suspended?: boolean;
}

interface DealerApplication {
  id: string;
  user_id: string;
  company_name: string;
  company_address: string;
  company_postal_code: string;
  company_city: string;
  tax_id: string;
  trade_license_number: string;
  contact_person_name: string;
  contact_person_position: string | null;
  phone: string;
  website: string | null;
  business_description: string | null;
  trade_license_document_url: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  legal_form?: string | null;
  founded_year?: number | null;
  handelsregister_number?: string | null;
  employee_count?: string | null;
  annual_revenue?: string | null;
  iban?: string | null;
  bic?: string | null;
  profiles?: DealerProfile;
}

export default function AdminDealers() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedApplication, setSelectedApplication] =
    useState<DealerApplication | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("applications");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all applications
  const { data: applications, isLoading } = useQuery({
    queryKey: ["dealerApplications"],
    queryFn: fetchDealerApplications,
    retry: 1,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch active dealers (approved applications with profiles)
  // NOTE: Cannot use Supabase JOIN syntax profiles:user_id(...) because
  // there is no foreign key between dealer_applications.user_id and profiles.id.
  // Instead, fetch separately and join in code (same approach as fetchDealerApplications).
  const { data: activeDealers, isLoading: isLoadingDealers } = useQuery({
    queryKey: ["activeDealers"],
    queryFn: async () => {
      // 1. Fetch approved dealer applications
      const { data: applicationsData, error: applicationsError } = await supabase
        .from("dealer_applications")
        .select("*")
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false });

      if (applicationsError) throw applicationsError;
      if (!applicationsData || applicationsData.length === 0) return [];

      // 2. Fetch corresponding profiles
      const userIds = applicationsData.map((app) => app.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, phone, is_suspended")
        .in("id", userIds);

      // 3. Join manually
      const data = applicationsData.map((application) => ({
        ...application,
        profiles: profilesData?.find((profile) => profile.id === application.user_id) || null,
      }));

      return data as DealerApplication[];
    },
    retry: 1,
    staleTime: 0,
  });

  const approveMutation = useMutation({
    mutationFn: approveDealerApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
      toast({
        title: "Antrag genehmigt",
        description: "Der Händler-Zugang wurde aktiviert",
      });
      setShowDetailDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      applicationId,
      reason,
    }: {
      applicationId: string;
      reason: string;
    }) => {
      await rejectDealerApplication(applicationId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      toast({
        title: "Antrag abgelehnt",
        description: "Der Antragsteller wurde benachrichtigt",
      });
      setShowRejectDialog(false);
      setShowDetailDialog(false);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Suspend/Unsuspend dealer mutation
  const suspendMutation = useMutation({
    mutationFn: async ({ dealerId, suspend }: { dealerId: string; suspend: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_suspended: suspend,
          suspended_at: suspend ? new Date().toISOString() : null,
          suspended_reason: suspend ? "Vom Administrator gesperrt" : null,
        })
        .eq("id", dealerId);
      if (error) throw error;
    },
    onSuccess: (_, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
      toast({
        title: suspend ? "Händler gesperrt" : "Händler entsperrt",
        description: suspend
          ? "Der Händler kann sich nicht mehr anmelden."
          : "Der Händler kann sich wieder anmelden.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter active dealers by search
  const filteredDealers = useMemo(() => {
    if (!activeDealers) return [];
    if (!searchTerm) return activeDealers;

    const searchLower = searchTerm.toLowerCase();
    return activeDealers.filter(
      (dealer) =>
        dealer.company_name?.toLowerCase().includes(searchLower) ||
        dealer.company_city?.toLowerCase().includes(searchLower) ||
        dealer.contact_person_name?.toLowerCase().includes(searchLower) ||
        dealer.profiles?.email?.toLowerCase().includes(searchLower)
    );
  }, [activeDealers, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" /> Ausstehend
          </Badge>
        );
      case "approved":
        return (
          <Badge className="gap-1 bg-green-500">
            <CheckCircle2 className="w-3 h-3" /> Genehmigt
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" /> Abgelehnt
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleEditDealer = (dealer: DealerApplication) => {
    setSelectedApplication(dealer);
    setShowEditDialog(true);
  };

  const handleViewDetails = (application: DealerApplication) => {
    navigate(`/admin/dealers/${application.id}`);
  };

  // Filter pending applications for the applications tab
  const pendingApplications = useMemo(() => {
    return applications?.filter((a: DealerApplication) => a.status === "pending") || [];
  }, [applications]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Händlerverwaltung
          </h1>
          <p className="text-muted-foreground">
            Verwalten Sie Händler-Anträge und aktive Händler
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            logger.log("Manual refresh triggered");
            queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
            queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
          }}
          disabled={isLoading || isLoadingDealers}
        >
          {isLoading || isLoadingDealers ? "Lädt..." : "Aktualisieren"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Ausstehend",
            count:
              applications?.filter((a: DealerApplication) => a.status === "pending")
                .length || 0,
            icon: Clock,
            color: "text-yellow-500",
          },
          {
            label: "Aktive Händler",
            count: activeDealers?.length || 0,
            icon: Users,
            color: "text-green-500",
          },
          {
            label: "Genehmigt (Gesamt)",
            count:
              applications?.filter((a: DealerApplication) => a.status === "approved")
                .length || 0,
            icon: CheckCircle2,
            color: "text-blue-500",
          },
          {
            label: "Abgelehnt",
            count:
              applications?.filter((a: DealerApplication) => a.status === "rejected")
                .length || 0,
            icon: XCircle,
            color: "text-red-500",
          },
        ].map((stat, idx) => (
          <Card key={idx} className="p-6">
            <div className="flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}
              >
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Anträge
            {pendingApplications.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingApplications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dealers" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Aktive Händler
          </TabsTrigger>
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="applications" className="mt-6">
          <Card>
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">
                  Lade Händler-Anträge...
                </p>
              </div>
            ) : !applications || applications.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">
                  Keine Anträge gefunden
                </h3>
                <p className="text-muted-foreground mb-4">
                  {applications === null
                    ? "Fehler beim Laden der Anträge"
                    : "Aktuell liegen keine Händler-Bewerbungen vor"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Eingereicht</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((application: DealerApplication) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {application.company_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {application.company_city}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {application.contact_person_name ||
                              `${application.profiles?.first_name || ""} ${
                                application.profiles?.last_name || ""
                              }`.trim() ||
                              "Unbekannt"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {application.profiles?.email || "Keine E-Mail"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(application.submitted_at),
                          "dd.MM.yyyy",
                          { locale: de }
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(application.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(application)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Active Dealers Tab */}
        <TabsContent value="dealers" className="mt-6 space-y-4">
          {/* Search */}
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nach Firma, Stadt, Name oder E-Mail suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </Card>

          <Card>
            {isLoadingDealers ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Lade Händler...</p>
              </div>
            ) : !filteredDealers || filteredDealers.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">
                  Keine Händler gefunden
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm
                    ? "Keine Ergebnisse für Ihre Suche"
                    : "Keine aktiven Händler vorhanden"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Mitglied seit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDealers.map((dealer) => (
                    <TableRow
                      key={dealer.id}
                      className={
                        dealer.profiles?.is_suspended ? "opacity-60" : ""
                      }
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{dealer.company_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {dealer.company_city}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {dealer.contact_person_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {dealer.phone}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{dealer.profiles?.email}</p>
                      </TableCell>
                      <TableCell>
                        {dealer.reviewed_at &&
                          format(new Date(dealer.reviewed_at), "dd.MM.yyyy", {
                            locale: de,
                          })}
                      </TableCell>
                      <TableCell>
                        {dealer.profiles?.is_suspended ? (
                          <Badge
                            variant="destructive"
                            className="flex items-center gap-1 w-fit"
                          >
                            <Ban className="w-3 h-3" />
                            Gesperrt
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 w-fit text-green-600 border-green-600"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Aktiv
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(dealer)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Details anzeigen
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditDealer(dealer)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {dealer.profiles?.is_suspended ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  suspendMutation.mutate({
                                    dealerId: dealer.profiles!.id,
                                    suspend: false,
                                  })
                                }
                                disabled={suspendMutation.isPending}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                                Entsperren
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  suspendMutation.mutate({
                                    dealerId: dealer.profiles!.id,
                                    suspend: true,
                                  })
                                }
                                disabled={suspendMutation.isPending}
                                className="text-destructive focus:text-destructive"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Sperren
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                // Navigate to user management with this user
                                window.location.href = `/admin/users?search=${encodeURIComponent(
                                  dealer.profiles?.email || ""
                                )}`;
                              }}
                            >
                              <Users className="w-4 h-4 mr-2" />
                              Benutzer verwalten
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Händler-Antrag Details</DialogTitle>
            <DialogDescription>
              Prüfen Sie die Unterlagen und entscheiden Sie über die Bewerbung
            </DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <span className="font-medium">Status:</span>
                {getStatusBadge(selectedApplication.status)}
              </div>

              {/* Company Info */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Unternehmen
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Firma</Label>
                    <p className="font-medium">
                      {selectedApplication.company_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Adresse</Label>
                    <p className="font-medium">
                      {selectedApplication.company_address}
                      <br />
                      {selectedApplication.company_postal_code}{" "}
                      {selectedApplication.company_city}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Steuernummer
                    </Label>
                    <p className="font-medium">{selectedApplication.tax_id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Gewerbeschein
                    </Label>
                    <p className="font-medium">
                      {selectedApplication.trade_license_number}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="font-semibold mb-3">Ansprechpartner</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">
                      {selectedApplication.contact_person_name}
                    </p>
                  </div>
                  {selectedApplication.contact_person_position && (
                    <div>
                      <Label className="text-muted-foreground">Position</Label>
                      <p className="font-medium">
                        {selectedApplication.contact_person_position}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Telefon</Label>
                    <p className="font-medium">{selectedApplication.phone}</p>
                  </div>
                  {selectedApplication.website && (
                    <div>
                      <Label className="text-muted-foreground">Website</Label>
                      <a
                        href={selectedApplication.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {selectedApplication.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Description */}
              {selectedApplication.business_description && (
                <div>
                  <Label className="text-muted-foreground">
                    Geschäftsbeschreibung
                  </Label>
                  <p className="mt-2 text-sm bg-muted p-3 rounded-lg">
                    {selectedApplication.business_description}
                  </p>
                </div>
              )}

              {/* Document */}
              {selectedApplication.trade_license_document_url && (
                <div>
                  <Label className="text-muted-foreground">Gewerbeschein</Label>
                  <a
                    href={selectedApplication.trade_license_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    Dokument anzeigen
                  </a>
                </div>
              )}

              {/* Rejection Reason if rejected */}
              {selectedApplication.status === "rejected" &&
                selectedApplication.rejection_reason && (
                  <div>
                    <Label className="text-muted-foreground">
                      Ablehnungsgrund
                    </Label>
                    <p className="mt-2 text-sm bg-destructive/10 text-destructive p-3 rounded-lg">
                      {selectedApplication.rejection_reason}
                    </p>
                  </div>
                )}
            </div>
          )}

          {selectedApplication?.status === "pending" && (
            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Ablehnen
              </Button>
              <Button
                onClick={() => approveMutation.mutate(selectedApplication.id)}
                disabled={approveMutation.isPending}
                className="gradient-hero hover:gradient-hero-hover"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Genehmigen
              </Button>
            </DialogFooter>
          )}

          {selectedApplication?.status === "approved" && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDetailDialog(false);
                  handleEditDealer(selectedApplication);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Bearbeiten
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Antrag ablehnen</DialogTitle>
            <DialogDescription>
              Bitte geben Sie einen Grund für die Ablehnung an. Der
              Antragsteller wird per E-Mail benachrichtigt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Ablehnungsgrund *</Label>
              <Textarea
                id="rejectionReason"
                placeholder="z.B. Fehlende Nachweise, Unvollständige Angaben..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectMutation.mutate({
                  applicationId: selectedApplication!.id,
                  reason: rejectionReason,
                })
              }
              disabled={!rejectionReason || rejectMutation.isPending}
            >
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <DealerEditDialog
        dealer={selectedApplication}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </div>
  );
}
