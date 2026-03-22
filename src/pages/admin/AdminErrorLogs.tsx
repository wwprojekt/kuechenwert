/**
 * Admin Error Logs Dashboard
 * 
 * Zeigt alle geloggten Fehler an, die Nutzern angezeigt wurden.
 * Ermöglicht Filtern, Suchen und Markieren als gelöst.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  XCircle,
  Eye,
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
}

interface ErrorStats {
  total: number;
  unresolved: number;
  critical: number;
  today: number;
  byCategory: Record<string, number>;
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
    byCategory: {},
  });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [pageFilter, setPageFilter] = useState<string>("all");

  // Fetch error logs
  const fetchErrors = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('error_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      // Apply filters
      if (categoryFilter !== 'all') {
        query = query.eq('error_category', categoryFilter);
      }
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }
      if (statusFilter === 'resolved') {
        query = query.eq('is_resolved', true);
      } else if (statusFilter === 'unresolved') {
        query = query.eq('is_resolved', false);
      }
      if (roleFilter !== 'all') {
        query = query.eq('user_role', roleFilter);
      }
      if (searchQuery.trim()) {
        query = query.or(`error_message.ilike.%${searchQuery}%,error_code.ilike.%${searchQuery}%,page_path.ilike.%${searchQuery}%,original_error.ilike.%${searchQuery}%`);
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
  }, [page, categoryFilter, severityFilter, statusFilter, roleFilter, searchQuery, toast]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalRes, unresolvedRes, criticalRes, todayRes] = await Promise.all([
        supabase.from('error_logs').select('id', { count: 'exact', head: true }),
        supabase.from('error_logs').select('id', { count: 'exact', head: true }).eq('is_resolved', false),
        supabase.from('error_logs').select('id', { count: 'exact', head: true }).eq('severity', 'critical').eq('is_resolved', false),
        supabase.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      ]);

      // Category breakdown
      const { data: catData } = await supabase
        .from('error_logs')
        .select('error_category')
        .eq('is_resolved', false);

      const byCategory: Record<string, number> = {};
      catData?.forEach(row => {
        byCategory[row.error_category] = (byCategory[row.error_category] || 0) + 1;
      });

      setStats({
        total: totalRes.count || 0,
        unresolved: unresolvedRes.count || 0,
        critical: criticalRes.count || 0,
        today: todayRes.count || 0,
        byCategory,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
    fetchStats();
  }, [fetchErrors, fetchStats]);

  // Mark as resolved
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

      toast({
        title: "Erledigt",
        description: "Fehler wurde als gelöst markiert.",
      });

      fetchErrors();
      fetchStats();
      setShowDetailDialog(false);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  // Unresolve
  const handleUnresolve = async (errorId: string) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          is_resolved: false,
          resolved_at: null,
          resolved_by: null,
        })
        .eq('id', errorId);

      if (error) throw error;

      toast({ title: "Status zurückgesetzt" });
      fetchErrors();
      fetchStats();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  // Bulk resolve
  const handleBulkResolve = async () => {
    const unresolvedIds = errors.filter(e => !e.is_resolved).map(e => e.id);
    if (unresolvedIds.length === 0) return;

    const confirmed = window.confirm(
      `Möchten Sie ${unresolvedIds.length} Fehler auf dieser Seite als gelöst markieren?`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          admin_notes: 'Bulk-Auflösung',
        })
        .in('id', unresolvedIds);

      if (error) throw error;

      toast({
        title: "Erledigt",
        description: `${unresolvedIds.length} Fehler wurden als gelöst markiert.`,
      });

      fetchErrors();
      fetchStats();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Bulk-Auflösung fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  // Helper functions
  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      low: { color: 'bg-blue-100 text-blue-800', label: 'Niedrig' },
      medium: { color: 'bg-yellow-100 text-yellow-800', label: 'Mittel' },
      high: { color: 'bg-orange-100 text-orange-800', label: 'Hoch' },
      critical: { color: 'bg-red-100 text-red-800', label: 'Kritisch' },
    };
    const v = variants[severity] || variants.low;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${v.color}`}>{v.label}</span>;
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      validation: { color: 'bg-purple-100 text-purple-800', label: 'Validierung', icon: <Shield className="w-3 h-3" /> },
      auth: { color: 'bg-indigo-100 text-indigo-800', label: 'Auth', icon: <User className="w-3 h-3" /> },
      api: { color: 'bg-cyan-100 text-cyan-800', label: 'API', icon: <Globe className="w-3 h-3" /> },
      business: { color: 'bg-emerald-100 text-emerald-800', label: 'Geschäftslogik', icon: <AlertCircle className="w-3 h-3" /> },
      system: { color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200', label: 'System', icon: <Bug className="w-3 h-3" /> },
      ui: { color: 'bg-pink-100 text-pink-800', label: 'UI', icon: <Monitor className="w-3 h-3" /> },
      unknown: { color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300', label: 'Unbekannt', icon: <AlertTriangle className="w-3 h-3" /> },
    };
    const v = variants[category] || variants.unknown;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${v.color}`}>{v.icon}{v.label}</span>;
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return null;
    const variants: Record<string, string> = {
      customer: 'bg-green-100 text-green-800',
      dealer: 'bg-blue-100 text-blue-800',
      admin: 'bg-red-100 text-red-800',
      anonymous: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
    };
    const labels: Record<string, string> = {
      customer: 'Kunde',
      dealer: 'Händler',
      admin: 'Admin',
      anonymous: 'Anonym',
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[role] || variants.anonymous}`}>{labels[role] || role}</span>;
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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
            Alle Fehler, die Nutzern angezeigt wurden, werden hier protokolliert.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchErrors(); fetchStats(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
          <Button variant="outline" size="sm" onClick={handleBulkResolve}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Alle auf Seite lösen
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ungelöst</p>
                <p className="text-2xl font-bold text-orange-600">{stats.unresolved}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kritisch</p>
                <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Heute</p>
                <p className="text-2xl font-bold text-blue-600">{stats.today}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Suche in Fehlern..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="Schweregrad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Schweregrade</SelectItem>
                <SelectItem value="critical">Kritisch</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="unresolved">Ungelöst</SelectItem>
                <SelectItem value="resolved">Gelöst</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0); }}>
              <SelectTrigger>
                <SelectValue placeholder="Nutzerrolle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Rollen</SelectItem>
                <SelectItem value="customer">Kunde</SelectItem>
                <SelectItem value="dealer">Händler</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="anonymous">Anonym</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(categoryFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all' || roleFilter !== 'all' || searchQuery) && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{totalCount} Ergebnisse</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCategoryFilter('all');
                  setSeverityFilter('all');
                  setStatusFilter('all');
                  setRoleFilter('all');
                  setSearchQuery('');
                  setPage(0);
                }}
              >
                Filter zurücksetzen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
                {searchQuery || categoryFilter !== 'all' || severityFilter !== 'all'
                  ? 'Versuchen Sie andere Filtereinstellungen.'
                  : 'Es wurden noch keine Fehler protokolliert.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {errors.map((err) => (
                <div
                  key={err.id}
                  className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    err.is_resolved ? 'opacity-60' : ''
                  } ${err.severity === 'critical' ? 'border-l-4 border-l-red-500' : ''}`}
                  onClick={() => {
                    setSelectedError(err);
                    setAdminNotes(err.admin_notes || '');
                    setShowDetailDialog(true);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getSeverityBadge(err.severity)}
                        {getCategoryBadge(err.error_category)}
                        {getRoleBadge(err.user_role)}
                        {err.is_resolved && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Gelöst
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-foreground truncate">
                        {err.error_message}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
                        {getDeviceIcon(err.device_type)}
                        <span>{err.browser}</span>
                      </div>
                      {err.original_error && err.original_error !== err.error_message && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                          Original: {err.original_error}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(err.created_at)}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {err.error_code}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Seite {page + 1} von {totalPages} ({totalCount} Einträge)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Weiter
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedError && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Fehlerdetails
                </DialogTitle>
                <DialogDescription>
                  {selectedError.error_code} - {formatDate(selectedError.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {getSeverityBadge(selectedError.severity)}
                  {getCategoryBadge(selectedError.error_category)}
                  {getRoleBadge(selectedError.user_role)}
                  {selectedError.is_resolved && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3" />
                      Gelöst am {selectedError.resolved_at ? formatDate(selectedError.resolved_at) : ''}
                    </span>
                  )}
                </div>

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
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-sm font-mono">{selectedError.original_error}</p>
                    </div>
                  </div>
                )}

                {/* Context */}
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
                  <p className="text-xs font-mono break-all bg-muted rounded p-2">{selectedError.page_url}</p>
                </div>

                {/* Stack Trace */}
                {selectedError.stack_trace && (
                  <details>
                    <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                      Stack Trace anzeigen
                    </summary>
                    <pre className="text-xs font-mono bg-muted rounded-lg p-3 mt-2 overflow-auto max-h-48">
                      {selectedError.stack_trace}
                    </pre>
                  </details>
                )}

                {/* Metadata */}
                {selectedError.metadata && Object.keys(selectedError.metadata).length > 0 && (
                  <details>
                    <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                      Metadaten anzeigen
                    </summary>
                    <pre className="text-xs font-mono bg-muted rounded-lg p-3 mt-2 overflow-auto max-h-48">
                      {JSON.stringify(selectedError.metadata, null, 2)}
                    </pre>
                  </details>
                )}

                {/* Admin Notes */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Admin-Notizen</h4>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Notizen zum Fehler hinzufügen..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                {selectedError.is_resolved ? (
                  <Button
                    variant="outline"
                    onClick={() => handleUnresolve(selectedError.id)}
                  >
                    Als ungelöst markieren
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleResolve(selectedError.id, adminNotes)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Als gelöst markieren
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminErrorLogs;
