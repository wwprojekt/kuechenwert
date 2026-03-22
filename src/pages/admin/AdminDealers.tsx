import { useNavigate } from "react-router-dom";
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";
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
import { useState, useMemo, useEffect } from "react";
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
  MailCheck,
  MailX,
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
  const [authStatusMap, setAuthStatusMap] = useState<Record<string, { email_confirmed_at: string | null; created_at: string; last_sign_in_at: string | null }>>({});

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

  // Fetch auth status (email_confirmed_at) for all dealers
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const allUserIds = [
          ...(applications?.map(a => a.user_id) || []),
          ...(activeDealers?.map(d => d.user_id) || []),
        ].filter((id, i, arr) => arr.indexOf(id) === i);
        if (allUserIds.length === 0) return;
        const res = await supabase.functions.invoke('get-dealer-auth-status', {
          body: { user_ids: allUserIds },
        });
        if (res.data?.data) {
          const map: Record<string, any> = {};
          res.data.data.forEach((u: any) => { map[u.id] = u; });
          setAuthStatusMap(map);
        }
      } catch (err) {
        logger.error('Failed to fetch auth status:', err);
      }
    };
    if (applications || activeDealers) fetchAuthStatus();
  }, [applications, activeDealers]);

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

  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "haendler",
    columns: [
      { key: "company_name", label: "Firma" },
      { key: "contact_person_name", label: "Ansprechpartner" },
      {
        key: "profiles",
        label: "E-Mail",
        format: (value: any) => value?.email || "N/A",
      },
      { key: "phone", label: "Telefon" },
      { key: "company_city", label: "Stadt" },
      {
        key: "profiles",
        label: "Status",
        format: (value: any) => value?.is_suspended ? "Gesperrt" : "Aktiv",
      },
      {
        key: "submitted_at",
        label: "Registriert am",
        format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "",
      },
    ],
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
            label: "Genehmigt",
            count:
              applications?.filter((a: DealerApplication) => a.status === "approved")
                .length || 0,
            icon: CheckCircle2,
            color: "text-green-500",
          },
          {
            label: "Abgelehnt",
            count:
              applications?.filter((a: DealerApplication) => a.status === "rejected")
                .length || 0,
            icon: XCircle,
            color: "text-red-500",
          },
          {
            label: "Aktive Händler",
            count: activeDealers?.length || 0,
            icon: Users,
            color: "text-blue-500",
          },
        ].map((stat, index) => (
          <Card key={index} className="p-4 flex items-center gap-4">
            <stat.icon className={`w-8 h-8 ${stat.color}`} />
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.count}</p>
            </div>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">Händleranträge</TabsTrigger>
          <TabsTrigger value="dealers">Aktive Händler</TabsTrigger>
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Ansprechpartner</TableHead>
                  <TableHead>Eingereicht am</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Lade Anträge...
                    </TableCell>
                  </TableRow>
                ) : pendingApplications.length > 0 ? (
                  pendingApplications.map((application: DealerApplication) => (
                    <TableRow key={application.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {application.company_name}
                      </TableCell>
                      <TableCell>{application.contact_person_name}</TableCell>
                      <TableCell>
                        {format(new Date(application.submitted_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </TableCell>
                      <TableCell>
                        {authStatusMap[application.user_id]?.email_confirmed_at ? (
                          <Badge className="gap-1 bg-green-500">
                            <MailCheck className="w-3 h-3" /> Bestätigt
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-orange-500 border-orange-300">
                            <MailX className="w-3 h-3" /> Unbestätigt
                          </Badge>
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Keine ausstehenden Anträge gefunden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Dealers Tab */}
        <TabsContent value="dealers" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {filteredDealers.length} aktive Händler
            </p>
            <div className="flex items-center gap-2">
              <div className="relative w-full max-w-sm items-center">
                <Input
                  placeholder="Suche nach Firma, Stadt, Ansprechpartner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </span>
              </div>
              <ExportButton
                onExportCSV={() => exportCSV(filteredDealers || [])}
                onExportExcel={() => exportExcel(filteredDealers || [])}
                isExporting={isExporting}
              />
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Ansprechpartner</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>E-Mail bestätigt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDealers ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Lade Händler...
                    </TableCell>
                  </TableRow>
                ) : filteredDealers.length > 0 ? (
                  filteredDealers.map((dealer: DealerApplication) => (
                    <TableRow key={dealer.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {dealer.company_name}
                      </TableCell>
                      <TableCell>{dealer.contact_person_name}</TableCell>
                      <TableCell>{dealer.profiles?.email}</TableCell>
                      <TableCell>
                        {authStatusMap[dealer.user_id]?.email_confirmed_at ? (
                          <Badge className="gap-1 bg-green-500">
                            <MailCheck className="w-3 h-3" /> Bestätigt
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-orange-500 border-orange-300">
                            <MailX className="w-3 h-3" /> Unbestätigt
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {dealer.profiles?.is_suspended ? (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="w-3 h-3" /> Gesperrt
                          </Badge>
                        ) : (
                          <Badge className="gap-1 bg-green-500">
                            <CheckCircle2 className="w-3 h-3" /> Aktiv
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Menü öffnen</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(dealer)}>
                              <FileText className="mr-2 h-4 w-4" />
                              <span>Details anzeigen</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditDealer(dealer)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Stammdaten bearbeiten</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                suspendMutation.mutate({
                                  dealerId: dealer.user_id,
                                  suspend: !dealer.profiles?.is_suspended,
                                })
                              }
                              className={dealer.profiles?.is_suspended ? "" : "text-red-500"}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              <span>
                                {dealer.profiles?.is_suspended ? "Sperrung aufheben" : "Händler sperren"}
                              </span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Keine aktiven Händler gefunden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for Rejecting Application */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Antrag ablehnen</DialogTitle>
            <DialogDescription>
              Geben Sie einen Grund für die Ablehnung an. Der Bewerber wird per E-Mail benachrichtigt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="rejectionReason">Grund der Ablehnung</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="z.B. Unvollständige Unterlagen, ..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedApplication &&
                rejectMutation.mutate({
                  applicationId: selectedApplication.id,
                  reason: rejectionReason,
                })
              }
              disabled={rejectMutation.isPending || !rejectionReason}
            >
              {rejectMutation.isPending ? "Ablehnen..." : "Ablehnung bestätigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Editing Dealer */}
      {selectedApplication && (
        <DealerEditDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          dealer={selectedApplication}
        />
      )}
    </div>
  );
}
