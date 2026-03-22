import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail, Inbox, Send, Users, FileText, History,
  Clock, CheckCircle, AlertCircle, Eye, Reply, Star,
  StarOff, Archive, Trash2, RefreshCw, Search, Plus,
  Loader2, ArrowLeft, ExternalLink, User, MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminEmail {
  id: string;
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_html: string;
  body_text: string;
  email_type: string;
  direction: string;
  status: string;
  broadcast_group: string | null;
  broadcast_id: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  created_at: string;
  resend_id: string | null;
  related_message_id: string | null;
  related_message_type: string | null;
}

interface SupportMessage {
  id: string;
  user_id: string | null;
  subject: string;
  message: string;
  status: string | null;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string | null;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category: string;
  description: string | null;
  variables: any[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface InboxItem {
  id: string;
  source: 'email' | 'support' | 'contact';
  from_name: string;
  from_email: string;
  subject: string;
  preview: string;
  status: string;
  is_read: boolean;
  is_starred: boolean;
  created_at: string;
  original: AdminEmail | SupportMessage | ContactMessage;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminEmailCenter() {
  const { user, session } = useAuth();
  const [activeTab, setActiveTab] = useState("inbox");
  const [inboxCount, setInboxCount] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Mail className="w-8 h-8 text-primary" />
          E-Mail-Center
        </h1>
        <p className="text-muted-foreground mt-1">
          E-Mails senden, empfangen und Rundmails verwalten
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Posteingang
            {inboxCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {inboxCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Verfassen
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Rundmail
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Vorlagen
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Gesendet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <InboxTab onUnreadCountChange={setInboxCount} />
        </TabsContent>
        <TabsContent value="compose">
          <ComposeTab />
        </TabsContent>
        <TabsContent value="broadcast">
          <BroadcastTab />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="sent">
          <SentTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: Posteingang ─────────────────────────────────────────────────────

function InboxTab({ onUnreadCountChange }: { onUnreadCountChange: (count: number) => void }) {
  const { session } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "starred">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch inbound emails
      const { data: emails } = await supabase
        .from("admin_emails")
        .select("*")
        .eq("direction", "inbound")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch support messages
      const { data: supportMsgs } = await supabase
        .from("support_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch contact messages
      const { data: contactMsgs } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // Get profiles for support messages
      const userIds = [...new Set((supportMsgs || []).map(m => m.user_id).filter(Boolean) as string[])];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", userIds);
        if (profiles) {
          profilesMap = profiles.reduce((acc: any, p: any) => {
            acc[p.id] = p;
            return acc;
          }, {});
        }
      }

      // Combine into unified inbox
      const inboxItems: InboxItem[] = [];

      (emails || []).forEach((e: any) => {
        inboxItems.push({
          id: e.id,
          source: 'email',
          from_name: e.sender_name || e.sender_email,
          from_email: e.sender_email,
          subject: e.subject,
          preview: (e.body_text || '').substring(0, 120),
          status: e.status,
          is_read: e.is_read,
          is_starred: e.is_starred,
          created_at: e.created_at,
          original: e,
        });
      });

      (supportMsgs || []).forEach((m: any) => {
        const profile = m.user_id ? profilesMap[m.user_id] : null;
        inboxItems.push({
          id: m.id,
          source: 'support',
          from_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unbekannt',
          from_email: profile?.email || '',
          subject: m.subject,
          preview: (m.message || '').substring(0, 120),
          status: m.status || 'open',
          is_read: m.status === 'resolved',
          is_starred: false,
          created_at: m.created_at || '',
          original: m,
        });
      });

      (contactMsgs || []).forEach((c: any) => {
        inboxItems.push({
          id: c.id,
          source: 'contact',
          from_name: c.name,
          from_email: c.email,
          subject: c.subject,
          preview: (c.message || '').substring(0, 120),
          status: c.status || 'open',
          is_read: c.status === 'resolved',
          is_starred: false,
          created_at: c.created_at || '',
          original: c,
        });
      });

      // Sort by date
      inboxItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(inboxItems);
      onUnreadCountChange(inboxItems.filter(i => !i.is_read).length);
    } catch (error) {
      console.error("Error fetching inbox:", error);
      toast.error("Posteingang konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  const handleReply = async () => {
    if (!selectedItem || !replyContent.trim()) return;
    setIsReplying(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-admin-email', {
        body: {
          to: selectedItem.from_email,
          subject: `Re: ${selectedItem.subject}`,
          body_html: replyContent,
          recipient_name: selectedItem.from_name,
          reply_to_message_id: selectedItem.source !== 'email' ? selectedItem.id : undefined,
          reply_to_message_type: selectedItem.source !== 'email' ? selectedItem.source : undefined,
        },
      });

      if (error) throw error;

      toast.success("Antwort gesendet");
      setSelectedItem(null);
      setReplyContent("");
      fetchInbox();
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast.error("Antwort konnte nicht gesendet werden");
    } finally {
      setIsReplying(false);
    }
  };

  const handleToggleStar = async (item: InboxItem) => {
    if (item.source === 'email') {
      await supabase.from('admin_emails').update({ is_starred: !item.is_starred }).eq('id', item.id);
      fetchInbox();
    }
  };

  const handleMarkRead = async (item: InboxItem) => {
    if (item.source === 'email') {
      await supabase.from('admin_emails').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', item.id);
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === "unread" && item.is_read) return false;
    if (filter === "starred" && !item.is_starred) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.subject.toLowerCase().includes(q) ||
        item.from_name.toLowerCase().includes(q) ||
        item.from_email.toLowerCase().includes(q);
    }
    return true;
  });

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'email': return <Badge variant="outline" className="text-blue-600 border-blue-600">E-Mail</Badge>;
      case 'support': return <Badge variant="outline" className="text-purple-600 border-purple-600">Support</Badge>;
      case 'contact': return <Badge variant="outline" className="text-green-600 border-green-600">Kontakt</Badge>;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge variant="outline" className="text-green-600 border-green-600 gap-1"><CheckCircle className="w-3 h-3" />Beantwortet</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="text-blue-600 border-blue-600 gap-1"><AlertCircle className="w-3 h-3" />In Bearbeitung</Badge>;
      case 'read':
        return <Badge variant="outline" className="text-gray-600 border-gray-600 gap-1"><Eye className="w-3 h-3" />Gelesen</Badge>;
      default:
        return <Badge variant="outline" className="text-orange-600 border-orange-600 gap-1"><Clock className="w-3 h-3" />Offen</Badge>;
    }
  };

  // Detail view
  if (selectedItem) {
    const orig = selectedItem.original;
    const messageBody = selectedItem.source === 'email'
      ? (orig as AdminEmail).body_html || (orig as AdminEmail).body_text
      : selectedItem.source === 'support'
        ? (orig as SupportMessage).message
        : (orig as ContactMessage).message;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
            </Button>
            {getSourceBadge(selectedItem.source)}
            {getStatusBadge(selectedItem.status)}
          </div>
          <CardTitle className="text-xl mt-2">{selectedItem.subject}</CardTitle>
          <CardDescription>
            Von <strong>{selectedItem.from_name}</strong> ({selectedItem.from_email}) am{" "}
            {format(new Date(selectedItem.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Original message */}
          <div className="p-4 bg-muted/50 rounded-lg border">
            {selectedItem.source === 'email' ? (
              <div dangerouslySetInnerHTML={{ __html: messageBody }} className="prose prose-sm max-w-none" />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{messageBody}</p>
            )}
          </div>

          {/* Previous admin response */}
          {selectedItem.source === 'support' && (orig as SupportMessage).admin_response && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-2">Vorherige Antwort:</p>
              <p className="text-sm whitespace-pre-wrap">{(orig as SupportMessage).admin_response}</p>
            </div>
          )}

          {/* Reply form */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Reply className="w-4 h-4" /> Antwort verfassen
            </Label>
            <p className="text-sm text-muted-foreground">
              An: {selectedItem.from_email}
            </p>
            <RichTextEditor content={replyContent} onChange={setReplyContent} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedItem(null)}>Abbrechen</Button>
              <Button onClick={handleReply} disabled={isReplying || !replyContent.trim()}>
                {isReplying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Antwort senden
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-primary" />
              Posteingang
            </CardTitle>
            <CardDescription>{filteredItems.length} Nachrichten</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="unread">Ungelesen</SelectItem>
                <SelectItem value="starred">Markiert</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchInbox}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-2">Wird geladen...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Keine Nachrichten</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredItems.map((item) => (
              <div
                key={`${item.source}-${item.id}`}
                className={`flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer transition-colors rounded-lg ${!item.is_read ? 'bg-blue-50/50 font-medium' : ''}`}
                onClick={() => {
                  handleMarkRead(item);
                  setSelectedItem(item);
                  setReplyContent("");
                }}
              >
                {item.source === 'email' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleStar(item); }}
                    className="text-muted-foreground hover:text-yellow-500"
                  >
                    {item.is_starred ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> : <StarOff className="w-4 h-4" />}
                  </button>
                )}
                {item.source !== 'email' && <div className="w-4" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm truncate ${!item.is_read ? 'font-semibold' : ''}`}>
                      {item.from_name}
                    </span>
                    {getSourceBadge(item.source)}
                    {!item.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className={`text-sm truncate ${!item.is_read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {item.subject}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.preview}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {item.created_at && format(new Date(item.created_at), "dd.MM. HH:mm", { locale: de })}
                  </p>
                  <div className="mt-1">{getStatusBadge(item.status)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 2: Verfassen ───────────────────────────────────────────────────────

function ComposeTab() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  useEffect(() => {
    supabase.from('email_templates').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setTemplates(data as any);
    });
  }, []);

  const searchRecipients = async (query: string) => {
    setTo(query);
    if (query.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }

    const { data } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, company_name')
      .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,company_name.ilike.%${query}%`)
      .limit(8);

    if (data && data.length > 0) {
      setSuggestions(data);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectRecipient = (profile: any) => {
    setTo(profile.email);
    setRecipientName([profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.company_name || '');
    setShowSuggestions(false);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.body_html);
    }
  };

  const handleSend = async () => {
    if (!to || !subject || !bodyHtml) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-admin-email', {
        body: { to, subject, body_html: bodyHtml, recipient_name: recipientName || undefined },
      });
      if (error) throw error;
      toast.success(`E-Mail an ${to} gesendet`);
      setTo(""); setSubject(""); setBodyHtml(""); setRecipientName(""); setSelectedTemplate("");
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("E-Mail konnte nicht gesendet werden");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          E-Mail verfassen
        </CardTitle>
        <CardDescription>Senden Sie eine E-Mail mit CaravanWert-Branding</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template selection */}
        <div className="flex items-center gap-4">
          <Label className="w-24 flex-shrink-0">Vorlage</Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Vorlage auswählen (optional)" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Recipient */}
        <div className="flex items-start gap-4">
          <Label className="w-24 flex-shrink-0 mt-2.5">An</Label>
          <div className="flex-1 relative">
            <Input
              type="email"
              placeholder="E-Mail-Adresse eingeben oder Benutzer suchen..."
              value={to}
              onChange={(e) => searchRecipients(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 text-sm"
                    onMouseDown={() => selectRecipient(s)}
                  >
                    <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium">
                        {[s.first_name, s.last_name].filter(Boolean).join(' ') || s.company_name || 'Kein Name'}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recipient name */}
        <div className="flex items-center gap-4">
          <Label className="w-24 flex-shrink-0">Name</Label>
          <Input
            placeholder="Empfängername (optional, für Anrede)"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
        </div>

        {/* Subject */}
        <div className="flex items-center gap-4">
          <Label className="w-24 flex-shrink-0">Betreff</Label>
          <Input
            placeholder="Betreff eingeben..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Body */}
        <div>
          <Label className="mb-2 block">Nachricht</Label>
          <RichTextEditor content={bodyHtml} onChange={setBodyHtml} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { setTo(""); setSubject(""); setBodyHtml(""); setRecipientName(""); }}>
            Verwerfen
          </Button>
          <Button onClick={handleSend} disabled={isSending || !to || !subject || !bodyHtml}>
            {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Senden
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab 3: Rundmail ────────────────────────────────────────────────────────

function BroadcastTab() {
  const [group, setGroup] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [recipientLabel, setRecipientLabel] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingCount, setLoadingCount] = useState(false);

  const fetchRecipientCount = async (selectedGroup: string) => {
    if (!selectedGroup) { setRecipientCount(null); return; }
    setLoadingCount(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-recipient-count', {
        body: { group: selectedGroup },
      });
      if (error) throw error;
      setRecipientCount(data.count);
      setRecipientLabel(data.label);
    } catch (error) {
      console.error("Error fetching count:", error);
      setRecipientCount(null);
    } finally {
      setLoadingCount(false);
    }
  };

  const handleGroupChange = (value: string) => {
    setGroup(value);
    fetchRecipientCount(value);
  };

  const handleTestSend = async () => {
    if (!testEmail || !subject || !bodyHtml) {
      toast.error("Bitte füllen Sie Betreff und Nachricht aus und geben Sie eine Test-E-Mail an");
      return;
    }
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-broadcast-email', {
        body: { subject, body_html: bodyHtml, group, test_mode: true, test_email: testEmail },
      });
      if (error) throw error;
      toast.success(`Test-E-Mail an ${testEmail} gesendet`);
    } catch (error: any) {
      toast.error("Test-E-Mail konnte nicht gesendet werden");
    } finally {
      setIsTesting(false);
    }
  };

  const handleBroadcast = async () => {
    setShowConfirm(false);
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-broadcast-email', {
        body: { subject, body_html: bodyHtml, group },
      });
      if (error) throw error;
      toast.success(`Rundmail gesendet: ${data.sent} erfolgreich, ${data.failed} fehlgeschlagen`);
      setSubject(""); setBodyHtml(""); setGroup(""); setRecipientCount(null);
    } catch (error: any) {
      toast.error("Rundmail konnte nicht gesendet werden");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Rundmail versenden
          </CardTitle>
          <CardDescription>Senden Sie eine E-Mail an eine Empfängergruppe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Group selection */}
          <div className="flex items-center gap-4">
            <Label className="w-32 flex-shrink-0">Empfänger</Label>
            <div className="flex-1">
              <Select value={group} onValueChange={handleGroupChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Empfängergruppe auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Benutzer</SelectItem>
                  <SelectItem value="customers">Nur Kunden (Privat)</SelectItem>
                  <SelectItem value="dealers">Alle Händler</SelectItem>
                  <SelectItem value="verified_dealers">Verifizierte Händler</SelectItem>
                  <SelectItem value="newsletter">Newsletter-Abonnenten</SelectItem>
                  <SelectItem value="active_bidders">Aktive Bieter (letzte 30 Tage)</SelectItem>
                </SelectContent>
              </Select>
              {loadingCount && <p className="text-sm text-muted-foreground mt-1">Lade Empfängeranzahl...</p>}
              {recipientCount !== null && !loadingCount && (
                <p className="text-sm mt-1">
                  <Badge variant="secondary" className="mr-1">{recipientCount}</Badge>
                  {recipientLabel} werden diese E-Mail erhalten
                </p>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="flex items-center gap-4">
            <Label className="w-32 flex-shrink-0">Betreff</Label>
            <Input
              placeholder="Betreff eingeben..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div>
            <Label className="mb-2 block">Nachricht</Label>
            <RichTextEditor content={bodyHtml} onChange={setBodyHtml} />
          </div>

          {/* Test send */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
            <Label className="flex-shrink-0">Test an:</Label>
            <Input
              type="email"
              placeholder="Ihre E-Mail für Test..."
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-[300px]"
            />
            <Button variant="outline" onClick={handleTestSend} disabled={isTesting}>
              {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Test senden
            </Button>
          </div>

          {/* Send button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setSubject(""); setBodyHtml(""); setGroup(""); setRecipientCount(null); }}>
              Verwerfen
            </Button>
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={isSending || !group || !subject || !bodyHtml || recipientCount === 0}
              variant="default"
            >
              {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
              Rundmail senden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rundmail versenden?</AlertDialogTitle>
            <AlertDialogDescription>
              Sie sind dabei, eine E-Mail an <strong>{recipientCount} Empfänger</strong> ({recipientLabel}) zu senden.
              Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleBroadcast}>
              Ja, {recipientCount} E-Mails senden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Tab 4: Vorlagen ────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formDescription, setFormDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase.from('email_templates').select('*').order('created_at', { ascending: false });
    setTemplates((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const openCreate = () => {
    setIsCreating(true);
    setEditingTemplate(null);
    setFormName(""); setFormSubject(""); setFormBody(""); setFormCategory("general"); setFormDescription("");
  };

  const openEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setIsCreating(false);
    setFormName(template.name);
    setFormSubject(template.subject);
    setFormBody(template.body_html);
    setFormCategory(template.category);
    setFormDescription(template.description || "");
  };

  const handleSave = async () => {
    if (!formName || !formSubject) { toast.error("Name und Betreff sind erforderlich"); return; }
    setIsSaving(true);
    try {
      if (editingTemplate) {
        await supabase.from('email_templates').update({
          name: formName, subject: formSubject, body_html: formBody,
          category: formCategory, description: formDescription,
        }).eq('id', editingTemplate.id);
        toast.success("Vorlage aktualisiert");
      } else {
        await supabase.from('email_templates').insert({
          name: formName, subject: formSubject, body_html: formBody,
          category: formCategory, description: formDescription,
        });
        toast.success("Vorlage erstellt");
      }
      setEditingTemplate(null); setIsCreating(false);
      fetchTemplates();
    } catch (error) {
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Vorlage wirklich löschen?")) return;
    await supabase.from('email_templates').delete().eq('id', id);
    toast.success("Vorlage gelöscht");
    fetchTemplates();
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      general: 'Allgemein', dealer: 'Händler', customer: 'Kunden',
      system: 'System', marketing: 'Marketing',
    };
    return labels[cat] || cat;
  };

  if (isCreating || editingTemplate) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setIsCreating(false); setEditingTemplate(null); }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
            </Button>
          </div>
          <CardTitle>{editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Vorlagenname" />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Allgemein</SelectItem>
                  <SelectItem value="dealer">Händler</SelectItem>
                  <SelectItem value="customer">Kunden</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Beschreibung</Label>
            <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Kurze Beschreibung (optional)" />
          </div>
          <div>
            <Label>Betreff</Label>
            <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="E-Mail-Betreff" />
          </div>
          <div>
            <Label className="mb-2 block">Inhalt</Label>
            <RichTextEditor content={formBody} onChange={setFormBody} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsCreating(false); setEditingTemplate(null); }}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              E-Mail-Vorlagen
            </CardTitle>
            <CardDescription>{templates.length} Vorlagen</CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Neue Vorlage
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Keine Vorlagen vorhanden</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Betreff</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{t.subject}</TableCell>
                  <TableCell><Badge variant="outline">{getCategoryLabel(t.category)}</Badge></TableCell>
                  <TableCell>{format(new Date(t.created_at), "dd.MM.yyyy", { locale: de })}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
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
  );
}

// ─── Tab 5: Gesendet ────────────────────────────────────────────────────────

function SentTab() {
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<AdminEmail | null>(null);
  const [filter, setFilter] = useState<"all" | "single" | "broadcast" | "reply">("all");

  const fetchSent = async () => {
    setLoading(true);
    const query = supabase
      .from('admin_emails')
      .select('*')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filter !== 'all') {
      query.eq('email_type', filter);
    }

    const { data } = await query;
    setEmails((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchSent(); }, [filter]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'single': return <Badge variant="outline">Einzelmail</Badge>;
      case 'broadcast': return <Badge variant="outline" className="text-purple-600 border-purple-600">Rundmail</Badge>;
      case 'reply': return <Badge variant="outline" className="text-blue-600 border-blue-600">Antwort</Badge>;
      case 'auto': return <Badge variant="outline" className="text-gray-600 border-gray-600">Automatisch</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const sentToday = emails.filter(e => e.created_at.startsWith(today)).length;
  const totalSent = emails.length;
  const broadcastCount = emails.filter(e => e.email_type === 'broadcast').length;

  if (selectedEmail) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
            </Button>
            {getTypeBadge(selectedEmail.email_type)}
          </div>
          <CardTitle className="text-xl mt-2">{selectedEmail.subject}</CardTitle>
          <CardDescription>
            An <strong>{selectedEmail.recipient_name || selectedEmail.recipient_email}</strong> ({selectedEmail.recipient_email}) am{" "}
            {format(new Date(selectedEmail.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg border">
            <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} className="prose prose-sm max-w-none" />
          </div>
          {selectedEmail.resend_id && (
            <p className="text-xs text-muted-foreground mt-4">Resend-ID: {selectedEmail.resend_id}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Gesendete E-Mails
            </CardTitle>
            <CardDescription>{totalSent} E-Mails insgesamt</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 text-sm">
              <Badge variant="secondary">Heute: {sentToday}</Badge>
              <Badge variant="secondary">Rundmails: {broadcastCount}</Badge>
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="single">Einzelmails</SelectItem>
                <SelectItem value="broadcast">Rundmails</SelectItem>
                <SelectItem value="reply">Antworten</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : emails.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Keine gesendeten E-Mails</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empfänger</TableHead>
                <TableHead>Betreff</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{e.recipient_name || e.recipient_email}</p>
                      {e.recipient_name && <p className="text-xs text-muted-foreground">{e.recipient_email}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <p className="truncate text-sm">{e.subject}</p>
                  </TableCell>
                  <TableCell>{getTypeBadge(e.email_type)}</TableCell>
                  <TableCell>
                    <Badge variant={e.status === 'sent' || e.status === 'delivered' ? 'outline' : 'destructive'} className={e.status === 'sent' || e.status === 'delivered' ? 'text-green-600 border-green-600' : ''}>
                      {e.status === 'sent' ? 'Gesendet' : e.status === 'delivered' ? 'Zugestellt' : e.status === 'failed' ? 'Fehlgeschlagen' : e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(e.created_at), "dd.MM.yy HH:mm", { locale: de })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(e)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
