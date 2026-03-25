import { useState, useMemo } from "react";
import { ConvertToMotorhomeDialog } from "@/components/admin/ConvertToMotorhomeDialog";
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Trash2,
  Loader2,
  Calculator,
  Euro,
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

interface ValuationLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  condition: string | null;
  body_type: string | null;
  message: string | null;
  source: string;
  estimated_value_min: number | null;
  estimated_value_max: number | null;
  algorithm_value_min: number | null;
  algorithm_value_max: number | null;
  brand_tier: string | null;
  admin_estimated_value: number | null;
  admin_notes: string | null;
  admin_valued_at: string | null;
  ai_estimated_value: number | null;
  ai_confidence: number | null;
  created_at: string | null;
  contacted_at: string | null;
  status: string | null;
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
// Human-readable field labels for form_data display
// ============================================================================

const FIELD_LABELS: Record<string, string> = {
  // Fahrzeugdetails
  manufacturer: "Hersteller",
  model: "Modell",
  year: "Baujahr",
  bodyType: "Aufbauart",
  mileage: "Kilometerstand",
  vehicleType: "Fahrzeugtyp",
  // Technik
  fuelType: "Kraftstoff",
  transmission: "Getriebe",
  enginePower: "Motorleistung (PS)",
  engine_displacement_ccm: "Hubraum (ccm)",
  driveTrain: "Antrieb",
  emissionClass: "Schadstoffklasse",
  // Abmessungen
  length_m: "Länge (cm)",
  width_m: "Breite (cm)",
  height_m: "Höhe (cm)",
  weight_kg: "Gewicht (kg)",
  payload_kg: "Zuladung (kg)",
  number_of_axles: "Anzahl Achsen",
  number_of_seats: "Sitzplätze",
  number_of_sleeping_places: "Schlafplätze",
  // Innenraum
  has_bathroom: "Badezimmer",
  has_kitchen: "Küche",
  has_shower: "Dusche",
  has_toilet: "Toilette",
  has_heating: "Heizung",
  has_air_conditioning: "Klimaanlage",
  has_solar_panel: "Solaranlage",
  refrigerator_type: "Kühlschranktyp",
  water_tank_liters: "Wassertank (L)",
  waste_water_tank_liters: "Abwassertank (L)",
  gas_system: "Gassystem",
  // Ausstattung
  has_awning: "Markise",
  has_bike_rack: "Fahrradträger",
  has_satellite_system: "Sat-Anlage",
  has_navigation: "Navigation",
  has_backup_camera: "Rückfahrkamera",
  has_cruise_control: "Tempomat",
  has_leveling_system: "Nivellierungssystem",
  has_alarm_system: "Alarmanlage",
  has_tow_bar: "Anhängerkupplung",
  has_garage: "Heckgarage",
  has_airbag: "Airbag",
  has_alarm: "Alarm",
  has_swivel_seats: "Drehsitze",
  has_esp: "ESP",
  main_tires: "Hauptreifen",
  second_tires: "Zweitreifen",
  // Zustand
  condition: "Zustand",
  no_known_defects: "Keine bekannten Mängel",
  known_defects: "Bekannte Mängel",
  previous_owners: "Vorbesitzer",
  accident_free: "Unfallfrei",
  first_registration: "Erstzulassung",
  tuev_valid_until: "TÜV gültig bis",
  vehicle_identification_number: "Fahrgestellnummer (VIN)",
  // Verkauf
  saleChannel: "Verkaufsweg",
  reservePrice: "Mindestpreis",
  desiredPrice: "Wunschpreis",
  description: "Beschreibung",
  // Kontakt
  customerName: "Name",
  customerEmail: "E-Mail",
  customerPhone: "Telefon",
  // Meta
  photos_count: "Fotos hochgeladen",
};

const SALE_CHANNEL_LABELS: Record<string, string> = {
  instant_price: "Sofortpreis",
  auction: "Händler-Auktion",
  station: "Ankaufstation",
};

const FIELD_GROUPS: { title: string; fields: string[] }[] = [
  {
    title: "Fahrzeug",
    fields: ["manufacturer", "model", "year", "bodyType", "vehicleType", "mileage"],
  },
  {
    title: "Technik",
    fields: ["fuelType", "transmission", "enginePower", "engine_displacement_ccm", "driveTrain", "emissionClass"],
  },
  {
    title: "Abmessungen",
    fields: ["length_m", "width_m", "height_m", "weight_kg", "payload_kg", "number_of_axles", "number_of_seats", "number_of_sleeping_places"],
  },
  {
    title: "Innenraum & Ausstattung",
    fields: [
      "has_bathroom", "has_kitchen", "has_shower", "has_toilet", "has_heating",
      "has_air_conditioning", "has_solar_panel", "refrigerator_type",
      "water_tank_liters", "waste_water_tank_liters", "gas_system",
      "has_awning", "has_bike_rack", "has_satellite_system", "has_navigation",
      "has_backup_camera", "has_cruise_control", "has_leveling_system",
      "has_alarm_system", "has_tow_bar", "has_garage", "has_airbag",
      "has_alarm", "has_swivel_seats", "has_esp", "main_tires", "second_tires",
    ],
  },
  {
    title: "Zustand",
    fields: ["condition", "no_known_defects", "known_defects", "previous_owners", "accident_free", "first_registration", "tuev_valid_until", "vehicle_identification_number"],
  },
  {
    title: "Verkauf",
    fields: ["saleChannel", "reservePrice", "desiredPrice", "description"],
  },
];

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (key === "saleChannel" && typeof value === "string") {
    return SALE_CHANNEL_LABELS[value] || value;
  }
  if (key === "mileage" && typeof value === "number") {
    return `${value.toLocaleString("de-DE")} km`;
  }
  if ((key === "reservePrice" || key === "desiredPrice") && typeof value === "number") {
    return `${value.toLocaleString("de-DE")} EUR`;
  }
  if ((key.endsWith("_liters") || key === "weight_kg" || key === "payload_kg") && typeof value === "number") {
    return value.toLocaleString("de-DE");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

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
    case "converted":
      return (
        <Badge className="bg-purple-500 hover:bg-purple-600">
          <Car className="w-3 h-3 mr-1" /> Konvertiert
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
  // Delete states
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [selectedValuationIds, setSelectedValuationIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "wizard" | "quick" | "valuation"; ids: string[] } | null>(null);
  // Valuation detail dialog
  const [valuationDetailOpen, setValuationDetailOpen] = useState(false);
  const [selectedValuation, setSelectedValuation] = useState<ValuationLead | null>(null);
  const [expertValue, setExpertValue] = useState("");
  const [expertNotes, setExpertNotes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ value: number; confidence: number; reasoning: string; trainingCount: number } | null>(null);
  // Convert to motorhome dialog
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertSession, setConvertSession] = useState<WizardSession | null>(null);
  const { toast } = useToast();

  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "leads",
    columns: [
      { key: "id", label: "ID" },
      { key: "customer_name", label: "Name" },
      { key: "customer_email", label: "E-Mail" },
      { key: "customer_phone", label: "Telefon" },
      { key: "vehicle_summary", label: "Fahrzeug" },
      {
        key: "status",
        label: "Status",
        format: (value: any) => {
          if (value === "in_progress") return "Aktiv";
          if (value === "completed") return "Abgeschlossen";
          if (value === "abandoned") return "Abgebrochen";
          return String(value || "");
        },
      },
      {
        key: "max_step_reached",
        label: "Fortschritt",
        format: (value: any, row: any) => {
          const max_step_reached = Number(row?.max_step_reached || 0);
          const total_steps = Number(row?.total_steps || 0);
          if (total_steps > 0) {
            return `${Math.round((max_step_reached / total_steps) * 100)}%`;
          }
          return "0%";
        },
      },
      {
        key: "last_activity_at",
        label: "Letzte Aktivität",
        format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "",
      },
      {
        key: "created_at",
        label: "Erstellt am",
        format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "",
      },
    ],
  });
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

  const { data: valuationLeads = [], isLoading: loadingValuationLeads } = useQuery({
    queryKey: ["adminValuationLeads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("value_assessment_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ValuationLead[];
    },
    refetchInterval: 30000,
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
      valuationLeadsTotal: valuationLeads.length,
    };
  }, [wizardSessions, quickLeads, valuationLeads]);

  // ---- Filtering ----

  // Enrich wizard sessions with contact data from quick_leads as fallback
  const enrichedSessions = useMemo(() => {
    return wizardSessions.map((session) => {
      if (session.customer_name && session.customer_email && session.customer_phone) {
        return session; // Already has all contact data
      }
      // Try to find matching quick_lead
      const matchingLead = quickLeads.find((lead) => {
        if (session.customer_email && lead.email) {
          return lead.email === session.customer_email;
        }
        if (lead.manufacturer && session.vehicle_summary) {
          const leadTime = new Date(lead.created_at).getTime();
          const sessionTime = new Date(session.created_at).getTime();
          const timeDiff = Math.abs(leadTime - sessionTime);
          return (
            session.vehicle_summary.includes(lead.manufacturer) &&
            timeDiff < 5 * 60 * 1000
          );
        }
        return false;
      });
      if (matchingLead) {
        return {
          ...session,
          customer_name: session.customer_name || matchingLead.name,
          customer_email: session.customer_email || matchingLead.email,
          customer_phone: session.customer_phone || matchingLead.phone,
        };
      }
      return session;
    });
  }, [wizardSessions, quickLeads]);

  const filteredSessions = useMemo(() => {
    return enrichedSessions.filter((session) => {
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
  }, [enrichedSessions, statusFilter, searchQuery]);

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

  const filteredValuationLeads = useMemo(() => {
    if (!searchQuery) return valuationLeads;
    const q = searchQuery.toLowerCase();
    return valuationLeads.filter(
      (lead) =>
        (lead.name || "").toLowerCase().includes(q) ||
        (lead.email || "").toLowerCase().includes(q) ||
        (lead.phone || "").toLowerCase().includes(q) ||
        (lead.manufacturer || "").toLowerCase().includes(q) ||
        (lead.model || "").toLowerCase().includes(q)
    );
  }, [valuationLeads, searchQuery]);

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

  // ---- Delete Mutations ----

  const deleteWizardSessions = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("wizard_sessions")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast({
        title: `${ids.length} Session${ids.length > 1 ? "s" : ""} gelöscht`,
        description: "Die ausgewählten Wizard-Sessions wurden entfernt.",
      });
      setSelectedSessionIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Löschen", description: error.message, variant: "destructive" });
    },
  });

  const deleteQuickLeads = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("quick_leads")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast({
        title: `${ids.length} Lead${ids.length > 1 ? "s" : ""} gelöscht`,
        description: "Die ausgewählten Quick-Leads wurden entfernt.",
      });
      setSelectedLeadIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["adminQuickLeads"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Löschen", description: error.message, variant: "destructive" });
    },
  });

  const deleteValuationLeads = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("value_assessment_leads")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast({
        title: `${ids.length} Lead${ids.length > 1 ? "s" : ""} gelöscht`,
        description: "Die ausgewählten Wertrechner-Leads wurden entfernt.",
      });
      setSelectedValuationIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Löschen", description: error.message, variant: "destructive" });
    },
  });

  const markValuationContacted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("value_assessment_leads")
        .update({ contacted_at: new Date().toISOString(), status: "contacted" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Als kontaktiert markiert" });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
    },
  });

  const saveExpertValue = useMutation({
    mutationFn: async ({ id, value, notes }: { id: string; value: number; notes: string }) => {
      const { error } = await supabase
        .from("value_assessment_leads")
        .update({
          admin_estimated_value: value,
          admin_notes: notes || null,
          admin_valued_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Expertenwert gespeichert", description: "Der Wert wird f\u00fcr das KI-Training verwendet." });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
      setValuationDetailOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Speichern", description: error.message, variant: "destructive" });
    },
  });

  const requestAiValuation = async (lead: ValuationLead) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-valuation", {
        body: {
          manufacturer: lead.manufacturer || undefined,
          model: lead.model || undefined,
          bodyType: lead.body_type || "kastenwagen",
          year: lead.year || 2020,
          mileage: lead.mileage || 0,
          condition: lead.condition || "good",
          algorithmMin: lead.algorithm_value_min || lead.estimated_value_min || 0,
          algorithmMax: lead.algorithm_value_max || lead.estimated_value_max || 0,
        },
      });
      if (error) throw error;
      if (data?.hasAiEstimate) {
        setAiResult({
          value: data.aiEstimatedValue,
          confidence: data.aiConfidence,
          reasoning: data.aiReasoning,
          trainingCount: data.trainingCount,
        });
        // Save AI result to DB
        await supabase
          .from("value_assessment_leads")
          .update({
            ai_estimated_value: data.aiEstimatedValue,
            ai_confidence: data.aiConfidence,
          } as any)
          .eq("id", lead.id);
      } else {
        toast({
          title: "KI-Sch\u00e4tzung nicht m\u00f6glich",
          description: data?.message || "Noch nicht gen\u00fcgend Trainingsdaten vorhanden.",
        });
      }
    } catch (err: any) {
      toast({ title: "KI-Fehler", description: err.message || "KI-Bewertung fehlgeschlagen", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const openValuationDetail = (lead: ValuationLead) => {
    setSelectedValuation(lead);
    setExpertValue(lead.admin_estimated_value ? String(lead.admin_estimated_value) : "");
    setExpertNotes(lead.admin_notes || "");
    setAiResult(lead.ai_estimated_value ? {
      value: lead.ai_estimated_value,
      confidence: lead.ai_confidence || 0,
      reasoning: "",
      trainingCount: 0,
    } : null);
    setValuationDetailOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "wizard") {
      deleteWizardSessions.mutate(deleteTarget.ids);
    } else if (deleteTarget.type === "quick") {
      deleteQuickLeads.mutate(deleteTarget.ids);
    } else {
      deleteValuationLeads.mutate(deleteTarget.ids);
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const openDeleteDialog = (type: "wizard" | "quick" | "valuation", ids: string[]) => {
    setDeleteTarget({ type, ids });
    setDeleteDialogOpen(true);
  };

  const toggleSessionSelection = (id: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSessions = () => {
    if (selectedSessionIds.size === filteredSessions.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(filteredSessions.map((s) => s.id)));
    }
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllLeads = () => {
    if (selectedLeadIds.size === filteredQuickLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredQuickLeads.map((l) => l.id)));
    }
  };

  const toggleValuationSelection = (id: string) => {
    setSelectedValuationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllValuationLeads = () => {
    if (selectedValuationIds.size === filteredValuationLeads.length) {
      setSelectedValuationIds(new Set());
    } else {
      setSelectedValuationIds(new Set(filteredValuationLeads.map((l) => l.id)));
    }
  };

  const isDeleting = deleteWizardSessions.isPending || deleteQuickLeads.isPending || deleteValuationLeads.isPending;

  // ---- Handlers ----

  const openDetail = (session: WizardSession) => {
    // If session has no contact data, try to find matching quick_lead by vehicle/timing
    let enrichedSession = { ...session };
    if (!session.customer_name || !session.customer_email || !session.customer_phone) {
      // Find matching quick_lead by email, or by vehicle + close timestamp
      const matchingLead = quickLeads.find((lead) => {
        // Match by email if available
        if (session.customer_email && lead.email) {
          return lead.email === session.customer_email;
        }
        // Match by vehicle info and close creation time (within 5 minutes)
        if (lead.manufacturer && session.vehicle_summary) {
          const leadTime = new Date(lead.created_at).getTime();
          const sessionTime = new Date(session.created_at).getTime();
          const timeDiff = Math.abs(leadTime - sessionTime);
          return (
            session.vehicle_summary.includes(lead.manufacturer) &&
            timeDiff < 5 * 60 * 1000
          );
        }
        return false;
      });

      if (matchingLead) {
        enrichedSession = {
          ...session,
          customer_name: session.customer_name || matchingLead.name,
          customer_email: session.customer_email || matchingLead.email,
          customer_phone: session.customer_phone || matchingLead.phone,
        };
      }
    }
    setSelectedSession(enrichedSession);
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
            queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
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
          description={`${stats.quickLeadsTotal} Quick-Leads, ${stats.valuationLeadsTotal} Wertrechner`}
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
            <TabsTrigger value="valuation_leads" className="gap-2">
              <Calculator className="w-4 h-4" />
              Wertrechner ({valuationLeads.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <ExportButton
              onExportCSV={() => exportCSV(filteredSessions || [])}
              onExportExcel={() => exportExcel(filteredSessions || [])}
              isExporting={isExporting}
            />
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
          {/* Bulk actions bar */}
          {selectedSessionIds.size > 0 && (
            <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-3 animate-fade-in">
              <span className="text-sm font-medium">
                {selectedSessionIds.size} Session{selectedSessionIds.size > 1 ? "s" : ""} ausgewählt
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSessionIds(new Set())}
                >
                  Auswahl aufheben
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openDeleteDialog("wizard", Array.from(selectedSessionIds))}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {selectedSessionIds.size} löschen
                </Button>
              </div>
            </div>
          )}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredSessions.length > 0 && selectedSessionIds.size === filteredSessions.length}
                      onCheckedChange={toggleAllSessions}
                      aria-label="Alle auswählen"
                    />
                  </TableHead>
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
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Lade Sessions...
                    </TableCell>
                  </TableRow>
                ) : filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Keine Sessions gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => (
                    <TableRow
                      key={session.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedSessionIds.has(session.id) ? "bg-primary/5" : ""}`}
                      onClick={() => openDetail(session)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedSessionIds.has(session.id)}
                          onCheckedChange={() => toggleSessionSelection(session.id)}
                          aria-label="Session auswählen"
                        />
                      </TableCell>
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
                          {session.status !== "converted" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setConvertSession(session);
                                setConvertDialogOpen(true);
                              }}
                              title="Als Wohnmobil anlegen"
                            >
                              <Car className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {session.status === "converted" && session.customer_email && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase.functions.invoke(
                                    "send-registration-invite",
                                    {
                                      body: {
                                        email: session.customer_email,
                                        customerName: session.customer_name || undefined,
                                        sessionId: session.id,
                                      },
                                    }
                                  );
                                  if (error) throw error;
                                  if (data?.error) throw new Error(data.error);
                                  toast({
                                    title: "Registrierungslink gesendet!",
                                    description: `E-Mail an ${session.customer_email} gesendet.`,
                                  });
                                } catch (err: any) {
                                  toast({
                                    title: "Fehler",
                                    description: err.message || "Konnte nicht gesendet werden",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              title="Registrierungslink senden"
                            >
                              <Mail className="w-4 h-4 text-purple-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog("wizard", [session.id])}
                            title="Session löschen"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
          {/* Bulk actions bar */}
          {selectedLeadIds.size > 0 && (
            <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-3 animate-fade-in">
              <span className="text-sm font-medium">
                {selectedLeadIds.size} Lead{selectedLeadIds.size > 1 ? "s" : ""} ausgewählt
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLeadIds(new Set())}
                >
                  Auswahl aufheben
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openDeleteDialog("quick", Array.from(selectedLeadIds))}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {selectedLeadIds.size} löschen
                </Button>
              </div>
            </div>
          )}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredQuickLeads.length > 0 && selectedLeadIds.size === filteredQuickLeads.length}
                      onCheckedChange={toggleAllLeads}
                      aria-label="Alle auswählen"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Wizard</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLeads ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Lade Leads...
                    </TableCell>
                  </TableRow>
                ) : filteredQuickLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Keine Leads gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuickLeads.map((lead) => (
                    <TableRow key={lead.id} className={selectedLeadIds.has(lead.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeadIds.has(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                          aria-label="Lead auswählen"
                        />
                      </TableCell>
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
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog("quick", [lead.id])}
                          title="Lead löschen"
                          className="hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Wertrechner / Wertermittlung Leads Tab */}
        <TabsContent value="valuation_leads">
          {/* Bulk actions bar */}
          {selectedValuationIds.size > 0 && (
            <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-3 animate-fade-in">
              <span className="text-sm font-medium">
                {selectedValuationIds.size} Lead{selectedValuationIds.size > 1 ? "s" : ""} ausgewählt
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedValuationIds(new Set())}
                >
                  Auswahl aufheben
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openDeleteDialog("valuation", Array.from(selectedValuationIds))}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {selectedValuationIds.size} löschen
                </Button>
              </div>
            </div>
          )}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredValuationLeads.length > 0 && selectedValuationIds.size === filteredValuationLeads.length}
                      onCheckedChange={toggleAllValuationLeads}
                      aria-label="Alle auswählen"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Geschätzter Wert</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="w-24">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingValuationLeads ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Lade Wertrechner-Leads...
                    </TableCell>
                  </TableRow>
                ) : filteredValuationLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Keine Wertrechner-Leads gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredValuationLeads.map((lead) => (
                    <TableRow key={lead.id} className={selectedValuationIds.has(lead.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedValuationIds.has(lead.id)}
                          onCheckedChange={() => toggleValuationSelection(lead.id)}
                          aria-label="Lead auswählen"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {lead.email && (
                            <p className="text-xs flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <a href={`mailto:${lead.email}`} className="hover:underline text-primary">{lead.email}</a>
                            </p>
                          )}
                          {lead.phone && (
                            <p className="text-xs flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <a href={`tel:${lead.phone}`} className="hover:underline text-primary">{lead.phone}</a>
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">
                            {[lead.manufacturer, lead.model].filter(Boolean).join(" ") || "-"}
                          </span>
                          {(lead.year || lead.body_type) && (
                            <p className="text-xs text-muted-foreground">
                              {[lead.body_type, lead.year ? `BJ ${lead.year}` : null, lead.mileage ? `${lead.mileage.toLocaleString("de-DE")} km` : null].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {lead.condition && (
                            <p className="text-xs text-muted-foreground">Zustand: {lead.condition}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {lead.estimated_value_min != null && lead.estimated_value_max != null ? (
                            <div className="flex items-center gap-1">
                              <Euro className="w-3 h-3 text-green-600" />
                              <span className="text-sm font-medium text-green-700">
                                {lead.estimated_value_min.toLocaleString("de-DE")} – {lead.estimated_value_max.toLocaleString("de-DE")} €
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Experten-Bewertung</span>
                          )}
                          {lead.admin_estimated_value && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Experte: {lead.admin_estimated_value.toLocaleString("de-DE")} €
                            </Badge>
                          )}
                          {lead.ai_estimated_value && !lead.admin_estimated_value && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              KI: {lead.ai_estimated_value.toLocaleString("de-DE")} €
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {lead.source === "wertrechner" ? "Wertrechner" : lead.source === "wertermittlung" ? "Wertermittlung" : lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.contacted_at ? (
                          <Badge className="bg-green-500 text-xs">Kontaktiert</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-500">Offen</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {lead.created_at ? format(new Date(lead.created_at), "dd.MM.yyyy HH:mm", { locale: de }) : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openValuationDetail(lead)}
                            title="Bewerten & Details"
                          >
                            <Eye className="w-4 h-4 text-primary" />
                          </Button>
                          {lead.phone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                window.open(`tel:${lead.phone}`);
                                markValuationContacted.mutate(lead.id);
                              }}
                              title="Anrufen & als kontaktiert markieren"
                            >
                              <PhoneCall className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {!lead.contacted_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markValuationContacted.mutate(lead.id)}
                              title="Als kontaktiert markieren"
                            >
                              <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog("valuation", [lead.id])}
                            title="Lead l\u00f6schen"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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

                {/* Form Data Preview - Grouped with readable labels */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Eingegebene Daten
                  </h3>
                  {selectedSession.form_data && Object.keys(selectedSession.form_data).length > 0 ? (
                    <div className="space-y-4">
                      {FIELD_GROUPS.map((group) => {
                        const groupEntries = group.fields.filter((field) => {
                          const val = (selectedSession.form_data as Record<string, unknown>)?.[field];
                          return val !== null && val !== undefined && val !== "" && field !== "photos";
                        });
                        if (groupEntries.length === 0) return null;
                        return (
                          <div key={group.title}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">
                              {group.title}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              {groupEntries.map((field) => {
                                const val = (selectedSession.form_data as Record<string, unknown>)[field];
                                return (
                                  <div key={field} className="flex justify-between py-0.5">
                                    <span className="text-muted-foreground">
                                      {FIELD_LABELS[field] || field}
                                    </span>
                                    <span className="font-medium text-right max-w-[180px] truncate">
                                      {formatFieldValue(field, val)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {/* Show any remaining fields not in groups */}
                      {(() => {
                        const allGroupedFields = FIELD_GROUPS.flatMap((g) => g.fields);
                        const ungrouped = Object.entries(selectedSession.form_data || {}).filter(
                          ([key, val]) =>
                            !allGroupedFields.includes(key) &&
                            val !== null &&
                            val !== undefined &&
                            val !== "" &&
                            key !== "photos" &&
                            key !== "photos_count" &&
                            key !== "customerName" &&
                            key !== "customerEmail" &&
                            key !== "customerPhone"
                        );
                        if (ungrouped.length === 0) return null;
                        return (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">
                              Sonstige
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              {ungrouped.map(([key, val]) => (
                                <div key={key} className="flex justify-between py-0.5">
                                  <span className="text-muted-foreground">
                                    {FIELD_LABELS[key] || key}
                                  </span>
                                  <span className="font-medium text-right max-w-[180px] truncate">
                                    {formatFieldValue(key, val)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      {/* Photo count */}
                      {selectedSession.form_data?.photos_count != null && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Fotos hochgeladen:</span>
                          <Badge variant="outline">
                            {String(selectedSession.form_data.photos_count)} Fotos
                          </Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Noch keine Daten eingegeben</p>
                  )}
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
                  {selectedSession.status !== "converted" && (
                    <Button
                      className="gradient-hero hover:gradient-hero-hover"
                      onClick={() => {
                        setConvertSession(selectedSession);
                        setConvertDialogOpen(true);
                        setDetailDialogOpen(false);
                      }}
                    >
                      <Car className="w-4 h-4 mr-2" />
                      Als Wohnmobil anlegen
                    </Button>
                  )}
                  {selectedSession.status === "converted" && (
                    <>
                      <Badge variant="outline" className="text-purple-600 border-purple-300 py-1.5 px-3">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Bereits als Wohnmobil angelegt
                      </Badge>
                      {selectedSession.customer_email && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.functions.invoke(
                                "send-registration-invite",
                                {
                                  body: {
                                    email: selectedSession.customer_email,
                                    customerName: selectedSession.customer_name || undefined,
                                    sessionId: selectedSession.id,
                                  },
                                }
                              );
                              if (error) throw error;
                              if (data?.error) throw new Error(data.error);
                              toast({
                                title: "Registrierungslink gesendet!",
                                description: `E-Mail an ${selectedSession.customer_email} gesendet.`,
                              });
                            } catch (err: any) {
                              toast({
                                title: "Fehler",
                                description: err.message || "Konnte nicht gesendet werden",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Registrierungslink senden
                        </Button>
                      )}
                    </>
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

      {/* ================================================================== */}
      {/* Valuation Detail Dialog – Expertenwert & KI */}
      {/* ================================================================== */}
      <Dialog open={valuationDetailOpen} onOpenChange={setValuationDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedValuation && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Wertrechner-Lead bewerten
                </DialogTitle>
                <DialogDescription>
                  {[selectedValuation.manufacturer, selectedValuation.model].filter(Boolean).join(" ") || "Unbekanntes Fahrzeug"}
                  {selectedValuation.year ? ` (${selectedValuation.year})` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Kontaktdaten */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4" /> Kontaktdaten
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedValuation.name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">E-Mail</p>
                      {selectedValuation.email ? (
                        <a href={`mailto:${selectedValuation.email}`} className="font-medium text-primary hover:underline text-xs">{selectedValuation.email}</a>
                      ) : <p className="text-muted-foreground">-</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefon</p>
                      {selectedValuation.phone ? (
                        <a href={`tel:${selectedValuation.phone}`} className="font-medium text-primary hover:underline">{selectedValuation.phone}</a>
                      ) : <p className="text-muted-foreground">-</p>}
                    </div>
                  </div>
                </Card>

                {/* Fahrzeugdaten */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                    <Car className="w-4 h-4" /> Fahrzeugdaten
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Hersteller</span><span className="font-medium">{selectedValuation.manufacturer || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Modell</span><span className="font-medium">{selectedValuation.model || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Baujahr</span><span className="font-medium">{selectedValuation.year || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Aufbautyp</span><span className="font-medium">{selectedValuation.body_type || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Kilometerstand</span><span className="font-medium">{selectedValuation.mileage ? `${selectedValuation.mileage.toLocaleString("de-DE")} km` : "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Zustand</span><span className="font-medium">{selectedValuation.condition || "-"}</span></div>
                    {selectedValuation.brand_tier && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Preisklasse</span><Badge variant="outline" className="text-xs">{selectedValuation.brand_tier}</Badge></div>
                    )}
                  </div>
                  {selectedValuation.message && (
                    <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Nachricht des Kunden:</p>
                      <p className="italic">{selectedValuation.message}</p>
                    </div>
                  )}
                </Card>

                {/* Wertvergleich: Algorithmus / KI / Experte */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4" /> Wertvergleich
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Algorithmus-Wert */}
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                      <p className="text-xs text-blue-600 font-medium mb-1">Algorithmus</p>
                      {(selectedValuation.algorithm_value_min || selectedValuation.estimated_value_min) ? (
                        <>
                          <p className="text-lg font-bold text-blue-700">
                            {Math.round(((selectedValuation.algorithm_value_min || selectedValuation.estimated_value_min || 0) + (selectedValuation.algorithm_value_max || selectedValuation.estimated_value_max || 0)) / 2).toLocaleString("de-DE")} \u20ac
                          </p>
                          <p className="text-xs text-blue-500">
                            {(selectedValuation.algorithm_value_min || selectedValuation.estimated_value_min || 0).toLocaleString("de-DE")} \u2013 {(selectedValuation.algorithm_value_max || selectedValuation.estimated_value_max || 0).toLocaleString("de-DE")} \u20ac
                          </p>
                        </>
                      ) : <p className="text-sm text-muted-foreground">-</p>}
                    </div>

                    {/* KI-Wert */}
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
                      <p className="text-xs text-purple-600 font-medium mb-1">KI-Sch\u00e4tzung</p>
                      {aiResult ? (
                        <>
                          <p className="text-lg font-bold text-purple-700">{aiResult.value.toLocaleString("de-DE")} \u20ac</p>
                          <p className="text-xs text-purple-500">Konfidenz: {aiResult.confidence}%</p>
                          {aiResult.reasoning && <p className="text-xs text-purple-400 mt-1 italic">{aiResult.reasoning}</p>}
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => requestAiValuation(selectedValuation)}
                          disabled={aiLoading}
                          className="mt-1 text-xs"
                        >
                          {aiLoading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Berechne...</> : "KI-Wert anfordern"}
                        </Button>
                      )}
                    </div>

                    {/* Experten-Wert */}
                    <div className={`p-3 rounded-lg text-center ${selectedValuation.admin_estimated_value ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
                      <p className={`text-xs font-medium mb-1 ${selectedValuation.admin_estimated_value ? "text-green-600" : "text-gray-500"}`}>Expertenwert</p>
                      {selectedValuation.admin_estimated_value ? (
                        <>
                          <p className="text-lg font-bold text-green-700">{selectedValuation.admin_estimated_value.toLocaleString("de-DE")} \u20ac</p>
                          {selectedValuation.admin_valued_at && (
                            <p className="text-xs text-green-500">{format(new Date(selectedValuation.admin_valued_at), "dd.MM.yyyy", { locale: de })}</p>
                          )}
                        </>
                      ) : <p className="text-sm text-muted-foreground">Noch nicht bewertet</p>}
                    </div>
                  </div>
                </Card>

                {/* Expertenwert eingeben */}
                <Card className="p-4 border-2 border-primary/20">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                    <Euro className="w-4 h-4 text-primary" /> Deinen Expertenwert eintragen
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Gesch\u00e4tzter Marktwert (\u20ac)</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={expertValue}
                          onChange={(e) => setExpertValue(e.target.value)}
                          placeholder="z.B. 45000"
                          className="text-lg font-bold"
                        />
                        <span className="text-lg font-bold text-muted-foreground">\u20ac</span>
                      </div>
                      {aiResult && expertValue && (
                        <p className="text-xs mt-1 text-muted-foreground">
                          Abweichung zur KI: {expertValue ? `${((Number(expertValue) - aiResult.value) / aiResult.value * 100).toFixed(1)}%` : "-"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Notizen / Begr\u00fcndung</label>
                      <Textarea
                        value={expertNotes}
                        onChange={(e) => setExpertNotes(e.target.value)}
                        placeholder="z.B. Marke hat hohen Wiederverkaufswert, guter Zustand f\u00fcr das Alter..."
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Deine Bewertungen trainieren die KI \u2013 je mehr Werte du eintr\u00e4gst, desto besser wird die KI-Sch\u00e4tzung.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setValuationDetailOpen(false)}>
                  Abbrechen
                </Button>
                {selectedValuation.phone && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(`tel:${selectedValuation.phone}`);
                      markValuationContacted.mutate(selectedValuation.id);
                    }}
                  >
                    <PhoneCall className="w-4 h-4 mr-2" /> Anrufen
                  </Button>
                )}
                <Button
                  onClick={() => {
                    const val = Number(expertValue);
                    if (!val || val <= 0) {
                      toast({ title: "Bitte einen g\u00fcltigen Wert eingeben", variant: "destructive" });
                      return;
                    }
                    saveExpertValue.mutate({ id: selectedValuation.id, value: val, notes: expertNotes });
                  }}
                  disabled={saveExpertValue.isPending || !expertValue}
                >
                  {saveExpertValue.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Speichern...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Expertenwert speichern</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Delete Confirmation Dialog */}
      {/* ================================================================== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {deleteTarget?.ids.length === 1 ? "Eintrag löschen" : `${deleteTarget?.ids.length} Einträge löschen`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "wizard" ? (
                deleteTarget.ids.length === 1
                  ? "Möchten Sie diese Wizard-Session wirklich löschen? Alle zugehörigen Daten (Formulardaten, Fortschritt, Notizen) werden unwiderruflich entfernt."
                  : `Möchten Sie wirklich ${deleteTarget.ids.length} Wizard-Sessions löschen? Alle zugehörigen Daten werden unwiderruflich entfernt.`
              ) : deleteTarget?.type === "valuation" ? (
                deleteTarget.ids.length === 1
                  ? "Möchten Sie diesen Wertrechner-Lead wirklich löschen? Die Kontaktdaten und Bewertung werden unwiderruflich entfernt."
                  : `Möchten Sie wirklich ${deleteTarget.ids.length} Wertrechner-Leads löschen? Alle Kontaktdaten werden unwiderruflich entfernt.`
              ) : (
                deleteTarget?.ids.length === 1
                  ? "Möchten Sie diesen Quick-Lead wirklich löschen? Die Kontaktdaten werden unwiderruflich entfernt."
                  : `Möchten Sie wirklich ${deleteTarget?.ids.length} Quick-Leads löschen? Alle Kontaktdaten werden unwiderruflich entfernt.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Löschen...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Endgültig löschen
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================================================================== */}
      {/* Convert to Motorhome Dialog */}
      {/* ================================================================== */}
      <ConvertToMotorhomeDialog
        session={convertSession}
        open={convertDialogOpen}
        onOpenChange={(open) => {
          setConvertDialogOpen(open);
          if (!open) setConvertSession(null);
        }}
      />
    </div>
  );
}
