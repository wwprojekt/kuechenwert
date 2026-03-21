/**
 * Admin Leads Dashboard
 * Zeigt alle erfassten Leads mit Kontaktdaten, Wizard-Fortschritt und Lead-Qualität.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Search,
  Mail,
  Phone,
  User,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  Flame,
  Thermometer,
  Snowflake,
  ExternalLink,
  StickyNote,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type LeadQuality = "hot" | "warm" | "cold" | "all";
type LeadSource = "all" | "hero_form" | "hero_form_partial" | "landing_page" | "landing_page_partial";

const qualityConfig = {
  hot: { label: "Heiß", icon: Flame, color: "text-red-500", bg: "bg-red-50 border-red-200", badge: "destructive" as const },
  warm: { label: "Warm", icon: Thermometer, color: "text-orange-500", bg: "bg-orange-50 border-orange-200", badge: "default" as const },
  cold: { label: "Kalt", icon: Snowflake, color: "text-blue-500", bg: "bg-blue-50 border-blue-200", badge: "secondary" as const },
};

const sourceLabels: Record<string, string> = {
  hero_form: "Startseite",
  hero_form_partial: "Startseite (teilweise)",
  landing_page: "Landing Page",
  landing_page_partial: "Landing Page (teilweise)",
  wertermittlung: "Wertermittlung",
  wertrechner: "Wertrechner",
};

const wizardStepNames = [
  "—",
  "Fahrzeugdetails",
  "Technik",
  "Abmessungen",
  "Innenraum",
  "Ausstattung",
  "Fotos",
  "Mängel",
  "Verkaufsweg",
  "Termin",
  "Überprüfung",
  "Anmeldung",
];

export default function AdminLeads() {
  const [searchTerm, setSearchTerm] = useState("");
  const [qualityFilter, setQualityFilter] = useState<LeadQuality>("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource>("all");
  const [selectedLead, setSelectedLead] = useState<Record<string, unknown> | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch leads
  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ["adminLeads", qualityFilter, sourceFilter],
    queryFn: async () => {
      let query = supabase
        .from("quick_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (qualityFilter !== "all") {
        query = query.eq("lead_quality", qualityFilter);
      }
      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["adminLeadStats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_leads")
        .select("lead_quality, wizard_completed, source");
      if (error) throw error;

      const total = data?.length || 0;
      const hot = data?.filter((l) => l.lead_quality === "hot").length || 0;
      const warm = data?.filter((l) => l.lead_quality === "warm").length || 0;
      const cold = data?.filter((l) => l.lead_quality === "cold").length || 0;
      const completed = data?.filter((l) => l.wizard_completed).length || 0;
      const withContact = data?.filter((l) => l.source && !l.source.includes("partial")).length || 0;

      return { total, hot, warm, cold, completed, withContact };
    },
  });

  // Update lead notes
  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("quick_leads")
        .update({ notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminLeads"] });
      toast({ title: "Notiz gespeichert" });
    },
  });

  // Filter leads by search term
  const filteredLeads = leads?.filter((lead) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(search) ||
      lead.email?.toLowerCase().includes(search) ||
      lead.phone?.includes(search) ||
      lead.manufacturer?.toLowerCase().includes(search) ||
      lead.model?.toLowerCase().includes(search)
    );
  });

  const getQualityBadge = (quality: string | null) => {
    const config = qualityConfig[quality as keyof typeof qualityConfig] || qualityConfig.cold;
    const Icon = config.icon;
    return (
      <Badge variant={config.badge} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const openLeadDetail = (lead: Record<string, unknown>) => {
    setSelectedLead(lead);
    setEditNotes((lead.notes as string) || "");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="w-8 h-8 text-primary" />
            Lead-Übersicht
          </h1>
          <p className="text-muted-foreground mt-1">
            Alle erfassten Leads von Startseite, Landing Pages und Wizard
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Aktualisieren
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-2">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-200 bg-red-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats?.hot || 0}</p>
            <p className="text-xs text-muted-foreground">Heiße Leads</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-200 bg-orange-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats?.warm || 0}</p>
            <p className="text-xs text-muted-foreground">Warme Leads</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats?.cold || 0}</p>
            <p className="text-xs text-muted-foreground">Kalte Leads</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats?.completed || 0}</p>
            <p className="text-xs text-muted-foreground">Abgeschlossen</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats?.withContact || 0}</p>
            <p className="text-xs text-muted-foreground">Mit Kontakt</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name, E-Mail, Telefon, Hersteller..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={qualityFilter} onValueChange={(v) => setQualityFilter(v as LeadQuality)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Lead-Qualität" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Qualitäten</SelectItem>
                <SelectItem value="hot">Heiß</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Kalt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as LeadSource)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Quelle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                <SelectItem value="hero_form">Startseite</SelectItem>
                <SelectItem value="hero_form_partial">Startseite (teilweise)</SelectItem>
                <SelectItem value="landing_page">Landing Page</SelectItem>
                <SelectItem value="landing_page_partial">Landing Page (teilweise)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filteredLeads?.length || 0} Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Qualität</TableHead>
                    <TableHead>Kontaktdaten</TableHead>
                    <TableHead>Fahrzeug</TableHead>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Wizard</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads?.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openLeadDetail(lead as unknown as Record<string, unknown>)}
                    >
                      <TableCell>{getQualityBadge(lead.lead_quality)}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {lead.name ? (
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {lead.name}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Kein Name</span>
                          )}
                          {lead.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {lead.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lead.manufacturer && (
                            <span className="font-medium">{lead.manufacturer}</span>
                          )}
                          {lead.model && (
                            <span className="text-muted-foreground"> {lead.model}</span>
                          )}
                          {lead.body_type && (
                            <div className="text-xs text-muted-foreground">{lead.body_type}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sourceLabels[lead.source || ""] || lead.source || "Unbekannt"}
                        </Badge>
                        {lead.page_url && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Globe className="w-3 h-3" />
                            {lead.page_url}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {(lead.max_wizard_step ?? 0) > 0 ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              Schritt {lead.max_wizard_step}/11
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {wizardStepNames[lead.max_wizard_step ?? 0] || "—"}
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary rounded-full h-1.5 transition-all"
                                style={{ width: `${((lead.max_wizard_step ?? 0) / 11) * 100}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.wizard_completed ? (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Abgeschlossen
                          </Badge>
                        ) : (lead.max_wizard_step ?? 0) > 0 ? (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Abgebrochen
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="w-3 h-3" />
                            Neu
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {lead.created_at
                            ? format(new Date(lead.created_at), "dd.MM.yy HH:mm", { locale: de })
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.notes && (
                          <StickyNote className="w-4 h-4 text-yellow-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredLeads || filteredLeads.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        Keine Leads gefunden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Lead Details
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6">
              {/* Quality & Status */}
              <div className="flex items-center gap-3">
                {getQualityBadge(selectedLead.lead_quality as string)}
                {selectedLead.wizard_completed ? (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle className="w-3 h-3" />
                    Wizard abgeschlossen
                  </Badge>
                ) : (selectedLead.max_wizard_step as number ?? 0) > 0 ? (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Wizard abgebrochen bei Schritt {selectedLead.max_wizard_step}
                  </Badge>
                ) : null}
              </div>

              {/* Contact Data */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Kontaktdaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{(selectedLead.name as string) || "Nicht angegeben"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">E-Mail</p>
                    {selectedLead.email ? (
                      <a href={`mailto:${selectedLead.email}`} className="font-medium text-primary hover:underline">
                        {selectedLead.email as string}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">Nicht angegeben</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefon</p>
                    {selectedLead.phone ? (
                      <a href={`tel:${selectedLead.phone}`} className="font-medium text-primary hover:underline">
                        {selectedLead.phone as string}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">Nicht angegeben</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Data */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Fahrzeugdaten</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Hersteller</p>
                    <p className="font-medium">{(selectedLead.manufacturer as string) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Modell</p>
                    <p className="font-medium">{(selectedLead.model as string) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Aufbauart</p>
                    <p className="font-medium">{(selectedLead.body_type as string) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Verkaufsweg</p>
                    <p className="font-medium">{(selectedLead.sale_channel as string) || "—"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Wizard Progress */}
              {(selectedLead.max_wizard_step as number ?? 0) > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Wizard-Fortschritt</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {wizardStepNames.slice(1).map((stepName, index) => {
                        const stepNum = index + 1;
                        const maxStep = selectedLead.max_wizard_step as number ?? 0;
                        const isCompleted = stepNum <= maxStep;
                        const isAbandoned = stepNum === maxStep && !selectedLead.wizard_completed;
                        return (
                          <div key={stepNum} className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isCompleted
                                ? isAbandoned
                                  ? "bg-orange-100 text-orange-600 border border-orange-300"
                                  : "bg-green-100 text-green-600 border border-green-300"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {isCompleted ? (isAbandoned ? "!" : "✓") : stepNum}
                            </div>
                            <span className={`text-sm ${isCompleted ? "font-medium" : "text-muted-foreground"}`}>
                              {stepNum}. {stepName}
                            </span>
                            {isAbandoned && !selectedLead.wizard_completed && (
                              <Badge variant="outline" className="text-xs text-orange-600">
                                Hier abgebrochen
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Source & Meta */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Herkunft</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Quelle</p>
                    <p className="font-medium">{sourceLabels[(selectedLead.source as string) || ""] || (selectedLead.source as string) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Seite</p>
                    <p className="font-medium">{(selectedLead.page_url as string) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Referrer</p>
                    <p className="font-medium text-sm truncate">{(selectedLead.referrer as string) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Erstellt am</p>
                    <p className="font-medium">
                      {selectedLead.created_at
                        ? format(new Date(selectedLead.created_at as string), "dd.MM.yyyy HH:mm:ss", { locale: de })
                        : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <StickyNote className="w-4 h-4" />
                    Admin-Notizen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Notizen zu diesem Lead hinzufügen..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      updateNotes.mutate({ id: selectedLead.id as string, notes: editNotes });
                    }}
                    disabled={updateNotes.isPending}
                  >
                    {updateNotes.isPending ? "Wird gespeichert..." : "Notiz speichern"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
