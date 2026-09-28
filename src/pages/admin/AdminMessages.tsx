import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AlertCircle, CheckCircle, Clock, Eye, Loader2, MessageSquare, Search, Trash2, User, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { MessageDetailDialog } from "@/components/admin/messages/MessageDetailDialog";
import {
  STATUS_LABELS,
  STATUS_OPTIONS,
  deleteMessages,
  fetchAdminMessages,
  sendMessageReply,
  updateMessageStatus,
  type AdminMessage,
  type MessageSource,
  type MessageStatus,
} from "@/components/admin/messages/adminMessagesApi";

const TAB_TO_SOURCE: Record<string, MessageSource> = { kontakt: "contact", support: "support" };
const RELATED_QUERY_KEYS = [["adminMessages"], ["adminNotificationCounts"], ["adminDashboardCounts"], ["adminActionItems"]];

function StatusBadge({ status }: { status: MessageStatus }) {
  if (status === "resolved") {
    return <Badge variant="outline" className="text-green-600 border-green-600 gap-1"><CheckCircle className="w-3 h-3" />{STATUS_LABELS.resolved}</Badge>;
  }
  if (status === "in_progress") {
    return <Badge variant="outline" className="text-blue-600 border-blue-600 gap-1"><AlertCircle className="w-3 h-3" />{STATUS_LABELS.in_progress}</Badge>;
  }
  return <Badge variant="outline" className="text-orange-600 border-orange-600 gap-1"><Clock className="w-3 h-3" />{STATUS_LABELS.open}</Badge>;
}

export default function AdminMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const userFilter = searchParams.get("user");
  const source: MessageSource = userFilter ? "support" : TAB_TO_SOURCE[searchParams.get("tab") ?? ""] ?? "contact";

  const [statusFilter, setStatusFilter] = useState<"all" | MessageStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<AdminMessage | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<AdminMessage[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["adminMessages"],
    queryFn: fetchAdminMessages,
    staleTime: 30000,
  });

  const openCounts = useMemo(() => {
    const counts: Record<MessageSource, number> = { contact: 0, support: 0 };
    for (const m of messages) if (m.status === "open") counts[m.source] += 1;
    return counts;
  }, [messages]);

  const visible = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return messages.filter((m) => {
      if (m.source !== source) return false;
      if (userFilter && m.sender.userId !== userFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return [m.sender.name, m.sender.email, m.subject, m.message].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [messages, source, userFilter, statusFilter, searchQuery]);

  const refresh = () => {
    for (const queryKey of RELATED_QUERY_KEYS) queryClient.invalidateQueries({ queryKey });
  };

  const switchTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
    setCheckedIds(new Set());
    setStatusFilter("all");
  };

  const handleStatusChange = async (message: AdminMessage, status: MessageStatus) => {
    try {
      await updateMessageStatus(message, status);
      setSelected((prev) => (prev?.id === message.id ? { ...prev, status } : prev));
      toast({ title: status === "resolved" ? "Als erledigt markiert" : `Status: ${STATUS_LABELS[status]}` });
      refresh();
    } catch (error) {
      console.error("Status konnte nicht geändert werden:", error);
      toast({
        title: "Status konnte nicht geändert werden",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleReply = async (message: AdminMessage, reply: string): Promise<boolean> => {
    try {
      const recipient = await sendMessageReply(message, reply);
      toast({ title: "Antwort versendet", description: `E-Mail an ${recipient} gesendet, Nachricht ist erledigt.` });
      refresh();
      return true;
    } catch (error) {
      console.error("Antwort konnte nicht gesendet werden:", error);
      toast({
        title: "E-Mail-Versand fehlgeschlagen",
        description: `${error instanceof Error ? error.message : "Unbekannter Fehler"}. Die Antwort wurde NICHT zugestellt.`,
        variant: "destructive",
      });
      return false;
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMessages(deleteTargets);
      toast({ title: `${deleteTargets.length} Nachricht${deleteTargets.length > 1 ? "en" : ""} gelöscht` });
      setCheckedIds(new Set());
      refresh();
    } catch (error) {
      console.error("Nachrichten konnten nicht gelöscht werden:", error);
      toast({ title: "Fehler beim Löschen", description: String(error), variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteTargets([]);
    }
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked = visible.length > 0 && visible.every((m) => checkedIds.has(m.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Nachrichten</h1>
          <p className="text-muted-foreground">Kontaktformular und Support-Anfragen aus dem Kundenkonto</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, E-Mail, Betreff…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Nachrichten</SelectItem>
              {STATUS_OPTIONS[source].map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={source === "contact" ? "kontakt" : "support"} onValueChange={switchTab}>
          <TabsList>
            <TabsTrigger value="kontakt" className="gap-2">
              Kontaktformular
              {openCounts.contact > 0 && <Badge variant="destructive" className="h-5 px-1.5">{openCounts.contact}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              Support
              {openCounts.support > 0 && <Badge variant="destructive" className="h-5 px-1.5">{openCounts.support}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {userFilter && (
          <Button variant="outline" size="sm" onClick={() => switchTab("support")} className="gap-1">
            <User className="w-3.5 h-3.5" />
            Nur Nachrichten dieses Benutzers
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {source === "contact" ? "Kontaktanfragen" : "Support-Nachrichten"}
          </CardTitle>
          <CardDescription>{visible.length} Nachrichten gefunden</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Lädt...
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Nachrichten gefunden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={() => setCheckedIds(allChecked ? new Set() : new Set(visible.map((m) => m.id)))}
                        aria-label="Alle auswählen"
                      />
                    </TableHead>
                    <TableHead>Absender</TableHead>
                    <TableHead>Betreff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((msg) => (
                    <TableRow key={msg.id} className={checkedIds.has(msg.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={checkedIds.has(msg.id)}
                          onCheckedChange={() => toggleChecked(msg.id)}
                          aria-label="Nachricht auswählen"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{msg.sender.name || "Unbekannt"}</div>
                          {msg.sender.email && <div className="text-xs text-muted-foreground truncate">{msg.sender.email}</div>}
                          {msg.sender.customerNumber && <div className="text-xs text-muted-foreground">#{msg.sender.customerNumber}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px]">
                        <p className="truncate">{msg.subject}</p>
                      </TableCell>
                      <TableCell><StatusBadge status={msg.status} /></TableCell>
                      <TableCell className="whitespace-nowrap">
                        {msg.createdAt && format(new Date(msg.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select value={msg.status} onValueChange={(val) => handleStatusChange(msg, val as MessageStatus)}>
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS[msg.source].map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => setSelected(msg)}>
                            <Eye className="w-4 h-4 mr-1" />
                            {msg.status === "resolved" ? "Ansehen" : "Beantworten"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTargets([msg])}
                            title="Nachricht löschen"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {checkedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border shadow-lg rounded-lg px-4 py-3">
          <span className="text-sm font-medium">{checkedIds.size} ausgewählt</span>
          <Button variant="ghost" size="sm" onClick={() => setCheckedIds(new Set())}>Aufheben</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTargets(messages.filter((m) => checkedIds.has(m.id)))}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {checkedIds.size} löschen
          </Button>
        </div>
      )}

      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(open) => !open && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {deleteTargets.length === 1 ? "Nachricht löschen" : `${deleteTargets.length} Nachrichten löschen`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die Nachrichten verschwinden aus dieser Liste. Kontaktanfragen bleiben als gelöscht markiert in der Datenbank,
              Support-Nachrichten werden endgültig gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Löschen...</> : <><Trash2 className="w-4 h-4 mr-2" />Löschen</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MessageDetailDialog
        message={selected}
        onClose={() => setSelected(null)}
        onReply={handleReply}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
