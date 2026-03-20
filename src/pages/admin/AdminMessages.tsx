import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Clock, CheckCircle, AlertCircle, Eye, Send, User } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface SupportMessage {
  id: string;
  user_id: string | null;
  subject: string;
  message: string;
  status: string | null;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string | null;
  user?: {
    email?: string;
    first_name?: string;
    last_name?: string;
  };
}

export default function AdminMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [response, setResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");

  const fetchMessages = async () => {
    try {
      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("support_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      // Get unique user IDs
      const userIds = [...new Set(messagesData?.map(m => m.user_id).filter(Boolean) as string[])];

      // Fetch profiles for these users
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = { first_name: profile.first_name, last_name: profile.last_name };
            return acc;
          }, {} as Record<string, { first_name: string | null; last_name: string | null }>);
        }
      }

      // Combine messages with user data
      const messagesWithUsers = messagesData?.map(msg => ({
        ...msg,
        user: msg.user_id ? profilesMap[msg.user_id] : undefined,
      })) || [];

      setMessages(messagesWithUsers as SupportMessage[]);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Fehler",
        description: "Nachrichten konnten nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleRespond = async () => {
    if (!selectedMessage || !response.trim()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("support_messages")
        .update({
          admin_response: response.trim(),
          responded_by: user?.id,
          responded_at: new Date().toISOString(),
          status: "resolved",
        })
        .eq("id", selectedMessage.id);

      if (error) throw error;

      toast({
        title: "Antwort gesendet",
        description: "Die Nachricht wurde erfolgreich beantwortet",
      });

      setSelectedMessage(null);
      setResponse("");
      fetchMessages();
    } catch (error) {
      console.error("Error responding to message:", error);
      toast({
        title: "Fehler",
        description: "Antwort konnte nicht gesendet werden",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (messageId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("support_messages")
        .update({ status: newStatus })
        .eq("id", messageId);

      if (error) throw error;
      fetchMessages();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (filter === "all") return true;
    return msg.status === filter;
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "resolved":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
            <CheckCircle className="w-3 h-3" />
            Beantwortet
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600 gap-1">
            <AlertCircle className="w-3 h-3" />
            In Bearbeitung
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-600 gap-1">
            <Clock className="w-3 h-3" />
            Offen
          </Badge>
        );
    }
  };

  const openCount = messages.filter(m => m.status === "open" || !m.status).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Support-Nachrichten</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Benutzeranfragen
          </p>
        </div>
        <div className="flex items-center gap-4">
          {openCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {openCount} offene Anfragen
            </Badge>
          )}
          <Select value={filter} onValueChange={(val) => setFilter(val as typeof filter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Nachrichten</SelectItem>
              <SelectItem value="open">Offen</SelectItem>
              <SelectItem value="in_progress">In Bearbeitung</SelectItem>
              <SelectItem value="resolved">Beantwortet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Eingegangene Anfragen
          </CardTitle>
          <CardDescription>
            {filteredMessages.length} Nachrichten gefunden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Lädt...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Nachrichten gefunden</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benutzer</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {msg.user?.first_name && msg.user?.last_name 
                            ? `${msg.user.first_name} ${msg.user.last_name}`
                            : "Unbekannt"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px]">
                      <p className="truncate">{msg.subject}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(msg.status)}</TableCell>
                    <TableCell>
                      {msg.created_at && format(new Date(msg.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={msg.status || "open"}
                          onValueChange={(val) => handleStatusChange(msg.id, val)}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Offen</SelectItem>
                            <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                            <SelectItem value="resolved">Beantwortet</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedMessage(msg);
                            setResponse(msg.admin_response || "");
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {msg.admin_response ? "Ansehen" : "Beantworten"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Response Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              {selectedMessage?.subject}
            </DialogTitle>
            <DialogDescription>
              Anfrage von {selectedMessage?.user?.first_name || "Unbekannt"} am{" "}
              {selectedMessage?.created_at &&
                format(new Date(selectedMessage.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-2">Nachricht:</p>
              <p className="whitespace-pre-wrap">{selectedMessage?.message}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="response">Ihre Antwort</Label>
              <Textarea
                id="response"
                placeholder="Geben Sie Ihre Antwort ein..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="min-h-[150px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMessage(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleRespond} disabled={isSubmitting || !response.trim()}>
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? "Wird gesendet..." : "Antwort senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
