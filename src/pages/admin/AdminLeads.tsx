import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import {
  UserPlus,
  Search,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  Send,
  PhoneCall,
  MessageSquare,
  Eye,
  TrendingUp,
  Users,
  Timer,
  Target,
  RefreshCw,
  Car,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface WizardSession {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  current_step: number;
  max_step_reached: number;
  total_steps: number;
  step_name: string | null;
  form_data: Record<string, unknown>;
  status: string;
  vehicle_summary: string | null;
  admin_notes: string | null;
  resume_email_sent_at: string | null;
  admin_called_at: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  completed_at: string | null;
}

interface QuickLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  manufacturer: string | null;
  model: string | null;
  body_type: string | null;
  sale_channel: string | null;
  source: string | null;
  wizard_completed: boolean;
  created_at: string;
}

// ============================================================================
// Step Names
// ============================================================================

const STEP_NAMES: Record<number, string> = {
  1: "Fahrzeugdetails",
  2: "Technik",
  3: "Abmessungen",
  4: "Innenraum",
  5: "Ausstattung",
  6: "Fotos",
  7: "Mängel",
  8: "Verkaufsweg",
  9: "Termin/Überprüfung",
  10: "Überprüfung/Anmeldung",
  11: "Anmeldung",
};

// ============================================================================
// Helper Components
// ============================================================================

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  color: string;
}) {
  return (
    <Card className="p-6 border-2 hover:border-primary/20 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "in_progress":
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600">
          <Clock className="w-3 h-3 mr-1" /> Aktiv
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Abgeschlossen
        </Badge>
      );
    case "abandoned":
      return (
        <Badge className="bg-red-500 hover:bg-red-600">
          <XCircle className="w-3 h-3 mr-1" /> Abgebrochen
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminLeads() {
  const [activeTab, setActiveTab] = useState("wizard_sessions");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<WizardSession | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Data Fetching ----

  const { data: wizardSessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["adminWizardSessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wizard_sessions")
        .select("*")
        .order("last_activity_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WizardSession[];
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const { data: quickLeads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["adminQuickLeads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as QuickLead[];
    },
  });

  // ---- Statistics ----

  const stats = useMemo(() => {
    const inProgress = wizardSessions.filter((s) => s.status === "in_progress").length;
    const abandoned = wizardSessions.filter((s) => s.status === "abandoned").length;
    const completed = wizardSessions.filter((s) => s.status === "completed").length;
    const total = wizardSessions.length;
    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Average step where users abandon
    const abandonedSessions = wizardSessions.filter((s) => s.status === "abandoned");
    const avgAbandonStep =
      abandonedSessions.length > 0
        ? Math.round(
            abandonedSessions.reduce((sum, s) => sum + s.max_step_reached, 0) /
              abandonedSessions.length
          )
        : 0;

    // Leads with contact info (actionable)
    const actionableLeads = wizardSessions.filter(
      (s) => s.status !== "completed" && (s.customer_email || s.customer_phone)
    ).length;

    // Not yet contacted
    const notContacted = wizardSessions.filter(
      (s) =>
        s.status !== "completed" &&
        !s.resume_email_sent_at &&
        !s.admin_called_at &&
        (s.customer_email || s.customer_phone)
    ).length;

    return {
      total,
      inProgress,
      abandoned,
      completed,
      conversionRate,
      avgAbandonStep,
      actionableLeads,
      notContacted,
      quickLeadsTotal: quickLeads.length,
    };
  }, [wizardSessions, quickLeads]);

  // ---- Filtering ----

  const filteredSessions = useMemo(() => {
    return wizardSessions.filter((session) => {
      // Status filter
      if (statusFilter !== "all" && session.status !== statusFilter) return false;

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (session.customer_name || "").toLowerCase().includes(q) ||
          (session.customer_email || "").toLowerCase().includes(q) ||
          (session.customer_phone || "").toLowerCase().includes(q) ||
          (session.vehicle_summary || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [wizardSessions, statusFilter, searchQuery]);

  const filteredQuickLeads = useMemo(() => {
    if (!searchQuery) return quickLeads;
    const q = searchQuery.toLowerCase();
    return quickLeads.filter(
      (lead) =>
        (lead.name || "").toLowerCase().includes(q) ||
        (lead.email || "").toLowerCase().includes(q) ||
        (lead.phone || "").toLowerCase().includes(q) ||
        (lead.manufacturer || "").toLowerCase().includes(q) ||
        (lead.model || "").toLowerCase().includes(q)
    );
  }, [quickLeads, searchQuery]);

  // ---- Mutations ----

  const sendResumeMail = useMutation({
    mutationFn: async ({
      sessionId,
      message,
    }: {
      sessionId: string;
      message?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "send-wizard-resume-email",
        {
          body: { sessionId, customMessage: message },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "E-Mail gesendet",
        description: "Die Wiederaufnahme-E-Mail wurde erfolgreich versendet.",
      });
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
      setEmailDialogOpen(false);
      setCustomMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Senden",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markAsCalled = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("wizard_sessions")
        .update({ admin_called_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Anruf vermerkt", description: "Der Anruf wurde erfolgreich dokumentiert." });
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
    },
  });

  const updateAdminNotes = useMutation({
    mutationFn: async ({ sessionId, notes }: { sessionId: string; notes: string }) => {
      const { error } = await supabase
        .from("wizard_sessions")
        .update({ admin_notes: notes })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notiz gespeichert" });
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
    },
  });

  const markAsAbandoned = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("wizard_sessions")
        .update({ status: "abandoned" })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Status aktualisiert", description: "Session als abgebrochen markiert." });
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
    },
  });

  // ---- Handlers ----

  const openDetail = (session: WizardSession) => {
    setSelectedSession(session);
    setAdminNotes(session.admin_notes || "");
    setDetailDialogOpen(true);
  };

  const openEmailDialog = (session: WizardSession) => {
    setSelectedSession(session);
    setCustomMessage("");
    setEmailDialogOpen(true);
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-primary" />
            Leads & Wizard-Sessions
          </h1>
          <p className="text-muted-foreground mt-1">
            Verwalten Sie alle Interessenten, Wizard-Abbrüche und Kontaktaufnahmen
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
            queryClient.invalidateQueries({ queryKey: ["adminQuickLeads"] });
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gesamt Sessions"
          value={stats.total}
          icon={Users}
          description={`${stats.quickLeadsTotal} Quick-Leads zusätzlich`}
          color="bg-blue-500"
        />
        <StatCard
          title="Abgebrochen"
          value={stats.abandoned}
          icon={XCircle}
          description={`Ø Abbruch bei Schritt ${stats.avgAbandonStep} (${STEP_NAMES[stats.avgAbandonStep] || "-"})`}
          color="bg-red-500"
        />
        <StatCard
          title="Noch nicht kontaktiert"
          value={stats.notContacted}
          icon={Target}
          description={`${stats.actionableLeads} mit Kontaktdaten`}
          color="bg-orange-500"
        />
        <StatCard
          title="Konversionsrate"
          value={`${stats.conversionRate}%`}
          icon={TrendingUp}
          description={`${stats.completed} abgeschlossen von ${stats.total}`}
          color="bg-green-500"
        />
      </div>

      {/* Funnel Visualization */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Wizard-Funnel: Wo brechen Nutzer ab?
        </h2>
        <div className="space-y-2">
          {Object.entries(STEP_NAMES).map(([stepStr, name]) => {
            const step = parseInt(stepStr);
            const reachedCount = wizardSessions.filter(
              (s) => s.max_step_reached >= step
            ).length;
            const percentage =
              wizardSessions.length > 0
                ? Math.round((reachedCount / wizardSessions.length) * 100)
                : 0;
            return (
              <div key={step} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-32 truncate">
                  {step}. {name}
                </span>
                <div className="flex-1">
                  <Progress value={percentage} className="h-4" />
                </div>
                <span className="text-xs font-medium w-16 text-right">
                  {reachedCount} ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Tabs: Wizard Sessions / Quick Leads */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="wizard_sessions" className="gap-2">
              <Timer className="w-4 h-4" />
              Wizard-Sessions ({wizardSessions.length})
            </TabsTrigger>
            <TabsTrigger value="quick_leads" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Quick-Leads ({quickLeads.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {activeTab === "wizard_sessions" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="in_progress">Aktiv</SelectItem>
                  <SelectItem value="abandoned">Abgebrochen</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Wizard Sessions Tab */}
        <TabsContent value="wizard_sessions">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Fortschritt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Letzte Aktivität</TableHead>
                  <TableHead>Kontaktiert</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSessions ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Lade Sessions...
                    </TableCell>
                  </TableRow>
                ) : filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Keine Sessions gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => (
                    <TableRow
                      key={session.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(session)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {session.customer_name || "Unbekannt"}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {session.customer_email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {session.customer_email}
                              </span>
                            )}
                          </div>
                          {session.customer_phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {session.customer_phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {session.vehicle_summary || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(session.max_step_reached / session.total_steps) * 100}
                            className="h-2 w-20"
                          />
                          <span className="text-xs text-muted-foreground">
                            {session.max_step_reached}/{session.total_steps}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.step_name || STEP_NAMES[session.current_step] || "-"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={session.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(session.last_activity_at), {
                            addSuffix: true,
                            locale: de,
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {session.resume_email_sent_at && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Mail className="w-3 h-3" />
                              {format(new Date(session.resume_email_sent_at), "dd.MM.", { locale: de })}
                            </Badge>
                          )}
                          {session.admin_called_at && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Phone className="w-3 h-3" />
                              {format(new Date(session.admin_called_at), "dd.MM.", { locale: de })}
                            </Badge>
                          )}
                          {!session.resume_email_sent_at && !session.admin_called_at && (
                            <span className="text-xs text-orange-500 font-medium">Noch nicht</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetail(session)}
                            title="Details anzeigen"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {session.customer_phone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                window.open(`tel:${session.customer_phone}`);
                                markAsCalled.mutate(session.id);
                              }}
                              title="Anrufen"
                            >
                              <PhoneCall className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {session.customer_email && session.status !== "completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEmailDialog(session)}
                              title="Wiederaufnahme-E-Mail senden"
                            >
                              <Send className="w-4 h-4 text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Quick Leads Tab */}
        <TabsContent value="quick_leads">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Wizard</TableHead>
                  <TableHead>Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLeads ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Lade Leads...
                    </TableCell>
                  </TableRow>
                ) : filteredQuickLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Keine Leads gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuickLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {lead.email && (
                            <p className="text-xs flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {lead.email}
                            </p>
                          )}
                          {lead.phone && (
                            <p className="text-xs flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {lead.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {[lead.manufacturer, lead.model].filter(Boolean).join(" ") || "-"}
                        </span>
                        {lead.body_type && (
                          <p className="text-xs text-muted-foreground">{lead.body_type}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {lead.source === "hero_form_partial"
                            ? "Teilweise"
                            : lead.source === "hero_form"
                            ? "Hero-Formular"
                            : lead.source || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.wizard_completed ? (
                          <Badge className="bg-green-500 text-xs">Ja</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-500">
                            Nein
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(lead.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================================================================== */}
      {/* Detail Dialog */}
      {/* ================================================================== */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Session Details
                </DialogTitle>
                <DialogDescription>
                  {selectedSession.vehicle_summary || "Keine Fahrzeugdaten"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Status & Progress */}
                <div className="flex items-center justify-between">
                  <StatusBadge status={selectedSession.status} />
                  <div className="flex items-center gap-2">
                    <Progress
                      value={
                        (selectedSession.max_step_reached / selectedSession.total_steps) * 100
                      }
                      className="h-3 w-32"
                    />
                    <span className="text-sm font-medium">
                      {Math.round(
                        (selectedSession.max_step_reached / selectedSession.total_steps) * 100
                      )}
                      %
                    </span>
                  </div>
                </div>

                {/* Contact Info */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Kontaktdaten
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {selectedSession.customer_name || "Nicht angegeben"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">E-Mail</p>
                      {selectedSession.customer_email ? (
                        <a
                          href={`mailto:${selectedSession.customer_email}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {selectedSession.customer_email}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">Nicht angegeben</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefon</p>
                      {selectedSession.customer_phone ? (
                        <a
                          href={`tel:${selectedSession.customer_phone}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {selectedSession.customer_phone}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">Nicht angegeben</p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Wizard Progress Steps */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" /> Wizard-Fortschritt
                  </h3>
                  <div className="space-y-1">
                    {Object.entries(STEP_NAMES).map(([stepStr, name]) => {
                      const step = parseInt(stepStr);
                      if (step > selectedSession.total_steps) return null;
                      const isCompleted = step < selectedSession.current_step;
                      const isCurrent = step === selectedSession.current_step;
                      return (
                        <div
                          key={step}
                          className={`flex items-center gap-2 p-2 rounded text-sm ${
                            isCurrent
                              ? "bg-primary/10 font-medium"
                              : isCompleted
                              ? "text-green-700"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : isCurrent ? (
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted" />
                          )}
                          <span>
                            {step}. {name}
                          </span>
                          {isCurrent && (
                            <Badge variant="outline" className="ml-auto text-xs">
                              Hier abgebrochen
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Form Data Preview */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Eingegebene Daten
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(selectedSession.form_data || {}).map(([key, value]) => {
                      if (
                        value === null ||
                        value === undefined ||
                        value === "" ||
                        value === false ||
                        key === "photos" ||
                        key === "photos_count"
                      )
                        return null;
                      const displayValue =
                        typeof value === "boolean"
                          ? "Ja"
                          : typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value);
                      return (
                        <div key={key} className="flex justify-between border-b border-muted py-1">
                          <span className="text-muted-foreground">{key}</span>
                          <span className="font-medium text-right max-w-[200px] truncate">
                            {displayValue}
                          </span>
                        </div>
                      );
                    })}
                    {selectedSession.form_data?.photos_count != null && (
                      <div className="flex justify-between border-b border-muted py-1">
                        <span className="text-muted-foreground">Fotos hochgeladen</span>
                        <span className="font-medium">
                          {String(selectedSession.form_data.photos_count)}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Timeline */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Zeitverlauf
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Erstellt</span>
                      <span>
                        {format(new Date(selectedSession.created_at), "dd.MM.yyyy HH:mm", {
                          locale: de,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Letzte Aktivität</span>
                      <span>
                        {formatDistanceToNow(new Date(selectedSession.last_activity_at), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </span>
                    </div>
                    {selectedSession.resume_email_sent_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">E-Mail gesendet</span>
                        <span>
                          {format(
                            new Date(selectedSession.resume_email_sent_at),
                            "dd.MM.yyyy HH:mm",
                            { locale: de }
                          )}
                        </span>
                      </div>
                    )}
                    {selectedSession.admin_called_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Angerufen</span>
                        <span>
                          {format(
                            new Date(selectedSession.admin_called_at),
                            "dd.MM.yyyy HH:mm",
                            { locale: de }
                          )}
                        </span>
                      </div>
                    )}
                    {selectedSession.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Abgeschlossen</span>
                        <span>
                          {format(new Date(selectedSession.completed_at), "dd.MM.yyyy HH:mm", {
                            locale: de,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Admin Notes */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Admin-Notizen
                  </h3>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Notizen zum Lead hinzufügen (z.B. Gesprächsnotizen, Vereinbarungen...)"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      updateAdminNotes.mutate({
                        sessionId: selectedSession.id,
                        notes: adminNotes,
                      })
                    }
                    disabled={updateAdminNotes.isPending}
                  >
                    {updateAdminNotes.isPending ? "Speichern..." : "Notiz speichern"}
                  </Button>
                </Card>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {selectedSession.customer_phone && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(`tel:${selectedSession.customer_phone}`);
                        markAsCalled.mutate(selectedSession.id);
                      }}
                    >
                      <PhoneCall className="w-4 h-4 mr-2 text-green-600" />
                      Anrufen & vermerken
                    </Button>
                  )}
                  {selectedSession.customer_email && selectedSession.status !== "completed" && (
                    <Button
                      variant="outline"
                      onClick={() => openEmailDialog(selectedSession)}
                    >
                      <Send className="w-4 h-4 mr-2 text-blue-600" />
                      Wiederaufnahme-E-Mail
                    </Button>
                  )}
                  {selectedSession.status === "in_progress" && (
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => markAsAbandoned.mutate(selectedSession.id)}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Als abgebrochen markieren
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Email Dialog */}
      {/* ================================================================== */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Wiederaufnahme-E-Mail senden
            </DialogTitle>
            <DialogDescription>
              {selectedSession?.customer_email
                ? `An: ${selectedSession.customer_email}`
                : "Keine E-Mail-Adresse vorhanden"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Die E-Mail enthält automatisch:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Fortschrittsanzeige des Wizards</li>
                <li>Zusammenfassung der bisherigen Eingaben</li>
                <li>Direkter Link zum Weitermachen</li>
                <li>Vorteile des Abschließens</li>
              </ul>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Persönliche Nachricht (optional)
              </label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="z.B. Wir haben gerade besonders hohe Nachfrage nach Ihrem Fahrzeugtyp..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wird als hervorgehobener Abschnitt in der E-Mail angezeigt.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                if (selectedSession) {
                  sendResumeMail.mutate({
                    sessionId: selectedSession.id,
                    message: customMessage || undefined,
                  });
                }
              }}
              disabled={sendResumeMail.isPending}
            >
              {sendResumeMail.isPending ? (
                "Wird gesendet..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  E-Mail senden
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
