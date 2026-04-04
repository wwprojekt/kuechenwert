import { useState, useMemo } from "react";
import { ConvertToMotorhomeDialog } from "@/components/admin/ConvertToMotorhomeDialog";
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
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
  FileText,
  Globe,
  PhoneOff,
  PhoneMissed,
  Undo2,
  Pencil,
  Save,
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
  disposition: string | null;
  wrong_number_email_count: number | null;
  wrong_number_email_last_sent: string | null;
  admin_estimated_value: number | null;
  is_viewed: boolean;
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
  wizard_completed: boolean | null;
  created_at: string;
  updated_at: string | null;
  // Extended fields
  admin_notes: string | null;
  notes: string | null;
  status: string | null;
  contacted_at: string | null;
  lead_quality: string | null;
  form_data_snapshot: Record<string, unknown> | null;
  last_wizard_step: number | null;
  max_wizard_step: number | null;
  page_url: string | null;
  referrer: string | null;
  user_agent: string | null;
  disposition: string | null;
  wrong_number_email_count: number | null;
  wrong_number_email_last_sent: string | null;
  admin_estimated_value: number | null;
  is_viewed: boolean;
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
  vehicle_type: string | null;
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
  disposition: string | null;
  wrong_number_email_count: number | null;
  wrong_number_email_last_sent: string | null;
  is_viewed: boolean;
}

// ============================================================================
// Disposition Item Type
// ============================================================================

type DispositionItem = {
  id: string;
  type: "wizard" | "quick" | "valuation";
  name: string | null;
  email: string | null;
  phone: string | null;
  vehicle: string;
  disposition: string | null;
  created_at: string | null;
  source_label: string;
  wrong_number_email_count: number;
  admin_estimated_value: number | null;
};

// ============================================================================
// Step Names
// ============================================================================

const STEP_NAMES: Record<number, string> = {
  1: "Fahrzeugtyp",
  2: "Fahrzeugdaten",
  3: "Details & Technik",
  4: "Ausstattung",
  5: "Kontakt",
  6: "Fotos",
  7: "Verkaufsweg",
  8: "Standort & Konto",
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
  body_type: "Aufbauart",
  mileage: "Kilometerstand",
  vehicleType: "Fahrzeugtyp",
  vehicle_type: "Fahrzeugtyp",
  // Technik
  fuelType: "Kraftstoff",
  fuel_type: "Kraftstoff",
  transmission: "Getriebe",
  enginePower: "Motorleistung (PS)",
  engine_power_hp: "Motorleistung (PS)",
  engine_displacement_ccm: "Hubraum (ccm)",
  driveTrain: "Antrieb",
  emissionClass: "Schadstoffklasse",
  emission_class: "Schadstoffklasse",
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
  sale_channel: "Verkaufsweg",
  reservePrice: "Mindestpreis",
  reserve_price: "Mindestpreis",
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
    fields: ["manufacturer", "model", "year", "bodyType", "body_type", "vehicleType", "mileage"],
  },
  {
    title: "Technik",
    fields: ["fuelType", "fuel_type", "transmission", "enginePower", "engine_power_hp", "engine_displacement_ccm", "driveTrain", "emissionClass", "emission_class"],
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
    fields: ["saleChannel", "sale_channel", "reservePrice", "reserve_price", "desiredPrice", "description"],
  },
];

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if ((key === "saleChannel" || key === "sale_channel") && typeof value === "string") {
    return SALE_CHANNEL_LABELS[value] || value;
  }
  if (key === "mileage" && typeof value === "number") {
    return `${value.toLocaleString("de-DE")} km`;
  }
  if ((key === "reservePrice" || key === "desiredPrice" || key === "reserve_price") && typeof value === "number") {
    return `${value.toLocaleString("de-DE")} EUR`;
  }
  if ((key.endsWith("_liters") || key === "weight_kg" || key === "payload_kg") && typeof value === "number") {
    return value.toLocaleString("de-DE");
  }
  if ((key === "tuev_valid_until" || key === "tuv_valid_until") && typeof value === "string") {
    try {
      const d = new Date(value);
      return d.toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" });
    } catch { return String(value); }
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
// Disposition Constants & Helpers
// ============================================================================

const DISPOSITION_LABELS: Record<string, string> = {
  wrong_number: "Falsche Nummer",
  no_answer: "Nicht rangegangen",
  considering: "Überlegt sich das",
  done: "Erledigt",
};

const DISPOSITION_COLORS: Record<string, string> = {
  wrong_number: "bg-red-100 text-red-700 border-red-200",
  no_answer: "bg-amber-100 text-amber-700 border-amber-200",
  considering: "bg-blue-100 text-blue-700 border-blue-200",
  done: "bg-green-100 text-green-700 border-green-200",
};

const DISPOSITION_ICONS: Record<string, React.ElementType> = {
  wrong_number: PhoneOff,
  no_answer: PhoneMissed,
  considering: Clock,
  done: CheckCircle2,
};

function DispositionBadge({ disposition }: { disposition: string | null }) {
  if (!disposition || !DISPOSITION_LABELS[disposition]) return null;
  const Icon = DISPOSITION_ICONS[disposition];
  return (
    <Badge variant="outline" className={`${DISPOSITION_COLORS[disposition]} text-xs`}>
      {Icon && <Icon className="w-3 h-3 mr-1" />}
      {DISPOSITION_LABELS[disposition]}
    </Badge>
  );
}

interface DispositionButtonsProps {
  currentDisposition: string | null;
  onSetDisposition: (disposition: string | null) => void;
  isPending: boolean;
}

function DispositionButtons({ currentDisposition, onSetDisposition, isPending }: DispositionButtonsProps) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <PhoneOff className="w-4 h-4" /> Disposition / Anrufergebnis
      </h3>
      {currentDisposition && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">Aktuell:</span>
          <DispositionBadge disposition={currentDisposition} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetDisposition(null)}
            disabled={isPending}
            className="text-xs h-7"
          >
            <Undo2 className="w-3 h-3 mr-1" /> Zurücksetzen
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={currentDisposition === "wrong_number" ? "default" : "outline"}
          size="sm"
          onClick={() => onSetDisposition("wrong_number")}
          disabled={isPending || currentDisposition === "wrong_number"}
          className={currentDisposition === "wrong_number" ? "bg-red-600 hover:bg-red-700" : "text-red-600 border-red-200 hover:bg-red-50"}
        >
          <PhoneOff className="w-4 h-4 mr-1" /> Falsche Nummer
        </Button>
        <Button
          variant={currentDisposition === "no_answer" ? "default" : "outline"}
          size="sm"
          onClick={() => onSetDisposition("no_answer")}
          disabled={isPending || currentDisposition === "no_answer"}
          className={currentDisposition === "no_answer" ? "bg-amber-600 hover:bg-amber-700" : "text-amber-600 border-amber-200 hover:bg-amber-50"}
        >
          <PhoneMissed className="w-4 h-4 mr-1" /> Nicht rangegangen
        </Button>
        <Button
          variant={currentDisposition === "considering" ? "default" : "outline"}
          size="sm"
          onClick={() => onSetDisposition("considering")}
          disabled={isPending || currentDisposition === "considering"}
          className={currentDisposition === "considering" ? "bg-blue-600 hover:bg-blue-700" : "text-blue-600 border-blue-200 hover:bg-blue-50"}
        >
          <Clock className="w-4 h-4 mr-1" /> Überlegt sich das
        </Button>
        <Button
          variant={currentDisposition === "done" ? "default" : "outline"}
          size="sm"
          onClick={() => onSetDisposition("done")}
          disabled={isPending || currentDisposition === "done"}
          className={currentDisposition === "done" ? "bg-green-600 hover:bg-green-700" : "text-green-600 border-green-200 hover:bg-green-50"}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" /> Erledigt
        </Button>
      </div>
    </Card>
  );
}

function QuickLeadStatusBadge({ status, leadQuality, contactedAt }: { status: string | null; leadQuality: string | null; contactedAt: string | null }) {
  if (status === "converted" || leadQuality === "converted") {
    return (
      <Badge className="bg-purple-500 hover:bg-purple-600">
        <Car className="w-3 h-3 mr-1" /> Konvertiert
      </Badge>
    );
  }
  if (contactedAt) {
    return (
      <Badge className="bg-green-500 hover:bg-green-600">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Kontaktiert
      </Badge>
    );
  }
  if (leadQuality === "hot") {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-600">
        <TrendingUp className="w-3 h-3 mr-1" /> Hot
      </Badge>
    );
  }
  if (leadQuality === "warm") {
    return (
      <Badge className="bg-yellow-500 hover:bg-yellow-600">
        <Target className="w-3 h-3 mr-1" /> Warm
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-orange-500">
      Offen
    </Badge>
  );
}

/**
 * Helper to map a QuickLead to a WizardSessionData shape for the ConvertToMotorhomeDialog.
 */
function quickLeadToSessionData(lead: QuickLead): {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  form_data: Record<string, unknown>;
  status: string;
} {
  // Merge direct fields + form_data_snapshot
  const formData: Record<string, unknown> = {
    ...(lead.form_data_snapshot || {}),
    manufacturer: lead.manufacturer || (lead.form_data_snapshot?.manufacturer as string) || "",
    model: lead.model || (lead.form_data_snapshot?.model as string) || "",
    bodyType: lead.body_type || (lead.form_data_snapshot?.bodyType as string) || "",
    saleChannel: lead.sale_channel || (lead.form_data_snapshot?.saleChannel as string) || "auction",
  };
  return {
    id: lead.id,
    user_id: null,
    customer_name: lead.name,
    customer_email: lead.email,
    customer_phone: lead.phone,
    form_data: formData,
    status: lead.status || "new",
  };
}

/**
 * Helper to map a ValuationLead to a WizardSessionData shape for the ConvertToMotorhomeDialog.
 */
function valuationLeadToSessionData(lead: ValuationLead): {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  form_data: Record<string, unknown>;
  status: string;
} {
  return {
    id: lead.id,
    user_id: null,
    customer_name: lead.name,
    customer_email: lead.email,
    customer_phone: lead.phone,
    form_data: {
      manufacturer: lead.manufacturer || "",
      model: lead.model || "",
      year: lead.year || "",
      mileage: lead.mileage || "",
      bodyType: lead.body_type || "",
      condition: lead.condition || "",
    },
    status: lead.status || "new",
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminLeads() {
  const [activeTab, setActiveTab] = useState("wizard_sessions");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Wizard session detail dialog
  const [selectedSession, setSelectedSession] = useState<WizardSession | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  // Quick lead detail dialog
  const [selectedQuickLead, setSelectedQuickLead] = useState<QuickLead | null>(null);
  const [quickLeadDetailOpen, setQuickLeadDetailOpen] = useState(false);
  const [quickLeadAdminNotes, setQuickLeadAdminNotes] = useState("");
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
  const [valuationAdminNotes, setValuationAdminNotes] = useState("");
  // Edit vehicle data in valuation detail
  const [editingVehicleData, setEditingVehicleData] = useState(false);
  const [editVehicleForm, setEditVehicleForm] = useState<{
    manufacturer: string;
    model: string;
    year: string;
    body_type: string;
    vehicle_type: string;
    mileage: string;
    condition: string;
  }>({ manufacturer: "", model: "", year: "", body_type: "", vehicle_type: "", mileage: "", condition: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ value: number; confidence: number; reasoning: string; trainingCount: number } | null>(null);
  // Send expert valuation email
  const [sendingValuationEmail, setSendingValuationEmail] = useState(false);
  const [valuationEmailSent, setValuationEmailSent] = useState(false);
  // Wrong number email
  const [sendingWrongNumberEmail, setSendingWrongNumberEmail] = useState<string | null>(null);
  const [wrongNumberValueDialogOpen, setWrongNumberValueDialogOpen] = useState(false);
  const [wrongNumberValueInput, setWrongNumberValueInput] = useState("");
  const [wrongNumberEmailTarget, setWrongNumberEmailTarget] = useState<DispositionItem | null>(null);
  // Convert to motorhome dialog
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertSession, setConvertSession] = useState<{ id: string; user_id: string | null; customer_name: string | null; customer_email: string | null; customer_phone: string | null; form_data: Record<string, unknown>; status: string } | null>(null);
  const [convertSourceType, setConvertSourceType] = useState<"wizard" | "quick" | "valuation">("wizard");
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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WizardSession[];
    },
    refetchInterval: 30000,
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
    refetchInterval: 30000,
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

  // Aktive Sessions (ohne Disposition) für Funnel und Statistiken
  const activeSessions = useMemo(() => 
    wizardSessions.filter(s => !s.disposition), 
    [wizardSessions]
  );

  const stats = useMemo(() => {
    const inProgress = activeSessions.filter((s) => s.status === "in_progress").length;
    const abandoned = activeSessions.filter((s) => s.status === "abandoned").length;
    const completed = activeSessions.filter((s) => s.status === "completed").length;
    const total = activeSessions.length;
    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const abandonedSessions = activeSessions.filter((s) => s.status === "abandoned");
    const avgAbandonStep =
      abandonedSessions.length > 0
        ? Math.round(
            abandonedSessions.reduce((sum, s) => sum + s.max_step_reached, 0) /
              abandonedSessions.length
          )
        : 0;

    const actionableLeads = activeSessions.filter(
      (s) => s.status !== "completed" && (s.customer_email || s.customer_phone)
    ).length;

    const notContacted = activeSessions.filter(
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
      quickLeadsTotal: quickLeads.filter(l => !l.disposition).length,
      valuationLeadsTotal: valuationLeads.filter(l => !l.disposition).length,
    };
  }, [activeSessions, quickLeads, valuationLeads]);

  // ---- Filtering ----

  const enrichedSessions = useMemo(() => {
    return wizardSessions.map((session) => {
      if (session.customer_name && session.customer_email && session.customer_phone) {
        return session;
      }
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
      // Leads mit Disposition aus dem Original-Tab ausblenden
      if (session.disposition) return false;
      if (statusFilter !== "all" && session.status !== statusFilter) return false;
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
    // Leads mit Disposition aus dem Original-Tab ausblenden
    const withoutDisposition = quickLeads.filter(l => !l.disposition);
    if (!searchQuery) return withoutDisposition;
    const q = searchQuery.toLowerCase();
    return withoutDisposition.filter(
      (lead) =>
        (lead.name || (lead.form_data_snapshot?.customerName as string) || (lead.form_data_snapshot?.name as string) || "").toLowerCase().includes(q) ||
        (lead.email || (lead.form_data_snapshot?.customerEmail as string) || "").toLowerCase().includes(q) ||
        (lead.phone || (lead.form_data_snapshot?.customerPhone as string) || "").toLowerCase().includes(q) ||
        (lead.manufacturer || (lead.form_data_snapshot?.manufacturer as string) || "").toLowerCase().includes(q) ||
        (lead.model || (lead.form_data_snapshot?.model as string) || "").toLowerCase().includes(q)
    );
  }, [quickLeads, searchQuery]);

  const filteredValuationLeads = useMemo(() => {
    // Leads mit Disposition aus dem Original-Tab ausblenden
    const withoutDisposition = valuationLeads.filter(l => !l.disposition);
    if (!searchQuery) return withoutDisposition;
    const q = searchQuery.toLowerCase();
    return withoutDisposition.filter(
      (lead) =>
        (lead.name || "").toLowerCase().includes(q) ||
        (lead.email || "").toLowerCase().includes(q) ||
        (lead.phone || "").toLowerCase().includes(q) ||
        (lead.manufacturer || "").toLowerCase().includes(q) ||
        (lead.model || "").toLowerCase().includes(q)
    );
  }, [valuationLeads, searchQuery]);

  // ---- Disposition Filtered Lists ----

  const dispositionLeads = useMemo(() => {
    const items: DispositionItem[] = [];
    // Wizard sessions with disposition
    wizardSessions.filter(s => s.disposition).forEach(s => {
      items.push({
        id: s.id,
        type: "wizard",
        name: s.customer_name,
        email: s.customer_email,
        phone: s.customer_phone,
        vehicle: s.vehicle_summary || "-",
        disposition: s.disposition,
        created_at: s.created_at,
        source_label: "Wizard",
        wrong_number_email_count: s.wrong_number_email_count || 0,
        admin_estimated_value: s.admin_estimated_value || null,
      });
    });
    // Quick leads with disposition
    quickLeads.filter(l => l.disposition).forEach(l => {
      items.push({
        id: l.id,
        type: "quick",
        name: l.name,
        email: l.email,
        phone: l.phone,
        vehicle: [l.manufacturer, l.model].filter(Boolean).join(" ") || "-",
        disposition: l.disposition,
        created_at: l.created_at,
        source_label: "Quick-Lead",
        wrong_number_email_count: l.wrong_number_email_count || 0,
        admin_estimated_value: l.admin_estimated_value || null,
      });
    });
    // Valuation leads with disposition
    valuationLeads.filter(l => l.disposition).forEach(l => {
      items.push({
        id: l.id,
        type: "valuation",
        name: l.name,
        email: l.email,
        phone: l.phone,
        vehicle: [l.manufacturer, l.model].filter(Boolean).join(" ") || "-",
        disposition: l.disposition,
        created_at: l.created_at,
        source_label: "Wertrechner",
        wrong_number_email_count: l.wrong_number_email_count || 0,
        admin_estimated_value: l.admin_estimated_value || l.ai_estimated_value || null,
      });
    });
    return items.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [wizardSessions, quickLeads, valuationLeads]);

  const wrongNumberLeads = useMemo(() => dispositionLeads.filter(l => l.disposition === "wrong_number"), [dispositionLeads]);
  const noAnswerLeads = useMemo(() => dispositionLeads.filter(l => l.disposition === "no_answer"), [dispositionLeads]);
  const consideringLeads = useMemo(() => dispositionLeads.filter(l => l.disposition === "considering"), [dispositionLeads]);
  const doneLeads = useMemo(() => dispositionLeads.filter(l => l.disposition === "done"), [dispositionLeads]);

  const handleDispositionChange = (item: DispositionItem, newDisposition: string | null) => {
    if (item.type === "wizard") {
      updateWizardDisposition.mutate({ id: item.id, disposition: newDisposition });
    } else if (item.type === "quick") {
      updateQuickLeadDisposition.mutate({ id: item.id, disposition: newDisposition });
    } else {
      updateValuationDisposition.mutate({ id: item.id, disposition: newDisposition });
    }
  };

  // ---- Wrong Number Email ----

  const handleSendWrongNumberEmail = async (item: DispositionItem, estimatedValue?: number) => {
    if (!item.email) {
      toast({ title: "Keine E-Mail", description: "Dieser Lead hat keine E-Mail-Adresse.", variant: "destructive" });
      return;
    }
    // Check if we have a value - if not, open the value input dialog
    const value = estimatedValue || item.admin_estimated_value;
    if (!value) {
      setWrongNumberEmailTarget(item);
      setWrongNumberValueInput("");
      setWrongNumberValueDialogOpen(true);
      return;
    }
    setSendingWrongNumberEmail(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-wrong-number-email", {
        body: { lead_id: item.id, lead_type: item.type, estimated_value: value },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "E-Mail gesendet",
        description: `Falsche-Nummer-E-Mail wurde an ${data?.recipient || item.email} gesendet. (${data?.email_count || 1}x)`,
      });
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
      queryClient.invalidateQueries({ queryKey: ["adminQuickLeads"] });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
    } catch (err: any) {
      toast({
        title: "Fehler beim Versenden",
        description: err.message || "E-Mail konnte nicht gesendet werden.",
        variant: "destructive",
      });
    } finally {
      setSendingWrongNumberEmail(null);
    }
  };

  const handleConfirmWrongNumberValue = () => {
    const value = parseFloat(wrongNumberValueInput);
    if (!value || value <= 0) {
      toast({ title: "Ungültiger Wert", description: "Bitte geben Sie einen gültigen Expertenwert ein.", variant: "destructive" });
      return;
    }
    setWrongNumberValueDialogOpen(false);
    if (wrongNumberEmailTarget) {
      handleSendWrongNumberEmail(wrongNumberEmailTarget, value);
    }
  };

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

  // ---- Quick Lead Mutations ----

  const markQuickLeadContacted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quick_leads")
        .update({ contacted_at: new Date().toISOString(), status: "contacted" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Als kontaktiert markiert" });
      queryClient.invalidateQueries({ queryKey: ["adminQuickLeads"] });
    },
  });

  const updateQuickLeadAdminNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("quick_leads")
        .update({ admin_notes: notes } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notiz gespeichert" });
      queryClient.invalidateQueries({ queryKey: ["adminQuickLeads"] });
    },
  });

  // ---- Valuation Lead Mutations ----

  const updateValuationAdminNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("value_assessment_leads")
        .update({ admin_notes: notes } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Admin-Notiz gespeichert" });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
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
      // Combine expert notes with existing admin notes to avoid overwriting
      const currentLead = valuationLeads.find(l => l.id === id);
      const existingAdminNotes = valuationAdminNotes || currentLead?.admin_notes || "";
      const combinedNotes = existingAdminNotes
        ? `${existingAdminNotes}\n---\n[Expertenbewertung ${new Date().toLocaleDateString("de-DE")}]: ${notes}`
        : notes || null;
      const { error } = await supabase
        .from("value_assessment_leads")
        .update({
          admin_estimated_value: value,
          admin_notes: combinedNotes,
          admin_valued_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Expertenwert gespeichert", description: "Der Wert wird für das KI-Training verwendet." });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
      setValuationDetailOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Speichern", description: error.message, variant: "destructive" });
    },
   });

  // ---- Save edited vehicle data ----
  const saveVehicleData = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { manufacturer: string | null; model: string | null; year: number | null; body_type: string | null; vehicle_type: string | null; mileage: number | null; condition: string | null } }) => {
      const { error } = await supabase
        .from("value_assessment_leads")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Fahrzeugdaten aktualisiert", description: "Die Fahrzeugdaten wurden erfolgreich gespeichert." });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
      setEditingVehicleData(false);
      // Update selectedValuation locally so the dialog reflects changes immediately
      if (selectedValuation) {
        setSelectedValuation({
          ...selectedValuation,
          manufacturer: editVehicleForm.manufacturer || null,
          model: editVehicleForm.model || null,
          year: editVehicleForm.year ? Number(editVehicleForm.year) : null,
          body_type: editVehicleForm.body_type || null,
          vehicle_type: editVehicleForm.vehicle_type || null,
          mileage: editVehicleForm.mileage ? Number(editVehicleForm.mileage) : null,
          condition: editVehicleForm.condition || null,
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Speichern", description: error.message, variant: "destructive" });
    },
  });

  // ---- Disposition Mutations ----
  const updateWizardDisposition = useMutation({
    mutationFn: async ({ id, disposition }: { id: string; disposition: string | null }) => {
      const { error } = await supabase
        .from("wizard_sessions")
        .update({ disposition } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Disposition aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const updateQuickLeadDisposition = useMutation({
    mutationFn: async ({ id, disposition }: { id: string; disposition: string | null }) => {
      const { error } = await supabase
        .from("quick_leads")
        .update({ disposition } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Disposition aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ["adminQuickLeads"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const updateValuationDisposition = useMutation({
    mutationFn: async ({ id, disposition }: { id: string; disposition: string | null }) => {
      const { error } = await supabase
        .from("value_assessment_leads")
        .update({ disposition } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Disposition aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
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
        await supabase
          .from("value_assessment_leads")
          .update({
            ai_estimated_value: data.aiEstimatedValue,
            ai_confidence: data.aiConfidence,
          } as any)
          .eq("id", lead.id);
      } else {
        toast({
          title: "KI-Schätzung nicht möglich",
          description: data?.message || "Noch nicht genügend Trainingsdaten vorhanden.",
        });
      }
    } catch (err: any) {
      toast({ title: "KI-Fehler", description: err.message || "KI-Bewertung fehlgeschlagen", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  // ---- Handlers ----

  const openDetail = (session: WizardSession) => {
    let enrichedSession = { ...session };
    if (!session.customer_name || !session.customer_email || !session.customer_phone) {
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
    // Mark as viewed
    if (!session.is_viewed) {
      supabase.from("wizard_sessions").update({ is_viewed: true }).eq("id", session.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
      });
    }
  };

  const openEmailDialog = (session: WizardSession) => {
    setSelectedSession(session);
    setCustomMessage("");
    setEmailDialogOpen(true);
  };

  const openQuickLeadDetail = (lead: QuickLead) => {
    setSelectedQuickLead(lead);
    setQuickLeadAdminNotes(lead.admin_notes || lead.notes || "");
    setQuickLeadDetailOpen(true);
    // Mark as viewed
    if (!lead.is_viewed) {
      supabase.from("quick_leads").update({ is_viewed: true }).eq("id", lead.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["adminQuickLeads"] });
      });
    }
  };

  const openValuationDetail = (lead: ValuationLead) => {
    setSelectedValuation(lead);
    setExpertValue(lead.admin_estimated_value ? String(lead.admin_estimated_value) : "");
    setExpertNotes(lead.admin_notes || "");
    setValuationAdminNotes(lead.admin_notes || "");
    setAiResult(lead.ai_estimated_value ? {
      value: lead.ai_estimated_value,
      confidence: lead.ai_confidence || 0,
      reasoning: "",
      trainingCount: 0,
    } : null);
    setValuationEmailSent(false);
    setEditingVehicleData(false);
    setValuationDetailOpen(true);
    // Mark as viewed
    if (!lead.is_viewed) {
      supabase.from("value_assessment_leads").update({ is_viewed: true }).eq("id", lead.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
      });
    }
  };

  const sendExpertValuationEmail = async (leadId: string, recipientEmail?: string) => {
    setSendingValuationEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-expert-valuation", {
        body: { lead_id: leadId, recipient_email: recipientEmail || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setValuationEmailSent(true);
      toast({
        title: "Expertenbewertung versendet",
        description: `E-Mail wurde an ${data?.recipient || recipientEmail || "den Kunden"} gesendet.`,
      });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
    } catch (err: any) {
      toast({
        title: "Fehler beim Versenden",
        description: err.message || "E-Mail konnte nicht gesendet werden.",
        variant: "destructive",
      });
    } finally {
      setSendingValuationEmail(false);
    }
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

  const sendRegistrationInvite = async (email: string, name?: string, sourceId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-registration-invite",
        {
          body: {
            email,
            customerName: name || undefined,
            sessionId: sourceId || undefined,
          },
        }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Registrierungslink gesendet!",
        description: `E-Mail an ${email} gesendet.`,
      });
    } catch (err: any) {
      toast({
        title: "Fehler",
        description: err.message || "Konnte nicht gesendet werden",
        variant: "destructive",
      });
    }
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
            const reachedCount = activeSessions.filter(
              (s) => s.max_step_reached >= step
            ).length;
            const percentage =
              activeSessions.length > 0
                ? Math.round((reachedCount / activeSessions.length) * 100)
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

      {/* Tabs: Wizard Sessions / Quick Leads / Valuation Leads */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="wizard_sessions" className="gap-2">
              <Timer className="w-4 h-4" />
              Wizard-Sessions ({wizardSessions.filter(s => !s.disposition).length})
              {wizardSessions.filter(s => !s.is_viewed && !s.disposition).length > 0 && (
                <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] rounded-full">
                  {wizardSessions.filter(s => !s.is_viewed && !s.disposition).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quick_leads" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Quick-Leads ({quickLeads.filter(l => !l.disposition).length})
              {quickLeads.filter(l => !l.is_viewed && !l.disposition).length > 0 && (
                <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] rounded-full">
                  {quickLeads.filter(l => !l.is_viewed && !l.disposition).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="valuation_leads" className="gap-2">
              <Calculator className="w-4 h-4" />
              Wertrechner ({valuationLeads.filter(l => !l.disposition).length})
              {valuationLeads.filter(l => !l.is_viewed && !l.disposition).length > 0 && (
                <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] rounded-full">
                  {valuationLeads.filter(l => !l.is_viewed && !l.disposition).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="wrong_number" className="gap-2">
              <PhoneOff className="w-4 h-4" />
              Falsche Nr. ({wrongNumberLeads.length})
            </TabsTrigger>
            <TabsTrigger value="no_answer" className="gap-2">
              <PhoneMissed className="w-4 h-4" />
              Nicht rangeg. ({noAnswerLeads.length})
            </TabsTrigger>
            <TabsTrigger value="considering" className="gap-2">
              <Clock className="w-4 h-4" />
              Überlegt ({consideringLeads.length})
            </TabsTrigger>
            <TabsTrigger value="done" className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Erledigt ({doneLeads.length})
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

        {/* ================================================================ */}
        {/* Wizard Sessions Tab */}
        {/* ================================================================ */}
        <TabsContent value="wizard_sessions">
          {selectedSessionIds.size > 0 && (
            <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-3 animate-fade-in">
              <span className="text-sm font-medium">
                {selectedSessionIds.size} Session{selectedSessionIds.size > 1 ? "s" : ""} ausgewählt
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedSessionIds(new Set())}>
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
                      className={`cursor-pointer hover:bg-muted/50 ${selectedSessionIds.has(session.id) ? "bg-primary/5" : ""} ${!session.is_viewed ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
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
                          <p className={`text-sm ${!session.is_viewed ? "font-bold text-foreground" : "font-medium"}`}>
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
                        <span className={`text-sm ${!session.is_viewed ? "font-bold" : ""}`}>
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
                          <Button variant="ghost" size="sm" onClick={() => openDetail(session)} title="Details anzeigen">
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
                            <Button variant="ghost" size="sm" onClick={() => openEmailDialog(session)} title="Wiederaufnahme-E-Mail senden">
                              <Send className="w-4 h-4 text-blue-600" />
                            </Button>
                          )}
                          {session.status !== "converted" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setConvertSession(session);
                                setConvertSourceType("wizard");
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
                              onClick={() => sendRegistrationInvite(session.customer_email!, session.customer_name || undefined, session.id)}
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

        {/* ================================================================ */}
        {/* Quick Leads Tab - EXTENDED */}
        {/* ================================================================ */}
        <TabsContent value="quick_leads">
          {selectedLeadIds.size > 0 && (
            <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-3 animate-fade-in">
              <span className="text-sm font-medium">
                {selectedLeadIds.size} Lead{selectedLeadIds.size > 1 ? "s" : ""} ausgewählt
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedLeadIds(new Set())}>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Wizard</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLeads ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Lade Leads...
                    </TableCell>
                  </TableRow>
                ) : filteredQuickLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Keine Leads gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuickLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedLeadIds.has(lead.id) ? "bg-primary/5" : ""} ${!lead.is_viewed ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                      onClick={() => openQuickLeadDetail(lead)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeadIds.has(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                          aria-label="Lead auswählen"
                        />
                      </TableCell>
                      <TableCell className={!lead.is_viewed ? "font-bold" : "font-medium"}>
                        {lead.name
                          || (lead.form_data_snapshot?.customerName as string)
                          || (lead.form_data_snapshot?.name as string)
                          || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {(lead.email || (lead.form_data_snapshot?.customerEmail as string)) && (
                            <p className="text-xs flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {lead.email || (lead.form_data_snapshot?.customerEmail as string)}
                            </p>
                          )}
                          {(lead.phone || (lead.form_data_snapshot?.customerPhone as string)) && (
                            <p className="text-xs flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {lead.phone || (lead.form_data_snapshot?.customerPhone as string)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {[lead.manufacturer || (lead.form_data_snapshot?.manufacturer as string), lead.model || (lead.form_data_snapshot?.model as string)].filter(Boolean).join(" ") || "-"}
                        </span>
                        {(lead.body_type || (lead.form_data_snapshot?.bodyType as string)) && (
                          <p className="text-xs text-muted-foreground">{lead.body_type || (lead.form_data_snapshot?.bodyType as string)}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <QuickLeadStatusBadge status={lead.status} leadQuality={lead.lead_quality} contactedAt={lead.contacted_at} />
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
                        ) : lead.max_wizard_step ? (
                          <Badge variant="outline" className="text-xs text-blue-500">
                            Schritt {lead.max_wizard_step}
                          </Badge>
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => openQuickLeadDetail(lead)} title="Details anzeigen">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {lead.phone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                window.open(`tel:${lead.phone}`);
                                markQuickLeadContacted.mutate(lead.id);
                              }}
                              title="Anrufen & als kontaktiert markieren"
                            >
                              <PhoneCall className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {lead.status !== "converted" && lead.lead_quality !== "converted" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setConvertSession(quickLeadToSessionData(lead));
                                setConvertSourceType("quick");
                                setConvertDialogOpen(true);
                              }}
                              title="Als Wohnmobil anlegen"
                            >
                              <Car className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {(lead.status === "converted" || lead.lead_quality === "converted") && lead.email && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => sendRegistrationInvite(lead.email!, lead.name || undefined, lead.id)}
                              title="Registrierungslink senden"
                            >
                              <Mail className="w-4 h-4 text-purple-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog("quick", [lead.id])}
                            title="Lead löschen"
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

        {/* ================================================================ */}
        {/* Wertrechner / Wertermittlung Leads Tab - EXTENDED */}
        {/* ================================================================ */}
        <TabsContent value="valuation_leads">
          {selectedValuationIds.size > 0 && (
            <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-3 animate-fade-in">
              <span className="text-sm font-medium">
                {selectedValuationIds.size} Lead{selectedValuationIds.size > 1 ? "s" : ""} ausgewählt
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedValuationIds(new Set())}>
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
                  <TableHead className="w-32">Aktionen</TableHead>
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
                    <TableRow key={lead.id} className={`cursor-pointer hover:bg-muted/50 ${selectedValuationIds.has(lead.id) ? "bg-primary/5" : ""} ${!lead.is_viewed ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`} onClick={() => openValuationDetail(lead)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedValuationIds.has(lead.id)}
                          onCheckedChange={() => toggleValuationSelection(lead.id)}
                          aria-label="Lead auswählen"
                        />
                      </TableCell>
                      <TableCell className={!lead.is_viewed ? "font-bold" : "font-medium"}>{lead.name || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {lead.email && (
                            <p className="text-xs flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <a href={`mailto:${lead.email}`} className="hover:underline text-primary" onClick={(e) => e.stopPropagation()}>{lead.email}</a>
                            </p>
                          )}
                          {lead.phone && (
                            <p className="text-xs flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <a href={`tel:${lead.phone}`} className="hover:underline text-primary" onClick={(e) => e.stopPropagation()}>{lead.phone}</a>
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">
                            {[lead.manufacturer, lead.model].filter(Boolean).join(" ") || "-"}
                          </span>
                          {(lead.year || lead.body_type || lead.vehicle_type) && (
                            <p className="text-xs text-muted-foreground">
                              {[lead.vehicle_type, lead.body_type, lead.year ? `BJ ${lead.year}` : null, lead.mileage ? `${lead.mileage.toLocaleString("de-DE")} km` : null].filter(Boolean).join(" · ")}
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
                        {lead.status === "converted" ? (
                          <Badge className="bg-purple-500 text-xs"><Car className="w-3 h-3 mr-1" /> Konvertiert</Badge>
                        ) : lead.contacted_at ? (
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
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => openValuationDetail(lead)} title="Bewerten & Details">
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
                          {lead.status !== "converted" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setConvertSession(valuationLeadToSessionData(lead));
                                setConvertSourceType("valuation");
                                setConvertDialogOpen(true);
                              }}
                              title="Als Wohnmobil anlegen"
                            >
                              <Car className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {lead.status === "converted" && lead.email && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => sendRegistrationInvite(lead.email, lead.name || undefined, lead.id)}
                              title="Registrierungslink senden"
                            >
                              <Mail className="w-4 h-4 text-purple-600" />
                            </Button>
                          )}
                          {!lead.contacted_at && lead.status !== "converted" && (
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
                            title="Lead löschen"
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

        {/* ================================================================ */}
        {/* Disposition Tabs: Falsche Nummer / Nicht rangegangen / Überlegt */}
        {/* ================================================================ */}
        {(["wrong_number", "no_answer", "considering", "done"] as const).map((dispositionKey) => {
          const items = dispositionKey === "wrong_number" ? wrongNumberLeads : dispositionKey === "no_answer" ? noAnswerLeads : dispositionKey === "done" ? doneLeads : consideringLeads;
          const Icon = DISPOSITION_ICONS[dispositionKey];
          const label = DISPOSITION_LABELS[dispositionKey];
          const isWrongNumber = dispositionKey === "wrong_number";
          return (
            <TabsContent key={dispositionKey} value={dispositionKey}>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Kontakt</TableHead>
                      <TableHead>Fahrzeug</TableHead>
                      <TableHead>Quelle</TableHead>
                      <TableHead>Datum</TableHead>
                      {isWrongNumber && <TableHead>E-Mail</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isWrongNumber ? 8 : 7} className="text-center py-12 text-muted-foreground">
                          <Icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          Keine Leads mit Status "{label}"
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow
                          key={`${item.type}-${item.id}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (item.type === "wizard") {
                              const session = wizardSessions.find(s => s.id === item.id);
                              if (session) openDetail(session);
                            } else if (item.type === "quick") {
                              const lead = quickLeads.find(l => l.id === item.id);
                              if (lead) openQuickLeadDetail(lead);
                            } else if (item.type === "valuation") {
                              const lead = valuationLeads.find(l => l.id === item.id);
                              if (lead) openValuationDetail(lead);
                            }
                          }}
                        >
                          <TableCell className="font-medium">{item.name || "Unbekannt"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {item.email && (
                                <a href={`mailto:${item.email}`} className="text-xs text-primary hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Mail className="w-3 h-3" /> {item.email}
                                </a>
                              )}
                              {item.phone && (
                                <a href={`tel:${item.phone}`} className="text-xs text-primary hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Phone className="w-3 h-3" /> {item.phone}
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{item.vehicle}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{item.source_label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.created_at ? format(new Date(item.created_at), "dd.MM.yyyy", { locale: de }) : "-"}
                          </TableCell>
                          {isWrongNumber && (
                            <TableCell>
                              <div className="flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleSendWrongNumberEmail(item); }}
                                  disabled={sendingWrongNumberEmail === item.id || !item.email}
                                  className="text-xs bg-red-600 hover:bg-red-700"
                                  title={!item.email ? "Keine E-Mail-Adresse vorhanden" : "Falsche-Nummer-E-Mail senden"}
                                >
                                  {sendingWrongNumberEmail === item.id ? (
                                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sende...</>
                                  ) : (
                                    <><Send className="w-3 h-3 mr-1" /> E-Mail senden</>
                                  )}
                                </Button>
                                {item.wrong_number_email_count > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {item.wrong_number_email_count}x gesendet
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <DispositionBadge disposition={item.disposition} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.type === "wizard") {
                                    const session = wizardSessions.find(s => s.id === item.id);
                                    if (session) openDetail(session);
                                  } else if (item.type === "quick") {
                                    const lead = quickLeads.find(l => l.id === item.id);
                                    if (lead) openQuickLeadDetail(lead);
                                  } else {
                                    const lead = valuationLeads.find(l => l.id === item.id);
                                    if (lead) openValuationDetail(lead);
                                  }
                                }}
                                className="text-xs"
                              >
                                <Eye className="w-4 h-4 mr-1" /> Details
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleDispositionChange(item, null); }}
                                title="Disposition zurücksetzen (zurück in Original-Tab)"
                                className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <Undo2 className="w-4 h-4 mr-1" /> Zurücksetzen
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
          );
        })}
      </Tabs>

      {/* ================================================================== */}
      {/* Wizard Session Detail Dialog */}
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
                      value={(selectedSession.max_step_reached / selectedSession.total_steps) * 100}
                      className="h-3 w-32"
                    />
                    <span className="text-sm font-medium">
                      {Math.round((selectedSession.max_step_reached / selectedSession.total_steps) * 100)}%
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
                      <p className="font-medium">{selectedSession.customer_name || "Nicht angegeben"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">E-Mail</p>
                      {selectedSession.customer_email ? (
                        <a href={`mailto:${selectedSession.customer_email}`} className="font-medium text-primary hover:underline">
                          {selectedSession.customer_email}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">Nicht angegeben</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefon</p>
                      {selectedSession.customer_phone ? (
                        <a href={`tel:${selectedSession.customer_phone}`} className="font-medium text-primary hover:underline">
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
                      const isSessionCompleted = selectedSession.status === "completed";
                      const isCompleted = step < selectedSession.current_step || (isSessionCompleted && step === selectedSession.current_step);
                      const isAbandoned = !isSessionCompleted && step === selectedSession.current_step;
                      return (
                        <div
                          key={step}
                          className={`flex items-center gap-2 p-2 rounded text-sm ${
                            isAbandoned
                              ? "bg-primary/10 font-medium"
                              : isCompleted
                              ? "text-green-700"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : isAbandoned ? (
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted" />
                          )}
                          <span>
                            {step}. {name}
                          </span>
                          {isAbandoned && (
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
                                    <span className="text-muted-foreground">{FIELD_LABELS[field] || field}</span>
                                    <span className="font-medium text-right max-w-[180px] truncate">{formatFieldValue(field, val)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {/* Ungrouped fields */}
                      {(() => {
                        const allGroupedFields = FIELD_GROUPS.flatMap((g) => g.fields);
                        const ungrouped = Object.entries(selectedSession.form_data || {}).filter(
                          ([key, val]) =>
                            !allGroupedFields.includes(key) &&
                            val !== null && val !== undefined && val !== "" &&
                            key !== "photos" && key !== "photos_count" &&
                            key !== "customerName" && key !== "customerEmail" && key !== "customerPhone"
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
                                  <span className="text-muted-foreground">{FIELD_LABELS[key] || key}</span>
                                  <span className="font-medium text-right max-w-[180px] truncate">{formatFieldValue(key, val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      {selectedSession.form_data?.photos_count != null && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Fotos hochgeladen:</span>
                          <Badge variant="outline">{String(selectedSession.form_data.photos_count)} Fotos</Badge>
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
                      <span>{format(new Date(selectedSession.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Letzte Aktivität</span>
                      <span>{formatDistanceToNow(new Date(selectedSession.last_activity_at), { addSuffix: true, locale: de })}</span>
                    </div>
                    {selectedSession.resume_email_sent_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">E-Mail gesendet</span>
                        <span>{format(new Date(selectedSession.resume_email_sent_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                      </div>
                    )}
                    {selectedSession.admin_called_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Angerufen</span>
                        <span>{format(new Date(selectedSession.admin_called_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                      </div>
                    )}
                    {selectedSession.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Abgeschlossen</span>
                        <span>{format(new Date(selectedSession.completed_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
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
                    onClick={() => updateAdminNotes.mutate({ sessionId: selectedSession.id, notes: adminNotes })}
                    disabled={updateAdminNotes.isPending}
                  >
                    {updateAdminNotes.isPending ? "Speichern..." : "Notiz speichern"}
                  </Button>
                </Card>

                {/* Disposition Buttons */}
                <DispositionButtons
                  currentDisposition={selectedSession.disposition}
                  onSetDisposition={(d) => updateWizardDisposition.mutate({ id: selectedSession.id, disposition: d })}
                  isPending={updateWizardDisposition.isPending}
                />

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
                    <Button variant="outline" onClick={() => openEmailDialog(selectedSession)}>
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
                        setConvertSourceType("wizard");
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
                          onClick={() => sendRegistrationInvite(selectedSession.customer_email!, selectedSession.customer_name || undefined, selectedSession.id)}
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
      {/* Quick Lead Detail Dialog - NEW */}
      {/* ================================================================== */}
      <Dialog open={quickLeadDetailOpen} onOpenChange={setQuickLeadDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedQuickLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Quick-Lead Details
                </DialogTitle>
                <DialogDescription>
                  {[selectedQuickLead.manufacturer, selectedQuickLead.model].filter(Boolean).join(" ") || "Keine Fahrzeugdaten"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <QuickLeadStatusBadge
                    status={selectedQuickLead.status}
                    leadQuality={selectedQuickLead.lead_quality}
                    contactedAt={selectedQuickLead.contacted_at}
                  />
                  {selectedQuickLead.lead_quality && (
                    <Badge variant="outline" className="text-xs">
                      Qualität: {selectedQuickLead.lead_quality}
                    </Badge>
                  )}
                </div>

                {/* Contact Info */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Kontaktdaten
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedQuickLead.name || "Nicht angegeben"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">E-Mail</p>
                      {selectedQuickLead.email ? (
                        <a href={`mailto:${selectedQuickLead.email}`} className="font-medium text-primary hover:underline text-sm">
                          {selectedQuickLead.email}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">Nicht angegeben</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefon</p>
                      {selectedQuickLead.phone ? (
                        <a href={`tel:${selectedQuickLead.phone}`} className="font-medium text-primary hover:underline">
                          {selectedQuickLead.phone}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">Nicht angegeben</p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Vehicle Data */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Car className="w-4 h-4" /> Fahrzeugdaten
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hersteller</span>
                      <span className="font-medium">{selectedQuickLead.manufacturer || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modell</span>
                      <span className="font-medium">{selectedQuickLead.model || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aufbauart</span>
                      <span className="font-medium">{selectedQuickLead.body_type || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verkaufsweg</span>
                      <span className="font-medium">{selectedQuickLead.sale_channel ? (SALE_CHANNEL_LABELS[selectedQuickLead.sale_channel] || selectedQuickLead.sale_channel) : "-"}</span>
                    </div>
                  </div>
                </Card>

                {/* Form Data Snapshot (if available) */}
                {selectedQuickLead.form_data_snapshot && Object.keys(selectedQuickLead.form_data_snapshot).length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Wizard-Daten Snapshot
                    </h3>
                    <div className="space-y-4">
                      {FIELD_GROUPS.map((group) => {
                        const groupEntries = group.fields.filter((field) => {
                          const val = (selectedQuickLead.form_data_snapshot as Record<string, unknown>)?.[field];
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
                                const val = (selectedQuickLead.form_data_snapshot as Record<string, unknown>)[field];
                                return (
                                  <div key={field} className="flex justify-between py-0.5">
                                    <span className="text-muted-foreground">{FIELD_LABELS[field] || field}</span>
                                    <span className="font-medium text-right max-w-[180px] truncate">{formatFieldValue(field, val)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {/* Ungrouped fields */}
                      {(() => {
                        const allGroupedFields = FIELD_GROUPS.flatMap((g) => g.fields);
                        const ungrouped = Object.entries(selectedQuickLead.form_data_snapshot || {}).filter(
                          ([key, val]) =>
                            !allGroupedFields.includes(key) &&
                            val !== null && val !== undefined && val !== "" &&
                            key !== "photos" && key !== "photos_count" &&
                            key !== "customerName" && key !== "customerEmail" && key !== "customerPhone"
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
                                  <span className="text-muted-foreground">{FIELD_LABELS[key] || key}</span>
                                  <span className="font-medium text-right max-w-[180px] truncate">{formatFieldValue(key, val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Card>
                )}

                {/* Meta Info */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Herkunft & Tracking
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quelle</span>
                      <span>{selectedQuickLead.source || "-"}</span>
                    </div>
                    {selectedQuickLead.page_url && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seite</span>
                        <span className="text-right max-w-[250px] truncate">{selectedQuickLead.page_url}</span>
                      </div>
                    )}
                    {selectedQuickLead.referrer && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Referrer</span>
                        <span className="text-right max-w-[250px] truncate">{selectedQuickLead.referrer}</span>
                      </div>
                    )}
                    {selectedQuickLead.max_wizard_step != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max. Wizard-Schritt</span>
                        <span>{selectedQuickLead.max_wizard_step} ({STEP_NAMES[selectedQuickLead.max_wizard_step] || "-"})</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Wizard abgeschlossen</span>
                      <span>{selectedQuickLead.wizard_completed ? "Ja" : "Nein"}</span>
                    </div>
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
                      <span>{format(new Date(selectedQuickLead.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                    </div>
                    {selectedQuickLead.updated_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Zuletzt aktualisiert</span>
                        <span>{formatDistanceToNow(new Date(selectedQuickLead.updated_at), { addSuffix: true, locale: de })}</span>
                      </div>
                    )}
                    {selectedQuickLead.contacted_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kontaktiert</span>
                        <span>{format(new Date(selectedQuickLead.contacted_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
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
                    value={quickLeadAdminNotes}
                    onChange={(e) => setQuickLeadAdminNotes(e.target.value)}
                    placeholder="Notizen zum Lead hinzufügen (z.B. Gesprächsnotizen, Vereinbarungen...)"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => updateQuickLeadAdminNotes.mutate({ id: selectedQuickLead.id, notes: quickLeadAdminNotes })}
                    disabled={updateQuickLeadAdminNotes.isPending}
                  >
                    {updateQuickLeadAdminNotes.isPending ? "Speichern..." : "Notiz speichern"}
                  </Button>
                </Card>

                {/* Disposition Buttons */}
                <DispositionButtons
                  currentDisposition={selectedQuickLead.disposition}
                  onSetDisposition={(d) => updateQuickLeadDisposition.mutate({ id: selectedQuickLead.id, disposition: d })}
                  isPending={updateQuickLeadDisposition.isPending}
                />

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {selectedQuickLead.phone && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(`tel:${selectedQuickLead.phone}`);
                        markQuickLeadContacted.mutate(selectedQuickLead.id);
                      }}
                    >
                      <PhoneCall className="w-4 h-4 mr-2 text-green-600" />
                      Anrufen & vermerken
                    </Button>
                  )}
                  {!selectedQuickLead.contacted_at && (
                    <Button
                      variant="outline"
                      onClick={() => markQuickLeadContacted.mutate(selectedQuickLead.id)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />
                      Als kontaktiert markieren
                    </Button>
                  )}
                  {selectedQuickLead.status !== "converted" && selectedQuickLead.lead_quality !== "converted" && (
                    <Button
                      className="gradient-hero hover:gradient-hero-hover"
                      onClick={() => {
                        setConvertSession(quickLeadToSessionData(selectedQuickLead));
                        setConvertSourceType("quick");
                        setConvertDialogOpen(true);
                        setQuickLeadDetailOpen(false);
                      }}
                    >
                      <Car className="w-4 h-4 mr-2" />
                      Als Wohnmobil anlegen
                    </Button>
                  )}
                  {(selectedQuickLead.status === "converted" || selectedQuickLead.lead_quality === "converted") && (
                    <>
                      <Badge variant="outline" className="text-purple-600 border-purple-300 py-1.5 px-3">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Bereits als Wohnmobil angelegt
                      </Badge>
                      {selectedQuickLead.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          onClick={() => sendRegistrationInvite(selectedQuickLead.email!, selectedQuickLead.name || undefined, selectedQuickLead.id)}
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
      {/* Valuation Detail Dialog – Expertenwert & KI - EXTENDED */}
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
                {/* Status */}
                <div className="flex items-center gap-2">
                  {selectedValuation.status === "converted" ? (
                    <Badge className="bg-purple-500"><Car className="w-3 h-3 mr-1" /> Konvertiert</Badge>
                  ) : selectedValuation.contacted_at ? (
                    <Badge className="bg-green-500">Kontaktiert</Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-500">Offen</Badge>
                  )}
                </div>

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

                {/* Fahrzeugdaten - bearbeitbar */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Car className="w-4 h-4" /> Fahrzeugdaten
                    </span>
                    {!editingVehicleData ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setEditVehicleForm({
                            manufacturer: selectedValuation.manufacturer || "",
                            model: selectedValuation.model || "",
                            year: selectedValuation.year ? String(selectedValuation.year) : "",
                            body_type: selectedValuation.body_type || "",
                            vehicle_type: selectedValuation.vehicle_type || "",
                            mileage: selectedValuation.mileage ? String(selectedValuation.mileage) : "",
                            condition: selectedValuation.condition || "",
                          });
                          setEditingVehicleData(true);
                        }}
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Bearbeiten
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setEditingVehicleData(false)}
                        >
                          Abbrechen
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={saveVehicleData.isPending}
                          onClick={() => {
                            saveVehicleData.mutate({
                              id: selectedValuation.id,
                              data: {
                                manufacturer: editVehicleForm.manufacturer || null,
                                model: editVehicleForm.model || null,
                                year: editVehicleForm.year ? Number(editVehicleForm.year) : null,
                                body_type: editVehicleForm.body_type || null,
                                vehicle_type: editVehicleForm.vehicle_type || null,
                                mileage: editVehicleForm.mileage ? Number(editVehicleForm.mileage) : null,
                                condition: editVehicleForm.condition || null,
                              },
                            });
                          }}
                        >
                          {saveVehicleData.isPending ? (
                            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Speichern...</>
                          ) : (
                            <><Save className="w-3 h-3 mr-1" /> Speichern</>
                          )}
                        </Button>
                      </div>
                    )}
                  </h3>

                  {editingVehicleData ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Hersteller</label>
                        <Input
                          value={editVehicleForm.manufacturer}
                          onChange={(e) => setEditVehicleForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                          placeholder="z.B. Hymer"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Modell</label>
                        <Input
                          value={editVehicleForm.model}
                          onChange={(e) => setEditVehicleForm(prev => ({ ...prev, model: e.target.value }))}
                          placeholder="z.B. B-Klasse MC 580"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Baujahr</label>
                        <Input
                          type="number"
                          value={editVehicleForm.year}
                          onChange={(e) => setEditVehicleForm(prev => ({ ...prev, year: e.target.value }))}
                          placeholder="z.B. 2020"
                          className="h-8 text-sm"
                          min={1970}
                          max={new Date().getFullYear() + 1}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Fahrzeugtyp</label>
                        <Select value={editVehicleForm.vehicle_type} onValueChange={(v) => setEditVehicleForm(prev => ({ ...prev, vehicle_type: v }))}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Wohnmobil">Wohnmobil</SelectItem>
                            <SelectItem value="Wohnwagen">Wohnwagen</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Aufbautyp</label>
                        <Select value={editVehicleForm.body_type} onValueChange={(v) => setEditVehicleForm(prev => ({ ...prev, body_type: v }))}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Teilintegriert">Teilintegriert</SelectItem>
                            <SelectItem value="Alkoven">Alkoven</SelectItem>
                            <SelectItem value="Vollintegriert">Vollintegriert</SelectItem>
                            <SelectItem value="Kastenwagen">Kastenwagen</SelectItem>
                            <SelectItem value="Campingbus">Campingbus</SelectItem>
                            <SelectItem value="Wohnwagen">Wohnwagen</SelectItem>
                            <SelectItem value="Faltcaravan">Faltcaravan</SelectItem>
                            <SelectItem value="Mobilheim">Mobilheim</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Kilometerstand</label>
                        <Input
                          type="number"
                          value={editVehicleForm.mileage}
                          onChange={(e) => setEditVehicleForm(prev => ({ ...prev, mileage: e.target.value }))}
                          placeholder="z.B. 45000"
                          className="h-8 text-sm"
                          min={0}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground mb-1 block">Zustand</label>
                        <Select value={editVehicleForm.condition} onValueChange={(v) => setEditVehicleForm(prev => ({ ...prev, condition: v }))}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Neuwertig">Neuwertig</SelectItem>
                            <SelectItem value="Sehr gut">Sehr gut</SelectItem>
                            <SelectItem value="Gut">Gut</SelectItem>
                            <SelectItem value="Befriedigend">Befriedigend</SelectItem>
                            <SelectItem value="Reparaturbedürftig">Reparaturbedürftig</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
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
                  )}
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
                            {Math.round(((selectedValuation.algorithm_value_min || selectedValuation.estimated_value_min || 0) + (selectedValuation.algorithm_value_max || selectedValuation.estimated_value_max || 0)) / 2).toLocaleString("de-DE")} €
                          </p>
                          <p className="text-xs text-blue-500">
                            {(selectedValuation.algorithm_value_min || selectedValuation.estimated_value_min || 0).toLocaleString("de-DE")} – {(selectedValuation.algorithm_value_max || selectedValuation.estimated_value_max || 0).toLocaleString("de-DE")} €
                          </p>
                        </>
                      ) : <p className="text-sm text-muted-foreground">-</p>}
                    </div>

                    {/* KI-Wert */}
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
                      <p className="text-xs text-purple-600 font-medium mb-1">KI-Schätzung</p>
                      {aiResult ? (
                        <>
                          <p className="text-lg font-bold text-purple-700">{aiResult.value.toLocaleString("de-DE")} €</p>
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
                          <p className="text-lg font-bold text-green-700">{selectedValuation.admin_estimated_value.toLocaleString("de-DE")} €</p>
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
                      <label className="text-sm font-medium mb-1 block">Geschätzter Marktwert (€)</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={expertValue}
                          onChange={(e) => setExpertValue(e.target.value)}
                          placeholder="z.B. 45000"
                          className="text-lg font-bold"
                        />
                        <span className="text-lg font-bold text-muted-foreground">€</span>
                      </div>
                      {aiResult && expertValue && (
                        <p className="text-xs mt-1 text-muted-foreground">
                          Abweichung zur KI: {expertValue ? `${((Number(expertValue) - aiResult.value) / aiResult.value * 100).toFixed(1)}%` : "-"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Notizen / Begründung</label>
                      <Textarea
                        value={expertNotes}
                        onChange={(e) => setExpertNotes(e.target.value)}
                        placeholder="z.B. Marke hat hohen Wiederverkaufswert, guter Zustand für das Alter..."
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Deine Bewertungen trainieren die KI – je mehr Werte du einträgst, desto besser wird die KI-Schätzung.
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Admin Notes (separate from expert notes) */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Admin-Notizen
                  </h3>
                  <Textarea
                    value={valuationAdminNotes}
                    onChange={(e) => setValuationAdminNotes(e.target.value)}
                    placeholder="Interne Notizen (z.B. Gesprächsnotizen, Vereinbarungen...)"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => updateValuationAdminNotes.mutate({ id: selectedValuation.id, notes: valuationAdminNotes })}
                    disabled={updateValuationAdminNotes.isPending}
                  >
                    {updateValuationAdminNotes.isPending ? "Speichern..." : "Admin-Notiz speichern"}
                  </Button>
                </Card>

                {/* Disposition Buttons */}
                <DispositionButtons
                  currentDisposition={selectedValuation.disposition}
                  onSetDisposition={(d) => updateValuationDisposition.mutate({ id: selectedValuation.id, disposition: d })}
                  isPending={updateValuationDisposition.isPending}
                />

                {/* Action Buttons for Valuation */}
                <div className="flex flex-wrap gap-2">
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
                  {selectedValuation.status !== "converted" && (
                    <Button
                      className="gradient-hero hover:gradient-hero-hover"
                      onClick={() => {
                        setConvertSession(valuationLeadToSessionData(selectedValuation));
                        setConvertSourceType("valuation");
                        setConvertDialogOpen(true);
                        setValuationDetailOpen(false);
                      }}
                    >
                      <Car className="w-4 h-4 mr-2" />
                      Als Wohnmobil anlegen
                    </Button>
                  )}
                  {selectedValuation.status === "converted" && (
                    <>
                      <Badge variant="outline" className="text-purple-600 border-purple-300 py-1.5 px-3">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Bereits als Wohnmobil angelegt
                      </Badge>
                      {selectedValuation.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          onClick={() => sendRegistrationInvite(selectedValuation.email, selectedValuation.name || undefined, selectedValuation.id)}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Registrierungslink senden
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setValuationDetailOpen(false)}>
                  Schließen
                </Button>
                <Button
                  onClick={() => {
                    const val = Number(expertValue);
                    if (!val || val <= 0) {
                      toast({ title: "Bitte einen gültigen Wert eingeben", variant: "destructive" });
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
                {/* Send Expert Valuation Email Button */}
                {selectedValuation.admin_estimated_value && selectedValuation.email && (
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => sendExpertValuationEmail(selectedValuation.id)}
                    disabled={sendingValuationEmail || valuationEmailSent}
                  >
                    {sendingValuationEmail ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sende...</>
                    ) : valuationEmailSent ? (
                      <><CheckCircle2 className="w-4 h-4 mr-2" /> Versendet!</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" /> Bewertung senden</>
                    )}
                  </Button>
                )}
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
          if (!open) {
            setConvertSession(null);
            setConvertSourceType("wizard");
          }
        }}
        sourceType={convertSourceType}
      />

      {/* ================================================================== */}
      {/* Wrong Number: Expertenwert eingeben Dialog */}
      {/* ================================================================== */}
      <Dialog open={wrongNumberValueDialogOpen} onOpenChange={setWrongNumberValueDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-red-600" />
              Expertenwert eingeben
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Für diesen Lead ist noch kein Expertenwert hinterlegt. Bitte geben Sie den geschätzten Wert ein, der in der E-Mail angezeigt wird.
            </p>
            {wrongNumberEmailTarget && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{wrongNumberEmailTarget.name || "Unbekannt"}</p>
                <p className="text-xs text-muted-foreground">{wrongNumberEmailTarget.vehicle}</p>
                <p className="text-xs text-muted-foreground">{wrongNumberEmailTarget.email}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Geschätzter Wert (€)</label>
              <input
                type="number"
                value={wrongNumberValueInput}
                onChange={(e) => setWrongNumberValueInput(e.target.value)}
                placeholder="z.B. 25000"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                min="0"
                step="500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWrongNumberValueDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleConfirmWrongNumberValue}
              className="bg-red-600 hover:bg-red-700"
              disabled={!wrongNumberValueInput || parseFloat(wrongNumberValueInput) <= 0}
            >
              <Send className="w-4 h-4 mr-2" />
              E-Mail senden
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
