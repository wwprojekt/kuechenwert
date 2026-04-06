import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Shield,
  Clock,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Anmeldung", color: "bg-blue-500" },
  logout: { label: "Abmeldung", color: "bg-gray-500" },
  create: { label: "Erstellt", color: "bg-green-500" },
  update: { label: "Aktualisiert", color: "bg-yellow-500" },
  delete: { label: "Gelöscht", color: "bg-red-500" },
  export: { label: "Exportiert", color: "bg-purple-500" },
  email_sent: { label: "E-Mail gesendet", color: "bg-teal-500" },
  email_broadcast: { label: "Broadcast", color: "bg-teal-600" },
  bid_placed: { label: "Gebot abgegeben", color: "bg-blue-600" },
  auction_created: { label: "Auktion erstellt", color: "bg-green-600" },
  auction_closed: { label: "Auktion geschlossen", color: "bg-orange-500" },
  auction_activated: { label: "Auktion aktiviert", color: "bg-green-500" },
  user_suspended: { label: "Benutzer gesperrt", color: "bg-red-600" },
  user_unsuspended: { label: "Benutzer entsperrt", color: "bg-green-600" },
  dealer_approved: { label: "Händler genehmigt", color: "bg-green-500" },
  dealer_rejected: { label: "Händler abgelehnt", color: "bg-red-500" },
  invoice_created: { label: "Rechnung erstellt", color: "bg-blue-500" },
  payment_received: { label: "Zahlung erhalten", color: "bg-green-500" },
  settings_changed: { label: "Einstellungen geändert", color: "bg-yellow-600" },
  push_notification_sent: { label: "Push gesendet", color: "bg-purple-600" },
};

const ENTITY_LABELS: Record<string, string> = {
  user: "Benutzer",
  auction: "Auktion",
  bid: "Gebot",
  motorhome: "Wohnmobil",
  dealer: "Händler",
  invoice: "Rechnung",
  email: "E-Mail",
  settings: "Einstellungen",
  notification: "Benachrichtigung",
  lead: "Lead",
};

const PAGE_SIZE = 50;

export default function AdminAuditLog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["adminAuditLogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch user profiles for display
  const { data: profiles } = useQuery({
    queryKey: ["auditLogProfiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email");

      if (error) throw error;
      return data;
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, any> = {};
    profiles?.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [profiles]);

  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    return auditLogs.filter((log: any) => {
      const matchesSearch =
        !searchTerm ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profileMap[log.user_id]?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profileMap[log.user_id]?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profileMap[log.user_id]?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;

      return matchesSearch && matchesAction && matchesEntity;
    });
  }, [auditLogs, searchTerm, actionFilter, entityFilter, profileMap]);

  const paginatedLogs = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);

  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "audit_log",
    columns: [
      { key: "created_at", label: "Zeitpunkt", format: (v: any) => v ? new Date(v).toLocaleString("de-DE") : "" },
      { key: "user_id", label: "Benutzer", format: (v: any) => {
        const p = profileMap[v];
        return p ? `${p.first_name} ${p.last_name} (${p.email})` : v || "";
      }},
      { key: "action", label: "Aktion", format: (v: any) => ACTION_LABELS[v]?.label || v },
      { key: "entity_type", label: "Entität", format: (v: any) => ENTITY_LABELS[v] || v },
      { key: "entity_id", label: "Entitäts-ID" },
      { key: "details", label: "Details", format: (v: any) => v ? JSON.stringify(v) : "" },
      { key: "ip_address", label: "IP-Adresse" },
    ],
  });

  const uniqueActions = useMemo(() => {
    if (!auditLogs) return [];
    return [...new Set(auditLogs.map((l: any) => l.action))].sort();
  }, [auditLogs]);

  const uniqueEntities = useMemo(() => {
    if (!auditLogs) return [];
    return [...new Set(auditLogs.map((l: any) => l.entity_type))].sort();
  }, [auditLogs]);

  const getUserDisplay = (userId: string) => {
    const p = profileMap[userId];
    if (p) return `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email;
    return userId?.substring(0, 8) + "...";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Audit-Log
          </h1>
          <p className="text-muted-foreground">
            Alle Aktionen und Änderungen auf der Plattform nachverfolgen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Activity className="w-3 h-3 mr-1" />
            {filteredLogs.length} Einträge
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nach Benutzer, Aktion oder ID suchen..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Aktion filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Aktionen</SelectItem>
              {uniqueActions.map((action) => (
                <SelectItem key={action} value={action}>
                  {ACTION_LABELS[action]?.label || action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Entität filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Entitäten</SelectItem>
              {uniqueEntities.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {ENTITY_LABELS[entity] || entity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportButton
            onExportCSV={() => exportCSV(filteredLogs)}
            onExportExcel={() => exportExcel(filteredLogs)}
            isExporting={isExporting}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="border-2 hover:border-primary/20 transition-smooth overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Zeitpunkt</TableHead>
              <TableHead>Benutzer</TableHead>
              <TableHead>Aktion</TableHead>
              <TableHead>Entität</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Lädt...
                </TableCell>
              </TableRow>
            ) : paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Keine Audit-Log-Einträge gefunden
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((log: any) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-500" };
                return (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(log.created_at), "dd.MM.yyyy HH:mm:ss", { locale: de })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {getUserDisplay(log.user_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${actionInfo.color} text-white text-xs`}>
                        {actionInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        {log.entity_id ? log.entity_id.substring(0, 8) + "..." : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setShowDetailDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {page + 1} von {totalPages} ({filteredLogs.length} Einträge)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              Weiter
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Audit-Log Detail
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Zeitpunkt</p>
                  <p className="text-sm font-medium">
                    {format(new Date(selectedLog.created_at), "dd.MM.yyyy HH:mm:ss", { locale: de })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Benutzer</p>
                  <p className="text-sm font-medium">{getUserDisplay(selectedLog.user_id)}</p>
                  {profileMap[selectedLog.user_id]?.email && (
                    <p className="text-xs text-muted-foreground">{profileMap[selectedLog.user_id].email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Aktion</p>
                  <Badge className={`${(ACTION_LABELS[selectedLog.action] || { color: "bg-gray-500" }).color} text-white`}>
                    {ACTION_LABELS[selectedLog.action]?.label || selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Entität</p>
                  <p className="text-sm font-medium">
                    {ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type}
                  </p>
                </div>
                {selectedLog.entity_id && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Entitäts-ID</p>
                    <p className="text-sm font-mono bg-muted p-2 rounded">{selectedLog.entity_id}</p>
                  </div>
                )}
                {selectedLog.ip_address && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">IP-Adresse</p>
                    <p className="text-sm font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}
                {selectedLog.user_agent && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">User Agent</p>
                    <p className="text-xs font-mono bg-muted p-2 rounded break-all">{selectedLog.user_agent}</p>
                  </div>
                )}
              </div>
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Details</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48 font-mono">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
