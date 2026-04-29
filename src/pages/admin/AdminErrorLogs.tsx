/**
 * Admin Error Logs Dashboard (Erweitert)
 * 
 * Zeigt ALLE geloggten Fehler detailliert an:
 * - Gefangene Fehler, ungefangene JS-Fehler, Promise-Rejections, ErrorBoundary-Crashes
 * - Breadcrumbs (letzte Aktionen des Users vor dem Fehler)
 * - Session-Tracking, Device-Details, Netzwerk-Info
 * - Fehler-Gruppierung nach Hash (gleiche Fehler zusammengefasst)
 * - Zeitfilter, Trend-Anzeige, Occurrence-Count
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Shield,
  Bug,
  Globe,
  User,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  Loader2,
  RotateCcw,
  Activity,
  Layers,
  Wifi,
  WifiOff,
  Zap,
  Hash,
  ArrowUpRight,
  Copy,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Calendar,
  Fingerprint,
  Navigation,
  MousePointer,
  Server,
  MemoryStick,
  ScreenShare,
  Download,
  FileText,
} from "lucide-react";

// Types
interface ErrorLog {
  id: string;
  error_code: string;
  error_message: string;
  error_category: string;
  severity: string;
  page_url: string;
  page_path: string;
  page_title: string | null;
  component_name: string | null;
  user_id: string | null;
  user_role: string | null;
  user_email: string | null;
  stack_trace: string | null;
  original_error: string | null;
  metadata: Record<string, unknown>;
  user_agent: string | null;
  browser: string | null;
  device_type: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  // New fields
  error_hash: string | null;
  session_id: string | null;
  app_version: string | null;
  http_status: number | null;
  request_info: Record<string, unknown> | null;
  breadcrumbs: Array<{ type: string; message: string; timestamp: number; data?: Record<string, unknown> }> | null;
  occurrence_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  environment: string | null;
  error_source: string | null;
  screen_resolution: string | null;
  connection_type: string | null;
  memory_usage: Record<string, unknown> | null;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  critical: number;
  today: number;
  thisWeek: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  totalOccurrences: number;
}

const ITEMS_PER_PAGE = 25;

const AdminErrorLogs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats>({
    total: 0,
    unresolved: 0,
    critical: 0,
    today: 0,
    thisWeek: 0,
    byCategory: {},
    bySource: {},
    totalOccurrences: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [detailTab, setDetailTab] = useState("overview");
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Bulk Action State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'selected' | 'all' | 'single'>('selected');
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkResolving, setIsBulkResolving] = useState(false);
  const [isBulkUnresolving, setIsBulkUnresolving] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  // Clear selection when page or filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, categoryFilter, severityFilter, statusFilter, roleFilter, sourceFilter, timeFilter, searchQuery]);

  // Selection helpers
  const allOnPageSelected = errors.length > 0 && errors.every(e => selectedIds.has(e.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(errors.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Time filter helper
  const getTimeFilterDate = useCallback((): string | null => {
    const now = new Date();
    switch (timeFilter) {
      case 'hour': return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      case 'today': { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default: return null;
    }
  }, [timeFilter]);

  // Fetch error logs
  const fetchErrors = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('error_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      // Business-Events ausschließen: Normale Geschäftsvorgänge sind keine echten Fehler
      // 1. Auktions-Benachrichtigungen (überboten, Gebote, Auktion beendet)
      query = query.not('error_message', 'ilike', '%Sie wurden überboten%');
      query = query.not('error_message', 'ilike', '%Neues Gebot%');
      query = query.not('error_message', 'ilike', '%Bieten Sie erneut%');
      query = query.not('error_message', 'ilike', '%Gebot fehlgeschlagen%');
      query = query.not('error_message', 'ilike', '%Gebot muss höher%');
      query = query.not('error_message', 'ilike', '%Gebot muss mindestens%');
      query = query.not('error_message', 'ilike', '%Auktion ist nicht mehr aktiv%');
      query = query.not('error_message', 'ilike', '%Auktion ist bereits beendet%');
      // 2. Auth-Hinweise (keine echten Fehler, sondern User-Aktionen)
      query = query.not('error_message', 'ilike', '%Anmeldung erforderlich%');
      query = query.not('error_message', 'ilike', '%Sitzung abgelaufen%');
      query = query.not('error_message', 'ilike', '%Bitte melden Sie sich an%');
      query = query.not('error_message', 'ilike', '%Ihre Sitzung ist abgelaufen%');

      // Apply filters
      if (categoryFilter !== 'all') query = query.eq('error_category', categoryFilter);
      if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
      if (statusFilter === 'resolved') query = query.eq('is_resolved', true);
      else if (statusFilter === 'unresolved') query = query.eq('is_resolved', false);
      if (roleFilter !== 'all') query = query.eq('user_role', roleFilter);
      if (sourceFilter !== 'all') query = query.eq('error_source', sourceFilter);
      
      const timeDate = getTimeFilterDate();
      if (timeDate) query = query.gte('created_at', timeDate);

      if (searchQuery.trim()) {
        query = query.or(
          `error_message.ilike.%${searchQuery}%,error_code.ilike.%${searchQuery}%,page_path.ilike.%${searchQuery}%,original_error.ilike.%${searchQuery}%,user_email.ilike.%${searchQuery}%,session_id.ilike.%${searchQuery}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setErrors(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching error logs:', error);
      toast({
        title: "Fehler",
        description: "Fehlerprotokolle konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, categoryFilter, severityFilter, statusFilter, roleFilter, sourceFilter, timeFilter, searchQuery, toast, getTimeFilterDate]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Business-Events-Filter: Normale Geschäftsvorgänge aus Statistiken ausschließen
      const excludeBusinessEvents = (q: any) => {
        return q
          // Auktions-Benachrichtigungen
          .not('error_message', 'ilike', '%Sie wurden überboten%')
          .not('error_message', 'ilike', '%Neues Gebot%')
          .not('error_message', 'ilike', '%Bieten Sie erneut%')
          .not('error_message', 'ilike', '%Gebot fehlgeschlagen%')
          .not('error_message', 'ilike', '%Gebot muss höher%')
          .not('error_message', 'ilike', '%Gebot muss mindestens%')
          .not('error_message', 'ilike', '%Auktion ist nicht mehr aktiv%')
          .not('error_message', 'ilike', '%Auktion ist bereits beendet%')
          // Auth-Hinweise
          .not('error_message', 'ilike', '%Anmeldung erforderlich%')
          .not('error_message', 'ilike', '%Sitzung abgelaufen%')
          .not('error_message', 'ilike', '%Bitte melden Sie sich an%')
          .not('error_message', 'ilike', '%Ihre Sitzung ist abgelaufen%');
      };

      const [totalRes, unresolvedRes, criticalRes, todayRes, weekRes] = await Promise.all([
        excludeBusinessEvents(supabase.from('error_logs').select('id', { count: 'exact', head: true })),
        excludeBusinessEvents(supabase.from('error_logs').select('id', { count: 'exact', head: true }).eq('is_resolved', false)),
        excludeBusinessEvents(supabase.from('error_logs').select('id', { count: 'exact', head: true }).eq('severity', 'critical').eq('is_resolved', false)),
        excludeBusinessEvents(supabase.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString())),
        excludeBusinessEvents(supabase.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString())),
      ]);

      // Category + Source breakdown for unresolved (ohne Business-Events)
      const { data: unresolvedData } = await excludeBusinessEvents(
        supabase
          .from('error_logs')
          .select('error_category, error_source, occurrence_count')
          .eq('is_resolved', false)
      );

      const byCategory: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      let totalOccurrences = 0;
      unresolvedData?.forEach(row => {
        byCategory[row.error_category] = (byCategory[row.error_category] || 0) + 1;
        if (row.error_source) {
          bySource[row.error_source] = (bySource[row.error_source] || 0) + 1;
        }
        totalOccurrences += (row.occurrence_count || 1);
      });

      setStats({
        total: totalRes.count || 0,
        unresolved: unresolvedRes.count || 0,
        critical: criticalRes.count || 0,
        today: todayRes.count || 0,
        thisWeek: weekRes.count || 0,
        byCategory,
        bySource,
        totalOccurrences,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
    fetchStats();
  }, [fetchErrors, fetchStats]);

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleResolve = async (errorId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          admin_notes: notes || null,
        })
        .eq('id', errorId);
      if (error) throw error;
      toast({ title: "Erledigt", description: "Fehler wurde als gelöst markiert." });
      fetchErrors();
      fetchStats();
      setShowDetailDialog(false);
    } catch (error) {
      toast({ title: "Fehler", description: "Status konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const handleUnresolve = async (errorId: string) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({ is_resolved: false, resolved_at: null, resolved_by: null })
        .eq('id', errorId);
      if (error) throw error;
      toast({ title: "Status zurückgesetzt" });
      fetchErrors();
      fetchStats();
    } catch (error) {
      toast({ title: "Fehler", description: "Status konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const handleBulkResolve = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkResolving(true);
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id, admin_notes: 'Bulk-Auflösung' })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      toast({ title: "Erledigt", description: `${selectedIds.size} Fehler wurden als gelöst markiert.` });
      setSelectedIds(new Set());
      fetchErrors();
      fetchStats();
    } catch (error) {
      toast({ title: "Fehler", description: "Bulk-Auflösung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setIsBulkResolving(false);
    }
  };

  const handleBulkUnresolve = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkUnresolving(true);
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({ is_resolved: false, resolved_at: null, resolved_by: null })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      toast({ title: "Erledigt", description: `${selectedIds.size} Fehler wurden als ungelöst markiert.` });
      setSelectedIds(new Set());
      fetchErrors();
      fetchStats();
    } catch (error) {
      toast({ title: "Fehler", description: "Status konnte nicht aktualisiert werden.", variant: "destructive" });
    } finally {
      setIsBulkUnresolving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      let idsToDelete: string[] = [];

      if (deleteTarget === 'single' && singleDeleteId) {
        idsToDelete = [singleDeleteId];
      } else if (deleteTarget === 'selected') {
        idsToDelete = Array.from(selectedIds);
      } else if (deleteTarget === 'all') {
        let query = supabase.from('error_logs').delete();
        if (categoryFilter !== 'all') query = query.eq('error_category', categoryFilter);
        if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
        if (statusFilter === 'resolved') query = query.eq('is_resolved', true);
        else if (statusFilter === 'unresolved') query = query.eq('is_resolved', false);
        if (roleFilter !== 'all') query = query.eq('user_role', roleFilter);
        if (sourceFilter !== 'all') query = query.eq('error_source', sourceFilter);
        const timeDate = getTimeFilterDate();
        if (timeDate) query = query.gte('created_at', timeDate);
        if (searchQuery.trim()) {
          query = query.or(`error_message.ilike.%${searchQuery}%,error_code.ilike.%${searchQuery}%,page_path.ilike.%${searchQuery}%,original_error.ilike.%${searchQuery}%`);
        }
        if (categoryFilter === 'all' && severityFilter === 'all' && statusFilter === 'all' && roleFilter === 'all' && sourceFilter === 'all' && !searchQuery.trim() && !timeDate) {
          query = query.gte('created_at', '2000-01-01');
        }
        const { error } = await query;
        if (error) throw error;
        toast({ title: "Gelöscht", description: "Alle gefilterten Fehlerprotokolle wurden gelöscht." });
        setSelectedIds(new Set());
        setShowDeleteDialog(false);
        fetchErrors();
        fetchStats();
        setIsDeleting(false);
        return;
      }

      if (idsToDelete.length > 0) {
        const { error } = await supabase.from('error_logs').delete().in('id', idsToDelete);
        if (error) throw error;
        toast({ title: "Gelöscht", description: `${idsToDelete.length} Fehlerprotokoll${idsToDelete.length > 1 ? 'e' : ''} gelöscht.` });
      }

      setSelectedIds(new Set());
      setSingleDeleteId(null);
      setShowDeleteDialog(false);
      setShowDetailDialog(false);
      fetchErrors();
      fetchStats();
    } catch (error) {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedError) return;
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({ admin_notes: adminNotes || null })
        .eq('id', selectedError.id);
      if (error) throw error;
      toast({ title: "Gespeichert", description: "Admin-Notizen wurden aktualisiert." });
      fetchErrors();
    } catch (error) {
      toast({ title: "Fehler", description: "Notizen konnten nicht gespeichert werden.", variant: "destructive" });
    }
  };

  // ============================================================================
  // Badge/Display Helpers
  // ============================================================================

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      low: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Niedrig' },
      medium: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', label: 'Mittel' },
      high: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', label: 'Hoch' },
      critical: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Kritisch' },
    };
    const v = variants[severity] || variants.low;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${v.color}`}>{v.label}</span>;
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      validation: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', label: 'Validierung', icon: <Shield className="w-3 h-3" /> },
      auth: { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', label: 'Auth', icon: <User className="w-3 h-3" /> },
      api: { color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300', label: 'API', icon: <Globe className="w-3 h-3" /> },
      business: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', label: 'Geschäftslogik', icon: <AlertCircle className="w-3 h-3" /> },
      system: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200', label: 'System', icon: <Bug className="w-3 h-3" /> },
      ui: { color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300', label: 'UI', icon: <Monitor className="w-3 h-3" /> },
      unknown: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', label: 'Unbekannt', icon: <AlertCircle className="w-3 h-3" /> },
    };
    const v = variants[category] || variants.unknown;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${v.color}`}>{v.icon}{v.label}</span>;
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return null;
    const variants: Record<string, string> = {
      customer: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      dealer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      anonymous: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    };
    const labels: Record<string, string> = { customer: 'Kunde', dealer: 'Händler', admin: 'Admin', anonymous: 'Anonym' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[role] || variants.anonymous}`}>{labels[role] || role}</span>;
  };

  const getSourceBadge = (source: string | null) => {
    if (!source) return null;
    const variants: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      caught: { color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400', label: 'Gefangen', icon: <CheckCircle2 className="w-3 h-3" /> },
      uncaught: { color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400', label: 'Ungefangen', icon: <XCircle className="w-3 h-3" /> },
      'unhandled-rejection': { color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400', label: 'Promise-Rejection', icon: <Zap className="w-3 h-3" /> },
      'error-boundary': { color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400', label: 'ErrorBoundary', icon: <Shield className="w-3 h-3" /> },
      global: { color: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400', label: 'Global', icon: <Globe className="w-3 h-3" /> },
    };
    const v = variants[source] || variants.caught;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${v.color}`}>{v.icon}{v.label}</span>;
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-4 h-4 text-muted-foreground" />;
      case 'tablet': return <Tablet className="w-4 h-4 text-muted-foreground" />;
      default: return <Monitor className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
    return formatDate(dateStr);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Kopiert", description: "In die Zwischenablage kopiert." });
  };

  // ============================================================================
  // Markdown Export
  // ============================================================================

  const [isExportingMd, setIsExportingMd] = useState(false);

  const exportMarkdown = async () => {
    setIsExportingMd(true);
    try {
      // Alle Fehler laden (nicht nur die aktuelle Seite) mit aktuellen Filtern
      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (categoryFilter !== 'all') query = query.eq('error_category', categoryFilter);
      if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
      if (statusFilter === 'resolved') query = query.eq('is_resolved', true);
      else if (statusFilter === 'unresolved') query = query.eq('is_resolved', false);
      if (roleFilter !== 'all') query = query.eq('user_role', roleFilter);
      if (sourceFilter !== 'all') query = query.eq('error_source', sourceFilter);
      const timeDate = getTimeFilterDate();
      if (timeDate) query = query.gte('created_at', timeDate);
      if (searchQuery.trim()) {
        query = query.or(
          `error_message.ilike.%${searchQuery}%,error_code.ilike.%${searchQuery}%,page_path.ilike.%${searchQuery}%,original_error.ilike.%${searchQuery}%,user_email.ilike.%${searchQuery}%,session_id.ilike.%${searchQuery}%`
        );
      }

      const { data: allErrors, error } = await query;
      if (error) throw error;
      if (!allErrors || allErrors.length === 0) {
        toast({ title: "Keine Daten", description: "Es gibt keine Fehler zum Exportieren.", variant: "destructive" });
        return;
      }

      const severityLabels: Record<string, string> = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch' };
      const categoryLabels: Record<string, string> = { validation: 'Validierung', auth: 'Auth', api: 'API', business: 'Geschäftslogik', system: 'System', ui: 'UI', unknown: 'Unbekannt' };
      const sourceLabels: Record<string, string> = { caught: 'Gefangen', uncaught: 'Ungefangen', 'unhandled-rejection': 'Promise-Rejection', 'error-boundary': 'ErrorBoundary', global: 'Global' };
      const roleLabels: Record<string, string> = { customer: 'Kunde', dealer: 'Händler', admin: 'Admin', anonymous: 'Anonym' };

      const now = new Date();
      const exportDate = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      // Statistiken berechnen
      const totalExport = allErrors.length;
      const unresolvedExport = allErrors.filter(e => !e.is_resolved).length;
      const criticalExport = allErrors.filter(e => e.severity === 'critical' && !e.is_resolved).length;
      const highExport = allErrors.filter(e => e.severity === 'high' && !e.is_resolved).length;

      // Aktive Filter beschreiben
      const activeFilters: string[] = [];
      if (categoryFilter !== 'all') activeFilters.push(`Kategorie: ${categoryLabels[categoryFilter] || categoryFilter}`);
      if (severityFilter !== 'all') activeFilters.push(`Schweregrad: ${severityLabels[severityFilter] || severityFilter}`);
      if (statusFilter !== 'all') activeFilters.push(`Status: ${statusFilter === 'resolved' ? 'Gelöst' : 'Ungelöst'}`);
      if (roleFilter !== 'all') activeFilters.push(`Rolle: ${roleLabels[roleFilter] || roleFilter}`);
      if (sourceFilter !== 'all') activeFilters.push(`Quelle: ${sourceLabels[sourceFilter] || sourceFilter}`);
      if (timeFilter !== 'all') {
        const timeLabels: Record<string, string> = { hour: 'Letzte Stunde', today: 'Heute', week: 'Diese Woche', month: 'Dieser Monat' };
        activeFilters.push(`Zeitraum: ${timeLabels[timeFilter] || timeFilter}`);
      }
      if (searchQuery.trim()) activeFilters.push(`Suche: "${searchQuery}"`);

      let md = `# Fehlerprotokoll - KüchenWert\n\n`;
      md += `**Exportiert am:** ${exportDate}\n\n`;
      if (activeFilters.length > 0) {
        md += `**Aktive Filter:** ${activeFilters.join(' | ')}\n\n`;
      }
      md += `## Zusammenfassung\n\n`;
      md += `| Metrik | Wert |\n`;
      md += `|--------|------|\n`;
      md += `| Fehler gesamt | ${totalExport} |\n`;
      md += `| Ungelöst | ${unresolvedExport} |\n`;
      md += `| Kritisch (ungelöst) | ${criticalExport} |\n`;
      md += `| Hoch (ungelöst) | ${highExport} |\n`;
      md += `| Gelöst | ${totalExport - unresolvedExport} |\n\n`;
      md += `---\n\n`;

      // Übersichtstabelle
      md += `## Fehlerübersicht\n\n`;
      md += `| Nr. | Datum | Schweregrad | Kategorie | Seite | Fehlermeldung | Status |\n`;
      md += `|-----|-------|-------------|-----------|-------|---------------|--------|\n`;
      allErrors.forEach((err, i) => {
        const date = new Date(err.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const sev = severityLabels[err.severity] || err.severity;
        const cat = categoryLabels[err.error_category] || err.error_category;
        const msg = (err.error_message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').substring(0, 80);
        const status = err.is_resolved ? 'Gelöst' : 'Offen';
        const page = (err.page_path || '').replace(/\|/g, '\\|');
        md += `| ${i + 1} | ${date} | ${sev} | ${cat} | ${page} | ${msg} | ${status} |\n`;
      });
      md += `\n---\n\n`;

      // Detaillierte Fehler
      md += `## Detaillierte Fehlerberichte\n\n`;
      allErrors.forEach((err, i) => {
        const date = new Date(err.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const sev = severityLabels[err.severity] || err.severity;
        const cat = categoryLabels[err.error_category] || err.error_category;
        const src = sourceLabels[err.error_source || ''] || err.error_source || 'Unbekannt';
        const role = roleLabels[err.user_role || ''] || err.user_role || 'Unbekannt';

        md += `### ${i + 1}. ${err.error_code} — ${sev}\n\n`;

        // Basis-Infos
        md += `| Feld | Wert |\n`;
        md += `|------|------|\n`;
        md += `| **ID** | \`${err.id}\` |\n`;
        md += `| **Fehlercode** | ${err.error_code} |\n`;
        md += `| **Schweregrad** | ${sev} |\n`;
        md += `| **Kategorie** | ${cat} |\n`;
        md += `| **Quelle** | ${src} |\n`;
        md += `| **Status** | ${err.is_resolved ? 'Gelöst' : 'Offen'} |\n`;
        md += `| **Erstmals aufgetreten** | ${err.first_seen_at ? new Date(err.first_seen_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : date} |\n`;
        md += `| **Zuletzt aufgetreten** | ${err.last_seen_at ? new Date(err.last_seen_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : date} |\n`;
        md += `| **Vorfälle** | ${err.occurrence_count || 1} |\n`;
        if (err.error_hash) md += `| **Fehler-Hash** | \`${err.error_hash}\` |\n`;
        if (err.session_id) md += `| **Session-ID** | \`${err.session_id}\` |\n`;
        if (err.app_version) md += `| **App-Version** | ${err.app_version} |\n`;
        if (err.environment) md += `| **Umgebung** | ${err.environment} |\n`;
        md += `\n`;

        // Fehlermeldung
        md += `**Angezeigte Fehlermeldung (Deutsch):**\n\n`;
        md += `> ${(err.error_message || '').replace(/\n/g, '\n> ')}\n\n`;

        if (err.original_error && err.original_error !== err.error_message) {
          md += `**Original-Fehlermeldung (technisch):**\n\n`;
          md += `\`\`\`\n${err.original_error}\n\`\`\`\n\n`;
        }

        // Seiten-Info
        md += `**Seite & Nutzer:**\n\n`;
        md += `| Feld | Wert |\n`;
        md += `|------|------|\n`;
        md += `| **Seite** | ${err.page_path || '-'} |\n`;
        if (err.page_title) md += `| **Seitentitel** | ${err.page_title} |\n`;
        if (err.component_name) md += `| **Komponente** | ${err.component_name} |\n`;
        md += `| **Nutzer** | ${err.user_email || role} |\n`;
        md += `| **Rolle** | ${role} |\n`;
        if (err.page_url) md += `| **Volle URL** | ${err.page_url.replace(/\|/g, '\\|')} |\n`;
        md += `\n`;

        // Gerät & Netzwerk
        if (err.device_type || err.browser || err.screen_resolution || err.connection_type) {
          md += `**Gerät & Netzwerk:**\n\n`;
          md += `| Feld | Wert |\n`;
          md += `|------|------|\n`;
          if (err.device_type) md += `| **Gerät** | ${err.device_type} |\n`;
          if (err.browser) md += `| **Browser** | ${err.browser} |\n`;
          if (err.screen_resolution) md += `| **Bildschirm** | ${err.screen_resolution} |\n`;
          if (err.connection_type) md += `| **Verbindung** | ${err.connection_type} |\n`;
          if (err.user_agent) md += `| **User-Agent** | ${err.user_agent.replace(/\|/g, '\\|').substring(0, 120)} |\n`;
          md += `\n`;
        }

        // Memory
        if (err.memory_usage && Object.keys(err.memory_usage).length > 0) {
          md += `**Speicher:**\n\n`;
          md += `\`\`\`json\n${JSON.stringify(err.memory_usage, null, 2)}\n\`\`\`\n\n`;
        }

        // HTTP-Status & Request-Info
        if (err.http_status || (err.request_info && Object.keys(err.request_info).length > 0)) {
          md += `**Request-Info:**\n\n`;
          if (err.http_status) md += `- HTTP-Status: ${err.http_status}\n`;
          if (err.request_info) md += `\`\`\`json\n${JSON.stringify(err.request_info, null, 2)}\n\`\`\`\n`;
          md += `\n`;
        }

        // Stack Trace
        if (err.stack_trace) {
          md += `**Stack-Trace:**\n\n`;
          md += `\`\`\`\n${err.stack_trace}\n\`\`\`\n\n`;
        }

        // Metadata
        if (err.metadata && Object.keys(err.metadata).length > 0) {
          md += `**Metadata:**\n\n`;
          md += `\`\`\`json\n${JSON.stringify(err.metadata, null, 2)}\n\`\`\`\n\n`;
        }

        // Breadcrumbs
        if (err.breadcrumbs && err.breadcrumbs.length > 0) {
          md += `**Breadcrumbs (${err.breadcrumbs.length} Aktionen vor dem Fehler):**\n\n`;
          md += `| Nr. | Typ | Nachricht | Zeitstempel |\n`;
          md += `|-----|-----|-----------|-------------|\n`;
          err.breadcrumbs.forEach((bc, j) => {
            const ts = bc.timestamp ? new Date(bc.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
            const msg = (bc.message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
            md += `| ${j + 1} | ${bc.type || '-'} | ${msg} | ${ts} |\n`;
          });
          md += `\n`;
        }

        // Resolution Info
        if (err.is_resolved) {
          md += `**Lösung:**\n\n`;
          md += `- Gelöst am: ${err.resolved_at ? new Date(err.resolved_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}\n`;
          if (err.resolved_by) md += `- Gelöst von: ${err.resolved_by}\n`;
          if (err.admin_notes) md += `- Admin-Notizen: ${err.admin_notes}\n`;
          md += `\n`;
        } else if (err.admin_notes) {
          md += `**Admin-Notizen:** ${err.admin_notes}\n\n`;
        }

        md += `---\n\n`;
      });

      // Footer
      md += `\n*Generiert von KüchenWert Admin — ${exportDate}*\n`;

      // Download
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fehlerprotokoll_${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export erfolgreich",
        description: `${allErrors.length} Fehler als Markdown exportiert.`,
      });
    } catch (error) {
      console.error('Markdown export error:', error);
      toast({
        title: "Export fehlgeschlagen",
        description: "Beim Exportieren ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsExportingMd(false);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const selectedResolved = errors.filter(e => selectedIds.has(e.id) && e.is_resolved).length;
  const selectedUnresolved = errors.filter(e => selectedIds.has(e.id) && !e.is_resolved).length;

  // Active filter count for badge
  const activeFilterCount = [
    categoryFilter !== 'all',
    severityFilter !== 'all',
    statusFilter !== 'all',
    roleFilter !== 'all',
    sourceFilter !== 'all',
    timeFilter !== 'all',
    searchQuery.trim() !== '',
  ].filter(Boolean).length;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            Fehlerprotokoll
          </h1>
          <p className="text-muted-foreground mt-1">
            Alle Fehler werden hier protokolliert - gefangene, ungefangene und System-Fehler.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchErrors(); fetchStats(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
          {totalCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportMarkdown}
              disabled={isExportingMd}
            >
              {isExportingMd ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Export .md
            </Button>
          )}
          {totalCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setDeleteTarget('all'); setShowDeleteDialog(true); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Alle löschen
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Ungelöst</p>
                <p className="text-2xl font-bold text-orange-600">{stats.unresolved}</p>
              </div>
              <Clock className="w-6 h-6 text-orange-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Kritisch</p>
                <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              </div>
              <XCircle className="w-6 h-6 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Heute</p>
                <p className="text-2xl font-bold text-blue-600">{stats.today}</p>
              </div>
              <Calendar className="w-6 h-6 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Diese Woche</p>
                <p className="text-2xl font-bold text-purple-600">{stats.thisWeek}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Vorfälle gesamt</p>
                <p className="text-2xl font-bold text-gray-600">{stats.totalOccurrences}</p>
              </div>
              <Layers className="w-6 h-6 text-gray-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category & Source Breakdown */}
      {(Object.keys(stats.byCategory).length > 0 || Object.keys(stats.bySource).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.keys(stats.byCategory).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Ungelöste Fehler nach Kategorie</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <button
                      key={cat}
                      onClick={() => { setCategoryFilter(cat); setStatusFilter('unresolved'); setPage(0); }}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      {getCategoryBadge(cat)}
                      <span className="text-sm font-semibold">{count}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {Object.keys(stats.bySource).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Ungelöste Fehler nach Quelle</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                    <button
                      key={src}
                      onClick={() => { setSourceFilter(src); setStatusFilter('unresolved'); setPage(0); }}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      {getSourceBadge(src)}
                      <span className="text-sm font-semibold">{count}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Suche in Fehlern, E-Mails, Sessions..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={timeFilter} onValueChange={(v) => { setTimeFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Zeitraum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Zeiten</SelectItem>
                <SelectItem value="hour">Letzte Stunde</SelectItem>
                <SelectItem value="today">Heute</SelectItem>
                <SelectItem value="week">Diese Woche</SelectItem>
                <SelectItem value="month">Dieser Monat</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                <SelectItem value="validation">Validierung</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="business">Geschäftslogik</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="ui">UI</SelectItem>
                <SelectItem value="unknown">Unbekannt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Schweregrad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Schweregrade</SelectItem>
                <SelectItem value="critical">Kritisch</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="unresolved">Ungelöst</SelectItem>
                <SelectItem value="resolved">Gelöst</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Quelle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                <SelectItem value="caught">Gefangen</SelectItem>
                <SelectItem value="uncaught">Ungefangen</SelectItem>
                <SelectItem value="unhandled-rejection">Promise-Rejection</SelectItem>
                <SelectItem value="error-boundary">ErrorBoundary</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Rolle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Rollen</SelectItem>
                <SelectItem value="customer">Kunde</SelectItem>
                <SelectItem value="dealer">Händler</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="anonymous">Anonym</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{totalCount} Ergebnisse</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCategoryFilter('all'); setSeverityFilter('all'); setStatusFilter('all');
                  setRoleFilter('all'); setSourceFilter('all'); setTimeFilter('all');
                  setSearchQuery(''); setPage(0);
                }}
              >
                Filter zurücksetzen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="sticky top-0 z-50 bg-primary text-primary-foreground rounded-lg p-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allOnPageSelected}
              onCheckedChange={toggleSelectAll}
              className="border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
            />
            <span className="font-medium">{selectedIds.size} ausgewählt</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedUnresolved > 0 && (
              <Button size="sm" variant="secondary" onClick={handleBulkResolve} disabled={isBulkResolving}>
                {isBulkResolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Als gelöst ({selectedUnresolved})
              </Button>
            )}
            {selectedResolved > 0 && (
              <Button size="sm" variant="secondary" onClick={handleBulkUnresolve} disabled={isBulkUnresolving}>
                {isBulkUnresolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Als ungelöst ({selectedResolved})
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="text-red-600 hover:text-red-700"
              onClick={() => { setDeleteTarget('selected'); setShowDeleteDialog(true); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Löschen ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Error List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Lade Fehlerprotokolle...</span>
            </div>
          ) : errors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
              <p className="text-lg font-medium text-foreground">Keine Fehler gefunden</p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeFilterCount > 0 ? 'Versuchen Sie andere Filtereinstellungen.' : 'Es wurden noch keine Fehler protokolliert.'}
              </p>
            </div>
          ) : (
            <>
              {/* Select All Header */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
                <Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAll} />
                <span className="text-xs text-muted-foreground">
                  {allOnPageSelected ? 'Alle abwählen' : 'Alle auf dieser Seite auswählen'}
                </span>
              </div>

              <div className="divide-y divide-border">
                {errors.map((err) => (
                  <div
                    key={err.id}
                    className={`flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors ${
                      err.is_resolved ? 'opacity-60' : ''
                    } ${err.severity === 'critical' ? 'border-l-4 border-l-red-500' : ''} ${
                      selectedIds.has(err.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="pt-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(err.id)} onCheckedChange={() => toggleSelect(err.id)} />
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        setSelectedError(err);
                        setAdminNotes(err.admin_notes || '');
                        setDetailTab('overview');
                        setShowDetailDialog(true);
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {getSeverityBadge(err.severity)}
                            {getCategoryBadge(err.error_category)}
                            {getRoleBadge(err.user_role)}
                            {getSourceBadge(err.error_source)}
                            {err.is_resolved && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                <CheckCircle2 className="w-3 h-3" />
                                Gelöst
                              </span>
                            )}
                            {err.occurrence_count > 1 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                <Layers className="w-3 h-3" />
                                {err.occurrence_count}x
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-foreground truncate">{err.error_message}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {err.page_title || err.page_path}
                            </span>
                            {err.component_name && (
                              <span className="flex items-center gap-1">
                                <Bug className="w-3 h-3" />
                                {err.component_name}
                              </span>
                            )}
                            {err.user_email && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {err.user_email}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              {getDeviceIcon(err.device_type)}
                              {err.browser}
                            </span>
                            {err.http_status && (
                              <span className="flex items-center gap-1 text-red-500">
                                <Server className="w-3 h-3" />
                                HTTP {err.http_status}
                              </span>
                            )}
                          </div>
                          {err.original_error && err.original_error !== err.error_message && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                              Original: {err.original_error}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(err.created_at)}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {err.error_code}
                          </span>
                          {err.session_id && (
                            <span className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[100px]" title={err.session_id}>
                              {err.session_id.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                      {!err.is_resolved ? (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" title="Als gelöst markieren" onClick={() => handleResolve(err.id)}>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50" title="Als ungelöst markieren" onClick={() => handleUnresolve(err.id)}>
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Löschen"
                        onClick={() => { setDeleteTarget('single'); setSingleDeleteId(err.id); setShowDeleteDialog(true); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Seite {page + 1} von {totalPages} ({totalCount} Einträge)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" /> Zurück
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Weiter <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* Detail Dialog - Erweitert mit Tabs                                 */}
      {/* ================================================================== */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedError && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Fehlerdetails
                </DialogTitle>
                <DialogDescription>
                  {selectedError.error_code} - {formatDate(selectedError.created_at)}
                  {selectedError.occurrence_count > 1 && (
                    <span className="ml-2 text-amber-600 font-medium">
                      ({selectedError.occurrence_count}x aufgetreten)
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {getSeverityBadge(selectedError.severity)}
                {getCategoryBadge(selectedError.error_category)}
                {getRoleBadge(selectedError.user_role)}
                {getSourceBadge(selectedError.error_source)}
                {selectedError.is_resolved && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Gelöst am {selectedError.resolved_at ? formatDate(selectedError.resolved_at) : ''}
                  </span>
                )}
                {selectedError.occurrence_count > 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <Layers className="w-3 h-3" />
                    {selectedError.occurrence_count}x aufgetreten
                  </span>
                )}
              </div>

              {/* Tabs */}
              <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Übersicht</TabsTrigger>
                  <TabsTrigger value="technical">Technisch</TabsTrigger>
                  <TabsTrigger value="breadcrumbs">
                    Breadcrumbs
                    {selectedError.breadcrumbs && selectedError.breadcrumbs.length > 0 && (
                      <span className="ml-1 text-xs bg-primary/20 rounded-full px-1.5">{selectedError.breadcrumbs.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="notes">Notizen</TabsTrigger>
                </TabsList>

                {/* Tab: Übersicht */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Deutsche Fehlermeldung */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Angezeigte Fehlermeldung (Deutsch)</h4>
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <p className="text-sm font-medium text-destructive">{selectedError.error_message}</p>
                    </div>
                  </div>

                  {/* Original Error */}
                  {selectedError.original_error && selectedError.original_error !== selectedError.error_message && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Original-Fehlermeldung (technisch)</h4>
                      <div className="bg-muted rounded-lg p-3 flex items-start justify-between gap-2">
                        <p className="text-sm font-mono break-all">{selectedError.original_error}</p>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(selectedError.original_error || '')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Context Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Seite</h4>
                      <p className="text-sm">{selectedError.page_title || selectedError.page_path}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedError.page_path}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Komponente</h4>
                      <p className="text-sm font-mono">{selectedError.component_name || '-'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Nutzer</h4>
                      <p className="text-sm">{selectedError.user_email || 'Anonym'}</p>
                      <p className="text-xs text-muted-foreground">{selectedError.user_role}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Gerät</h4>
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(selectedError.device_type)}
                        <span className="text-sm">{selectedError.browser} / {selectedError.device_type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Full URL */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Volle URL</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono break-all bg-muted rounded p-2 flex-1">{selectedError.page_url}</p>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(selectedError.page_url)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Occurrence Info */}
                  {(selectedError.first_seen_at || selectedError.last_seen_at) && (
                    <div className="grid grid-cols-2 gap-4 bg-muted/50 rounded-lg p-3">
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground">Erstmals aufgetreten</h4>
                        <p className="text-sm">{selectedError.first_seen_at ? formatDate(selectedError.first_seen_at) : '-'}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground">Zuletzt aufgetreten</h4>
                        <p className="text-sm">{selectedError.last_seen_at ? formatDate(selectedError.last_seen_at) : '-'}</p>
                      </div>
                    </div>
                  )}

                  {/* Login-Versuch Details */}
                  {selectedError.metadata && (selectedError.metadata as any).attempted_email && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Login-Versuch
                      </h4>
                      <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                        <span className="text-amber-700 dark:text-amber-400 font-medium">E-Mail:</span>
                        <span className="font-mono text-amber-900 dark:text-amber-200 select-all">{(selectedError.metadata as any).attempted_email}</span>
                        <span className="text-amber-700 dark:text-amber-400 font-medium">Passwort:</span>
                        <span className="font-mono text-amber-900 dark:text-amber-200">[aus Datenschutzgründen entfernt]</span>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Technisch */}
                <TabsContent value="technical" className="space-y-4 mt-4">
                  {/* Technical Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Error Code</h4>
                      <p className="text-sm font-mono bg-muted rounded px-2 py-1">{selectedError.error_code}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Error Hash</h4>
                      <p className="text-sm font-mono bg-muted rounded px-2 py-1">{selectedError.error_hash || '-'}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Session ID</h4>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-mono bg-muted rounded px-2 py-1 truncate">{selectedError.session_id || '-'}</p>
                        {selectedError.session_id && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(selectedError.session_id || '')}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">App Version</h4>
                      <p className="text-sm font-mono bg-muted rounded px-2 py-1">{selectedError.app_version || '-'}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Environment</h4>
                      <p className="text-sm font-mono bg-muted rounded px-2 py-1">{selectedError.environment || '-'}</p>
                    </div>
                    {selectedError.http_status && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">HTTP Status</h4>
                        <p className={`text-sm font-mono rounded px-2 py-1 ${
                          selectedError.http_status >= 500 ? 'bg-red-100 text-red-800' :
                          selectedError.http_status >= 400 ? 'bg-orange-100 text-orange-800' :
                          'bg-muted'
                        }`}>{selectedError.http_status}</p>
                      </div>
                    )}
                  </div>

                  {/* Device Details */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Monitor className="w-4 h-4" />
                      Geräte-Details
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/50 rounded-lg p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Bildschirm</p>
                        <p className="text-sm font-mono">{selectedError.screen_resolution || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Verbindung</p>
                        <p className="text-sm font-mono flex items-center gap-1">
                          {selectedError.connection_type === 'unknown' || !selectedError.connection_type ? (
                            <><WifiOff className="w-3 h-3" /> Unbekannt</>
                          ) : (
                            <><Wifi className="w-3 h-3" /> {selectedError.connection_type}</>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Browser</p>
                        <p className="text-sm font-mono">{selectedError.browser || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gerät</p>
                        <p className="text-sm font-mono">{selectedError.device_type || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Memory Usage */}
                  {selectedError.memory_usage && Object.keys(selectedError.memory_usage).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        Speicherverbrauch
                      </h4>
                      <div className="grid grid-cols-3 gap-3 bg-muted/50 rounded-lg p-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Verwendet</p>
                          <p className="text-sm font-mono">{(selectedError.memory_usage as any).usedJSHeapSize || '-'} MB</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Gesamt</p>
                          <p className="text-sm font-mono">{(selectedError.memory_usage as any).totalJSHeapSize || '-'} MB</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Limit</p>
                          <p className="text-sm font-mono">{(selectedError.memory_usage as any).jsHeapSizeLimit || '-'} MB</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stack Trace */}
                  {selectedError.stack_trace && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-between">
                        <span>Stack Trace</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => copyToClipboard(selectedError.stack_trace || '')}>
                          <Copy className="w-3 h-3 mr-1" /> Kopieren
                        </Button>
                      </h4>
                      <pre className="text-xs font-mono bg-gray-900 text-green-400 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                        {selectedError.stack_trace}
                      </pre>
                    </div>
                  )}

                  {/* User Agent */}
                  {selectedError.user_agent && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">User Agent</h4>
                      <p className="text-xs font-mono bg-muted rounded p-2 break-all">{selectedError.user_agent}</p>
                    </div>
                  )}

                  {/* Request Info */}
                  {selectedError.request_info && Object.keys(selectedError.request_info).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Request Info</h4>
                      <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-auto max-h-48">
                        {JSON.stringify(selectedError.request_info, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Metadata */}
                  {selectedError.metadata && Object.keys(selectedError.metadata).filter(k => !k.startsWith('attempted_')).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-between">
                        <span>Metadaten</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => copyToClipboard(JSON.stringify(selectedError.metadata, null, 2))}>
                          <Copy className="w-3 h-3 mr-1" /> Kopieren
                        </Button>
                      </h4>
                      <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-auto max-h-48">
                        {JSON.stringify(
                          Object.fromEntries(Object.entries(selectedError.metadata).filter(([k]) => !k.startsWith('attempted_'))),
                          null, 2
                        )}
                      </pre>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Breadcrumbs */}
                <TabsContent value="breadcrumbs" className="space-y-4 mt-4">
                  {selectedError.breadcrumbs && selectedError.breadcrumbs.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        Letzte {selectedError.breadcrumbs.length} Aktionen vor dem Fehler
                      </h4>
                      <div className="space-y-1">
                        {selectedError.breadcrumbs.map((crumb, idx) => {
                          const crumbIcons: Record<string, React.ReactNode> = {
                            navigation: <Navigation className="w-3.5 h-3.5 text-blue-500" />,
                            click: <MousePointer className="w-3.5 h-3.5 text-green-500" />,
                            api: <Server className="w-3.5 h-3.5 text-purple-500" />,
                            error: <XCircle className="w-3.5 h-3.5 text-red-500" />,
                            input: <Activity className="w-3.5 h-3.5 text-orange-500" />,
                            custom: <Hash className="w-3.5 h-3.5 text-gray-500" />,
                          };
                          const time = new Date(crumb.timestamp);
                          const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          
                          return (
                            <div key={idx} className={`flex items-start gap-3 p-2 rounded-lg ${
                              idx === selectedError.breadcrumbs!.length - 1 ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800' : 'hover:bg-muted/50'
                            }`}>
                              <div className="flex-shrink-0 mt-0.5">
                                {crumbIcons[crumb.type] || crumbIcons.custom}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{crumb.message}</p>
                                {crumb.data && (
                                  <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                                    {JSON.stringify(crumb.data).slice(0, 100)}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                {timeStr}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Navigation className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Keine Breadcrumbs verfügbar</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Breadcrumbs werden erst für neue Fehler erfasst, die nach dem Update auftreten.
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Notizen */}
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Admin-Notizen</h4>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Notizen zum Fehler hinzufügen..."
                      rows={5}
                    />
                    <div className="flex justify-end mt-2">
                      <Button size="sm" variant="outline" onClick={handleSaveNotes}>
                        Notizen speichern
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex gap-2 sm:justify-between">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { setDeleteTarget('single'); setSingleDeleteId(selectedError.id); setShowDeleteDialog(true); }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Löschen
                </Button>
                <div className="flex gap-2">
                  {selectedError.is_resolved ? (
                    <Button variant="outline" onClick={() => handleUnresolve(selectedError.id)}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Als ungelöst markieren
                    </Button>
                  ) : (
                    <Button onClick={() => handleResolve(selectedError.id, adminNotes)} className="bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Als gelöst markieren
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {deleteTarget === 'all'
                ? 'Alle Fehlerprotokolle löschen?'
                : deleteTarget === 'selected'
                ? `${selectedIds.size} Fehlerprotokoll${selectedIds.size > 1 ? 'e' : ''} löschen?`
                : 'Fehlerprotokoll löschen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'all' ? (
                activeFilterCount > 0
                  ? `Alle ${totalCount} gefilterten Fehlerprotokolle werden endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`
                  : `Alle ${stats.total} Fehlerprotokolle werden endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`
              ) : deleteTarget === 'selected' ? (
                `${selectedIds.size} ausgewählte Fehlerprotokoll${selectedIds.size > 1 ? 'e werden' : ' wird'} endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`
              ) : (
                'Dieses Fehlerprotokoll wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminErrorLogs;
