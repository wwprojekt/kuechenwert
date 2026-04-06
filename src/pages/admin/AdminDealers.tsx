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
  deleteDealerApplication,
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
  Trash2,
  AlertTriangle,
  UserPlus,
  FileUp,
  Send,
  ShieldCheck,
  FileCheck2,
  CreditCard,
} from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { DealerEditDialog } from "@/components/admin/DealerEditDialog";
import { DealerCreateDialog } from "@/components/admin/DealerCreateDialog";
import { CountryFlag } from "@/components/CountryFlag";

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
  country?: string | null;
  confirmation_link_sent_count?: number;
  confirmation_link_last_sent_at?: string | null;
  document_request_sent_count?: number;
  document_request_last_sent_at?: string | null;
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("applications");

  // ---- Sortierung ----
  const { sortField, sortDirection, handleSort, sortData } = useTableSort('created_at', 'desc');

  const dealerSortAccessors: Record<string, (d: any) => unknown> = {
    company_name: (d) => (d.company_name || '').toLowerCase(),
    contact_person: (d) => (d.contact_person_name || `${d.profiles?.first_name || ''} ${d.profiles?.last_name || ''}`).toLowerCase(),
    country: (d) => (d.country || '').toLowerCase(),
    email: (d) => (d.profiles?.email || '').toLowerCase(),
    created_at: (d) => d.created_at || '',
    rejected_at: (d) => d.rejected_at || d.updated_at || '',
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [authStatusMap, setAuthStatusMap] = useState<Record<string, { email_confirmed_at: string | null; created_at: string; last_sign_in_at: string | null }>>({});
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [requestingDocUserId, setRequestingDocUserId] = useState<string | null>(null);

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

  // Fetch legal documents for all dealer applications
  const { data: legalDocumentsMap } = useQuery({
    queryKey: ["dealerLegalDocuments", applications, activeDealers],
    queryFn: async () => {
      const allAppIds = [
        ...(applications?.map(a => a.id) || []),
        ...(activeDealers?.map(d => d.id) || []),
      ].filter((id, i, arr) => arr.indexOf(id) === i);
      if (allAppIds.length === 0) return {};

      const { data, error } = await supabase
        .from("legal_documents")
        .select("id, dealer_application_id, document_type, verified, uploaded_at, original_filename")
        .in("dealer_application_id", allAppIds);

      if (error) {
        logger.error("Failed to fetch legal documents:", error);
        return {};
      }

      // Group by dealer_application_id
      const map: Record<string, Array<{ document_type: string; verified: boolean | null; uploaded_at: string | null; original_filename: string | null }>> = {};
      (data || []).forEach((doc: any) => {
        if (!map[doc.dealer_application_id]) map[doc.dealer_application_id] = [];
        map[doc.dealer_application_id].push(doc);
      });
      return map;
    },
    enabled: !!(applications || activeDealers),
    staleTime: 30000,
  });

  // Helper: Render document status icons for a dealer application
  const renderDocumentStatusIcons = (applicationId: string) => {
    const docs = legalDocumentsMap?.[applicationId] || [];
    const docTypes = [
      { key: "gewerbenachweis", label: "Gewerbenachweis", short: "G" },
      { key: "ausweis_front", label: "Ausweis Vorderseite", short: "V" },
      { key: "ausweis_back", label: "Ausweis Rückseite", short: "R" },
    ];

    const uploadedCount = docTypes.filter(dt => docs.some(d => d.document_type === dt.key)).length;

    return (
      <div className="flex items-center gap-1">
        {docTypes.map((dt) => {
          const doc = docs.find(d => d.document_type === dt.key);
          const isUploaded = !!doc;
          const statusColor = doc?.verified === true ? "text-green-600" : isUploaded ? "text-amber-500" : "text-gray-300";
          const bgColor = doc?.verified === true ? "bg-green-50 border-green-200" : isUploaded ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200";
          const tooltipText = isUploaded
            ? `${dt.label}: ${doc.verified === true ? "Verifiziert" : "Wird geprüft"}${doc.original_filename ? ` (${doc.original_filename})` : ""}${doc.uploaded_at ? ` - ${format(new Date(doc.uploaded_at), "dd.MM.yyyy HH:mm", { locale: de })}` : ""}`
            : `${dt.label}: Nicht hochgeladen`;

          return (
            <span
              key={dt.key}
              title={tooltipText}
              className={`inline-flex items-center justify-center w-6 h-6 rounded border text-[10px] font-bold cursor-default ${statusColor} ${bgColor}`}
            >
              {dt.short}
            </span>
          );
        })}
        <span className={`ml-1 text-[10px] font-medium ${
          uploadedCount === 3 ? "text-green-600" : uploadedCount > 0 ? "text-amber-600" : "text-gray-400"
        }`}>
          {uploadedCount}/3
        </span>
      </div>
    );
  };

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

  const sortedFilteredDealers = useMemo(() => sortData(filteredDealers, dealerSortAccessors), [filteredDealers, sortData]);

  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "haendler",
    columns: [
      { key: "company_name", label: "Firma" },
      { key: "country", label: "Land" },
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

  // Delete dealer application mutation
  const deleteMutation = useMutation({
    mutationFn: deleteDealerApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      toast({
        title: "Antrag gelöscht",
        description: "Der Händlerantrag wurde erfolgreich gelöscht.",
      });
      setShowDeleteDialog(false);
      setSelectedApplication(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Löschen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Suspend/Unsuspend dealer mutation
  // Resend confirmation email mutation
  const resendConfirmationMutation = useMutation({
    mutationFn: async ({ userId, dealerApplicationId }: { userId: string; dealerApplicationId?: string }) => {
      setResendingUserId(userId);
      
      // Session explizit refreshen um sicherzustellen dass der JWT gültig ist
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        throw new Error('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
      }
      
      const { data, error } = await supabase.functions.invoke('resend-confirmation-email', {
        body: { user_id: userId, dealer_application_id: dealerApplicationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Bestätigungslink gesendet",
        description: data?.message || "Der Bestätigungslink wurde erfolgreich gesendet.",
      });
      setResendingUserId(null);
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Senden",
        description: error.message || "Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
        variant: "destructive",
      });
      setResendingUserId(null);
    },
  });

  // Request dealer documents mutation
  const requestDocumentsMutation = useMutation({
    mutationFn: async ({ dealerApplicationId, dealerEmail, dealerName, companyName }: {
      dealerApplicationId: string;
      dealerEmail: string;
      dealerName: string;
      companyName: string;
    }) => {
      setRequestingDocUserId(dealerApplicationId);
      
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        throw new Error('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
      }
      
      const { data, error } = await supabase.functions.invoke('request-dealer-documents', {
        body: {
          dealer_application_id: dealerApplicationId,
          dealer_email: dealerEmail,
          dealer_name: dealerName,
          company_name: companyName,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Dokument-Anforderung gesendet",
        description: data?.message || "Die E-Mail wurde erfolgreich gesendet.",
      });
      setRequestingDocUserId(null);
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Senden",
        description: error.message || "Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
      setRequestingDocUserId(null);
    },
  });

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

  // Filter rejected applications
  const rejectedApplications = useMemo(() => {
    return applications?.filter((a: DealerApplication) => a.status === "rejected") || [];
  }, [applications]);

  // Filter approved applications (not yet active dealers)
  const approvedApplications = useMemo(() => {
    return applications?.filter((a: DealerApplication) => a.status === "approved") || [];
  }, [applications]);

  const sortedPending = useMemo(() => sortData(pendingApplications, dealerSortAccessors), [pendingApplications, sortData]);
  const sortedRejected = useMemo(() => sortData(rejectedApplications, dealerSortAccessors), [rejectedApplications, sortData]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">
            Händlerverwaltung
          </h1>
          <p className="text-muted-foreground">
            Verwalten Sie Händler-Anträge und aktive Händler
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Händler anlegen
          </Button>
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
          <TabsTrigger value="applications">Händleranträge ({pendingApplications.length})</TabsTrigger>
          <TabsTrigger value="rejected">Abgelehnt ({rejectedApplications.length})</TabsTrigger>
          <TabsTrigger value="dealers">Aktive Händler</TabsTrigger>
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="company_name" label="Firma" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="contact_person" label="Ansprechpartner" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="created_at" label="Eingereicht am" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="email" label="E-Mail" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <TableHead>Dokumente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      Lade Anträge...
                    </TableCell>
                  </TableRow>
                ) : pendingApplications.length > 0 ? (
                  sortedPending.map((application: DealerApplication) => (
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="gap-1 text-orange-500 border-orange-300">
                              <MailX className="w-3 h-3" /> Unbestätigt
                            </Badge>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={resendingUserId === application.user_id}
                                onClick={() => resendConfirmationMutation.mutate({ userId: application.user_id, dealerApplicationId: application.id })}
                              >
                                <MailCheck className="w-3 h-3" />
                                {resendingUserId === application.user_id ? "Sende..." : "Link senden"}
                              </Button>
                              {(application.confirmation_link_sent_count ?? 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground" title={application.confirmation_link_last_sent_at ? `Zuletzt: ${format(new Date(application.confirmation_link_last_sent_at), "dd.MM.yyyy HH:mm", { locale: de })}` : ""}>
                                  ({application.confirmation_link_sent_count}x)
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {renderDocumentStatusIcons(application.id)}
                          <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                            disabled={requestingDocUserId === application.id}
                            onClick={() => {
                              const email = application.profiles?.email || authStatusMap[application.user_id]?.email_confirmed_at ? application.profiles?.email : '';
                              if (!email && !application.profiles?.email) {
                                toast({ title: "Fehler", description: "Keine E-Mail-Adresse gefunden.", variant: "destructive" });
                                return;
                              }
                              requestDocumentsMutation.mutate({
                                dealerApplicationId: application.id,
                                dealerEmail: application.profiles?.email || '',
                                dealerName: application.contact_person_name,
                                companyName: application.company_name,
                              });
                            }}
                          >
                            <FileUp className="w-3 h-3" />
                            {requestingDocUserId === application.id ? "Sende..." : "Dok. anfordern"}
                          </Button>
                          {(application.document_request_sent_count ?? 0) > 0 && (
                            <span className="text-[10px] text-muted-foreground" title={application.document_request_last_sent_at ? `Zuletzt: ${format(new Date(application.document_request_last_sent_at), "dd.MM.yyyy HH:mm", { locale: de })}` : ""}>
                              ({application.document_request_sent_count}x)
                            </span>
                          )}
                          </div>
                        </div>
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
                    <TableCell colSpan={7} className="text-center">
                      Keine ausstehenden Anträge gefunden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Rejected Applications Tab */}
        <TabsContent value="rejected" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="company_name" label="Firma" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="contact_person" label="Ansprechpartner" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="created_at" label="Eingereicht am" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <TableHead>Ablehnungsgrund</TableHead>
                  <SortableTableHead field="rejected_at" label="Abgelehnt am" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejectedApplications.length > 0 ? (
                  sortedRejected.map((application: DealerApplication) => (
                    <TableRow key={application.id} className="bg-red-50/50">
                      <TableCell className="font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {application.company_name}
                      </TableCell>
                      <TableCell>{application.contact_person_name}</TableCell>
                      <TableCell>
                        {format(new Date(application.submitted_at), "dd.MM.yyyy", { locale: de })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={application.rejection_reason || ""}>
                        {application.rejection_reason || "Kein Grund angegeben"}
                      </TableCell>
                      <TableCell>
                        {application.reviewed_at
                          ? format(new Date(application.reviewed_at), "dd.MM.yyyy HH:mm", { locale: de })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(application)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setSelectedApplication(application);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Löschen
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Keine abgelehnten Anträge vorhanden.
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
                  <SortableTableHead field="company_name" label="Firma" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="country" label="Land" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="contact_person" label="Ansprechpartner" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead field="email" label="E-Mail" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  <TableHead>Dokumente</TableHead>
                  <TableHead>E-Mail bestätigt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDealers ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      Lade Händler...
                    </TableCell>
                  </TableRow>
                ) : filteredDealers.length > 0 ? (
                  sortedFilteredDealers.map((dealer: DealerApplication) => (
                    <TableRow key={dealer.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {dealer.company_name}
                      </TableCell>
                      <TableCell>
                        <CountryFlag countryCode={dealer.country} showName={false} />
                        <span className="ml-1 text-xs text-muted-foreground">{dealer.country || "DE"}</span>
                      </TableCell>
                      <TableCell>{dealer.contact_person_name}</TableCell>
                      <TableCell>{dealer.profiles?.email}</TableCell>
                      <TableCell>
                        {renderDocumentStatusIcons(dealer.id)}
                      </TableCell>
                      <TableCell>
                        {authStatusMap[dealer.user_id]?.email_confirmed_at ? (
                          <Badge className="gap-1 bg-green-500">
                            <MailCheck className="w-3 h-3" /> Bestätigt
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="gap-1 text-orange-500 border-orange-300">
                              <MailX className="w-3 h-3" /> Unbestätigt
                            </Badge>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={resendingUserId === dealer.user_id}
                                onClick={() => resendConfirmationMutation.mutate({ userId: dealer.user_id, dealerApplicationId: dealer.id })}
                              >
                                <MailCheck className="w-3 h-3" />
                                {resendingUserId === dealer.user_id ? "Sende..." : "Link senden"}
                              </Button>
                              {(dealer.confirmation_link_sent_count ?? 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground" title={dealer.confirmation_link_last_sent_at ? `Zuletzt: ${format(new Date(dealer.confirmation_link_last_sent_at), "dd.MM.yyyy HH:mm", { locale: de })}` : ""}>
                                  ({dealer.confirmation_link_sent_count}x)
                                </span>
                              )}
                            </div>
                          </div>
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
                            {!authStatusMap[dealer.user_id]?.email_confirmed_at && (
                              <DropdownMenuItem
                                onClick={() => resendConfirmationMutation.mutate({ userId: dealer.user_id, dealerApplicationId: dealer.id })}
                                disabled={resendingUserId === dealer.user_id}
                              >
                                <MailCheck className="mr-2 h-4 w-4" />
                                <span>{resendingUserId === dealer.user_id ? "Sende..." : "Bestätigungslink senden"}</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                if (!dealer.profiles?.email) {
                                  toast({ title: "Fehler", description: "Keine E-Mail-Adresse gefunden.", variant: "destructive" });
                                  return;
                                }
                                requestDocumentsMutation.mutate({
                                  dealerApplicationId: dealer.id,
                                  dealerEmail: dealer.profiles.email,
                                  dealerName: dealer.contact_person_name,
                                  companyName: dealer.company_name,
                                });
                              }}
                              disabled={requestingDocUserId === dealer.id}
                            >
                              <FileUp className="mr-2 h-4 w-4" />
                              <span>
                                {requestingDocUserId === dealer.id ? "Sende..." : "Dokumente anfordern"}
                                {(dealer.document_request_sent_count ?? 0) > 0 && ` (${dealer.document_request_sent_count}x)`}
                              </span>
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
                    <TableCell colSpan={8} className="text-center">
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

      {/* Dialog for Deleting Application */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Antrag endgültig löschen?
            </DialogTitle>
            <DialogDescription>
              Der Antrag von <strong>{selectedApplication?.company_name}</strong> wird unwiderruflich gelöscht.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          {selectedApplication?.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
              <p className="font-medium text-red-800 mb-1">Ablehnungsgrund:</p>
              <p className="text-red-700">{selectedApplication.rejection_reason}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedApplication &&
                deleteMutation.mutate(selectedApplication.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Löschen..." : "Endgültig löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Editing Dealer */}
      {selectedApplication && (
        <DealerEditDialog
          open={showEditDialog}
          onOpenChange={(open) => setShowEditDialog(open)}
          dealer={selectedApplication}
        />
      )}

      {/* Dialog for Creating New Dealer */}
      <DealerCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
