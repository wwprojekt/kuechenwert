import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle, ExternalLink, Hash, Mail, MessageSquare, Phone, RotateCcw, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminMessage, MessageStatus } from "./adminMessagesApi";

interface MessageDetailDialogProps {
  message: AdminMessage | null;
  onClose: () => void;
  onReply: (message: AdminMessage, reply: string) => Promise<boolean>;
  onStatusChange: (message: AdminMessage, status: MessageStatus) => Promise<void>;
}

const SOURCE_LABELS = { contact: "Kontaktformular", support: "Support-Nachricht" } as const;

export function MessageDetailDialog({ message, onClose, onReply, onStatusChange }: MessageDetailDialogProps) {
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState<"reply" | "status" | null>(null);

  const close = () => {
    setReply("");
    onClose();
  };

  const handleReply = async () => {
    if (!message || !reply.trim()) return;
    setPending("reply");
    const sent = await onReply(message, reply);
    setPending(null);
    if (sent) close();
  };

  const handleToggleResolved = async () => {
    if (!message) return;
    setPending("status");
    await onStatusChange(message, message.status === "resolved" ? "open" : "resolved");
    setPending(null);
  };

  const sender = message?.sender;

  return (
    <Dialog open={!!message} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {message?.subject}
          </DialogTitle>
          <DialogDescription>
            {message && SOURCE_LABELS[message.source]}
            {message?.createdAt && ` vom ${format(new Date(message.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted/50 border rounded-lg space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Absender
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <span className="font-medium">{sender?.name || "Unbekannt"}</span>
              {sender?.email && (
                <a href={`mailto:${sender.email}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Mail className="w-3.5 h-3.5" />
                  {sender.email}
                </a>
              )}
              {sender?.phone && (
                <a href={`tel:${sender.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="w-3.5 h-3.5" />
                  {sender.phone}
                </a>
              )}
              {sender?.customerNumber && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="w-3.5 h-3.5" />
                  Kd.-Nr.: {sender.customerNumber}
                </span>
              )}
            </div>
            {sender?.userId && (
              <Link
                to={`/admin/users/${sender.userId}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Benutzerprofil öffnen
              </Link>
            )}
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium text-muted-foreground mb-2">Nachricht:</p>
            <p className="whitespace-pre-wrap">{message?.message}</p>
          </div>

          {message?.adminResponse && (
            <div className="p-4 border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                Bisherige Antwort
                {message.respondedAt && ` (${format(new Date(message.respondedAt), "dd.MM.yyyy HH:mm", { locale: de })})`}
              </p>
              <p className="whitespace-pre-wrap text-sm">{message.adminResponse}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message-reply">Antwort per E-Mail</Label>
            <Textarea
              id="message-reply"
              placeholder={sender?.email ? "Geben Sie Ihre Antwort ein..." : "Keine E-Mail-Adresse hinterlegt"}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              disabled={!sender?.email}
              className="min-h-[150px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleToggleResolved} disabled={pending !== null}>
            {message?.status === "resolved" ? (
              <><RotateCcw className="w-4 h-4 mr-2" />Wieder öffnen</>
            ) : (
              <><CheckCircle className="w-4 h-4 mr-2" />Als erledigt markieren</>
            )}
          </Button>
          <Button onClick={handleReply} disabled={pending !== null || !reply.trim() || !sender?.email}>
            <Send className="w-4 h-4 mr-2" />
            {pending === "reply" ? "Wird gesendet..." : "Antwort senden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
