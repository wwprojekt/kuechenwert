import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLiveData } from "@/hooks/useLiveData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle, Send } from "lucide-react";
import { withSessionRetry } from "@/lib/sessionGuard";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { z } from "zod";

const messageSchema = z.object({
  subject: z.string().trim().min(3, "Bitte geben Sie einen Betreff ein"),
  message: z.string().trim().min(10, "Bitte beschreiben Sie Ihr Anliegen (mind. 10 Zeichen)"),
});

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
}

export default function MyMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMessage, setNewMessage] = useState({
    subject: "",
    message: "",
  });

  const loadMessages = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useLiveData(loadMessages, { enabled: !!user, pollingInterval: 60_000 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      messageSchema.parse(newMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Bitte prüfen Sie Ihre Eingaben",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await withSessionRetry(async () => {
        const { error } = await supabase.from("support_messages").insert({
          user_id: user.id,
          subject: newMessage.subject.trim(),
          message: newMessage.message.trim(),
        });
        if (error) throw error;
      }, 'MyMessages.send');

      toast({
        title: "Nachricht gesendet",
        description: "Ihre Nachricht wurde erfolgreich übermittelt. Wir werden uns in Kürze bei Ihnen melden.",
      });

      setNewMessage({ subject: "", message: "" });
      setIsDialogOpen(false);
      loadMessages();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Fehler",
        description: "Nachricht konnte nicht gesendet werden",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Meine Nachrichten</h1>
          <p className="text-muted-foreground">
            Kontaktieren Sie unser Support-Team
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Neue Nachricht
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Neue Support-Anfrage</DialogTitle>
              <DialogDescription>
                Beschreiben Sie Ihr Anliegen und wir melden uns schnellstmöglich bei Ihnen.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Betreff *</Label>
                <Input
                  id="subject"
                  placeholder="Worum geht es?"
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Nachricht *</Label>
                <Textarea
                  id="message"
                  placeholder="Beschreiben Sie Ihr Anliegen..."
                  value={newMessage.message}
                  onChange={(e) => setNewMessage(prev => ({ ...prev, message: e.target.value }))}
                  className="min-h-[150px]"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <Send className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Wird gesendet..." : "Nachricht senden"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : messages.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Keine Nachrichten</h3>
            <p className="text-muted-foreground mb-4">
              Sie haben noch keine Support-Anfragen gestellt.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Erste Nachricht schreiben
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {messages.map((msg) => (
            <Card key={msg.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <CardTitle className="text-lg">{msg.subject}</CardTitle>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(msg.status)}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(msg.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Ihre Nachricht:</p>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>

                {msg.admin_response && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm font-medium text-primary mb-1">Antwort vom Support:</p>
                    <p className="whitespace-pre-wrap">{msg.admin_response}</p>
                    {msg.responded_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Beantwortet am {format(new Date(msg.responded_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
