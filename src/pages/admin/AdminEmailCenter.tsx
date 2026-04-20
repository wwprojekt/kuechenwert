import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { FunctionsHttpError } from "@supabase/supabase-js";
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
import { Switch } from "@/components/ui/switch";
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
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail, Inbox, Send, Users, FileText, History,
  Clock, CheckCircle, AlertCircle, Eye, Reply, Star,
  StarOff, Archive, Trash2, RefreshCw, Search, Plus,
  Loader2, ArrowLeft, ExternalLink, User, MessageSquare,
  BarChart3, Paperclip, CalendarClock, UserCircle, XCircle,
  ChevronLeft, ChevronRight, Unlink, Zap, Bot, CheckSquare,
  Settings, Save, MailCheck, Bell, Shield, MousePointerClick,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import DOMPurify from "dompurify";

/**
 * Extract the actual error message from a Supabase FunctionsHttpError.
 * In @supabase/supabase-js v2.100+, error.context is the already-parsed
 * response body (object or string), NOT a raw Response.
 */
function extractEdgeFunctionError(error: any): string {
  if (error instanceof FunctionsHttpError && error.context) {
    const ctx = error.context;
    if (typeof ctx === 'string') {
      try { const j = JSON.parse(ctx); return j?.error || ctx; } catch { return ctx; }
    }
    if (typeof ctx === 'object' && ctx.error) return ctx.error;
  }
  return error?.message || 'Unbekannter Fehler';
}

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe HTML tags commonly used in emails while stripping dangerous elements.
 */
const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'blockquote',
      'code', 'pre', 'hr', 'span', 'div',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'sup', 'sub',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'target', 'rel',
      'style', 'width', 'height', 'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
};

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
  cc: string | null;
  bcc: string | null;
  attachments: any[] | null;
  scheduled_at: string | null;
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
  to_email: string;
  subject: string;
  preview: string;
  status: string;
  is_read: boolean;
  is_starred: boolean;
  created_at: string;
  original: AdminEmail | SupportMessage | ContactMessage;
}

// Dynamische Farben-Palette für automatisch erkannte Postfächer
const MAILBOX_COLOR_PALETTE = [
  'text-blue-600', 'text-red-600', 'text-green-600', 'text-amber-600',
  'text-purple-600', 'text-teal-600', 'text-indigo-600', 'text-pink-600',
  'text-cyan-600', 'text-orange-600', 'text-lime-600', 'text-violet-600',
  'text-sky-600', 'text-rose-600', 'text-emerald-600', 'text-fuchsia-600',
];

// Spezial-Quellen (nicht E-Mail-basiert)
const SPECIAL_SOURCES: Record<string, { label: string; color: string }> = {
  'support': { label: 'Support', color: 'text-purple-600' },
  'contact': { label: 'Kontaktformular', color: 'text-teal-600' },
};

/** Erzeugt ein lesbares Label aus einer E-Mail-Adresse */
const emailToLabel = (email: string): string => {
  const local = email.split('@')[0];
  return `${local}@`;
};

/** Gibt den Postfach-Schlüssel für ein Inbox-Item zurück */
const getItemMailboxKey = (item: InboxItem): string => {
  if (item.source === 'support') return '__source_support';
  if (item.source === 'contact') return '__source_contact';
  return (item.to_email || 'unbekannt').toLowerCase();
};

interface DynamicMailboxTab {
  key: string;
  label: string;
  color: string;
  total: number;
  unread: number;
}

/** Erstellt dynamische Tabs aus den tatsächlich vorhandenen Inbox-Items */
const buildDynamicMailboxTabs = (items: InboxItem[]): DynamicMailboxTab[] => {
  const buckets = new Map<string, { total: number; unread: number }>();

  for (const item of items) {
    const key = getItemMailboxKey(item);
    const existing = buckets.get(key) || { total: 0, unread: 0 };
    existing.total++;
    if (!item.is_read) existing.unread++;
    buckets.set(key, existing);
  }

  // Sortiere: Spezial-Quellen zuletzt, E-Mail-Adressen alphabetisch
  const emailKeys = [...buckets.keys()].filter(k => !k.startsWith('__source_')).sort();
  const sourceKeys = [...buckets.keys()].filter(k => k.startsWith('__source_')).sort();
  const orderedKeys = [...emailKeys, ...sourceKeys];

  let colorIdx = 0;
  const tabs: DynamicMailboxTab[] = [{
    key: 'all',
    label: 'Alle',
    color: 'text-foreground',
    total: items.length,
    unread: items.filter(i => !i.is_read).length,
  }];

  for (const key of orderedKeys) {
    const bucket = buckets.get(key)!;
    if (key.startsWith('__source_')) {
      const sourceId = key.replace('__source_', '');
      const special = SPECIAL_SOURCES[sourceId];
      tabs.push({
        key,
        label: special?.label || sourceId,
        color: special?.color || MAILBOX_COLOR_PALETTE[colorIdx % MAILBOX_COLOR_PALETTE.length],
        total: bucket.total,
        unread: bucket.unread,
      });
    } else {
      tabs.push({
        key,
        label: emailToLabel(key),
        color: MAILBOX_COLOR_PALETTE[colorIdx % MAILBOX_COLOR_PALETTE.length],
        total: bucket.total,
        unread: bucket.unread,
      });
    }
    colorIdx++;
  }

  return tabs;
};

const PAGE_SIZE = 25;

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminEmailCenter() {
  const { user, session } = useAuth();
  const [activeTab, setActiveTab] = useState("inbox");
  const [inboxCount, setInboxCount] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Mail className="w-8 h-8 text-primary" />
          E-Mail-Center
        </h1>
        <p className="text-muted-foreground mt-1">
          E-Mails senden, empfangen und Rundmails verwalten
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto no-scrollbar sm:grid sm:grid-cols-8 h-auto flex-nowrap">
          <TabsTrigger value="inbox" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
            <Inbox className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Posteingang</span>
            <span className="sm:hidden">Eingang</span>
            {inboxCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {inboxCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compose" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
            <Send className="w-4 h-4 flex-shrink-0" />
            Verfassen
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
            <Users className="w-4 h-4 flex-shrink-0" />
            Rundmail
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
            <FileText className="w-4 h-4 flex-shrink-0" />
            Vorlagen
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
            <History className="w-4 h-4 flex-shrink-0" />
            Gesendet
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
            <Zap className="w-4 h-4 flex-shrink-0" />
            System
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Statistiken</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Einstellungen</span>
            <span className="sm:hidden">Einst.</span>
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
        <TabsContent value="system">
          <SystemEmailsTab />
        </TabsContent>
        <TabsContent value="stats">
          <StatsTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: Posteingang (with Realtime + Pagination) ────────────────────────

// Lazy-loaded heavy fields per email row. body_html is intentionally NOT in the
// list query because it can be 10–500 KB per inbound email (newsletter HTML),
// which makes a 200-row inbox load 5–100 MB over the wire. We fetch it on
// demand when a user opens an email and cache by id for the lifetime of the
// component, so re-opening the same email is free.
interface EmailBodyContent {
  body_html: string;
  body_text: string;
  // attachments mirrors AdminEmail.attachments (pre-existing any[] | null shape
  // from the Resend webhook payload — schema is heterogeneous).
  attachments: AdminEmail["attachments"];
  resend_id: string | null;
}

// Narrow shape for the `body_html / body_text / ...` select used by every
// lazy-load (Inbox/Sent/System). Keeps the cast type-safe without leaking
// `any` into call sites.
type EmailBodyRow = Pick<AdminEmail, "body_html" | "body_text" | "attachments" | "resend_id" | "cc" | "bcc">;

function InboxTab({ onUnreadCountChange }: { onUnreadCountChange: (count: number) => void }) {
  const { session } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "starred">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [contactHistory, setContactHistory] = useState<AdminEmail[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<InboxItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [mailboxFilter, setMailboxFilter] = useState<string>('all');
  const [bodyCache, setBodyCache] = useState<Map<string, EmailBodyContent>>(new Map());
  const [loadingBody, setLoadingBody] = useState(false);

  // ── Concurrency + realtime guards ───────────────────────────────────────
  // - inFlightRef: prevents two parallel fetchInbox calls (Realtime can fire
  //   bursts of INSERTs from cron-jobs sending dozens of emails in seconds).
  // - refetchTimerRef: debounces realtime-driven refetches by 1.5s so a cron
  //   batch results in ONE refresh, not N.
  // - subRefetchRef: a stable wrapper used inside the realtime channel so the
  //   channel doesn't have to be torn down/rebuilt every time fetchInbox's
  //   reference changes.
  const inFlightRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subRefetchRef = useRef<() => void>(() => {});

  const fetchInbox = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) { setLoading(false); return; }

      // Run the 3 list queries in parallel — they have no dependencies on
      // each other. Sequential awaits cost 600–1200 ms of RTT for nothing.
      //
      // Both body_html AND body_text are OMITTED here on purpose. The list
      // UI renders only sender, subject and date — the `preview` field on
      // InboxItem is computed but never displayed (verified via grep). For
      // newsletter-heavy inboxes body_text alone can be 5–50 KB per row,
      // so dropping it saves another 1–10 MB of wire payload per refresh.
      // body_text is still lazy-loaded on detail open via the body cache.
      const [emailsRes, supportRes, contactRes] = await Promise.all([
        supabase
          .from("admin_emails")
          .select("id, sender_email, sender_name, recipient_email, recipient_name, subject, status, is_read, is_starred, created_at, email_type, direction, scheduled_at")
          .eq("direction", "inbound")
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("support_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("contact_messages")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const emails = emailsRes.data;
      const supportMsgs = supportRes.data;
      const contactMsgs = contactRes.data;

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

      const inboxItems: InboxItem[] = [];

      // preview is intentionally empty — the row UI does not render it
      // (verified). body_text is fetched lazily into the body cache when an
      // item is opened, which is where the body is actually shown.
      (emails || []).forEach((e: any) => {
        inboxItems.push({
          id: e.id,
          source: 'email',
          from_name: e.sender_name || e.sender_email,
          from_email: e.sender_email,
          to_email: e.recipient_email || '',
          subject: e.subject,
          preview: '',
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
          to_email: 'support@caravanwert.de',
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
          to_email: 'info@caravanwert.de',
          subject: c.subject,
          preview: (c.message || '').substring(0, 120),
          status: c.status || 'open',
          is_read: c.status === 'resolved',
          is_starred: false,
          created_at: c.created_at || '',
          original: c,
        });
      });

      inboxItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(inboxItems);
      onUnreadCountChange(inboxItems.filter(i => !i.is_read).length);
    } catch (error) {
      console.error("Error fetching inbox:", error);
      toast.error("Posteingang konnte nicht geladen werden");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  // Keep the realtime channel pointing at the latest fetchInbox without
  // re-subscribing every time the callback identity changes.
  useEffect(() => {
    subRefetchRef.current = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => { fetchInbox(); }, 1500);
    };
  }, [fetchInbox]);

  useEffect(() => {
    fetchInbox();
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [fetchInbox]);

  // Inbox refresh strategy: polling every 30s + on tab-focus (visibilitychange).
  //
  // Migrated 2026-04-20 from Realtime postgres_changes → polling because
  // `admin_emails` was removed from the supabase_realtime publication
  // (it was the single biggest source of WAL-decoder load: 13k writes/24h
  // fanned out for ≤ 1 listener). support_messages + contact_messages
  // were never in the publication either, so their realtime listeners
  // never fired anyway.
  //
  // Polling is invisible to the admin user: 30s lag for new messages is
  // imperceptible, and the focus-trigger gives a near-instant refresh
  // when switching back to the tab. inFlightRef guards prevent overlap.
  useEffect(() => {
    const POLL_MS = 30_000;

    const tick = () => {
      if (document.visibilityState === 'visible') {
        subRefetchRef.current();
      }
    };

    const intervalId = setInterval(tick, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        subRefetchRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Lazy-load body_html + attachments + resend_id when an inbound email is
  // opened in detail view. Cached by id for the component's lifetime; once an
  // email body is fetched, re-opening it (e.g. after navigating away and back
  // within the same tab session) is instant.
  useEffect(() => {
    if (!selectedItem || selectedItem.source !== 'email') return;
    if (bodyCache.has(selectedItem.id)) return;

    let cancelled = false;
    setLoadingBody(true);
    (async () => {
      const ok = await ensureValidRLSSession();
      if (!ok || cancelled) { if (!cancelled) setLoadingBody(false); return; }
      const { data, error } = await supabase
        .from('admin_emails')
        .select('body_html, body_text, attachments, resend_id')
        .eq('id', selectedItem.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadingBody(false);
        return;
      }
      const row = data as Partial<EmailBodyRow>;
      setBodyCache(prev => {
        const next = new Map(prev);
        next.set(selectedItem.id, {
          body_html: row.body_html || '',
          body_text: row.body_text || '',
          attachments: (row.attachments ?? []) as AdminEmail["attachments"],
          resend_id: row.resend_id ?? null,
        });
        return next;
      });
      setLoadingBody(false);
    })();
    return () => { cancelled = true; };
  }, [selectedItem, bodyCache]);

  // Contact history
  const fetchContactHistory = async (email: string) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;

    const { data } = await supabase
      .from("admin_emails")
      .select("*")
      .or(`sender_email.eq.${email},recipient_email.eq.${email}`)
      .order("created_at", { ascending: false })
      .limit(50);
    setContactHistory((data || []) as any);
    setShowHistory(true);
  };

  const handleReply = async () => {
    if (!selectedItem || !replyContent.trim()) return;
    setIsReplying(true);
    try {
      const { data, error } = await invokeWithAuth('send-admin-email', {
        body: {
          to: selectedItem.from_email,
          subject: `Re: ${selectedItem.subject}`,
          body_html: replyContent,
          recipient_name: selectedItem.from_name,
          reply_to_message_id: selectedItem.source !== 'email' ? selectedItem.id : undefined,
          reply_to_message_type: selectedItem.source !== 'email' ? selectedItem.source : undefined,
        },
      });
      if (error) {
        const detail = await extractEdgeFunctionError(error);
        throw new Error(detail);
      }
      toast.success("Antwort gesendet");
      setSelectedItem(null);
      setReplyContent("");
      fetchInbox();
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast.error(`Antwort fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const handleToggleStar = async (item: InboxItem) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    if (item.source === 'email') {
      const { error } = await supabase.from('admin_emails').update({ is_starred: !item.is_starred }).eq('id', item.id);
      if (error) { toast.error("Stern-Status konnte nicht geändert werden"); return; }
      fetchInbox();
    }
  };

  const handleMarkRead = async (item: InboxItem) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    if (item.source === 'email' && !item.is_read) {
      const { error } = await supabase.from('admin_emails').update({ is_read: true, read_at: new Date().toISOString(), status: 'read' }).eq('id', item.id);
      if (error) { toast.error("Gelesen-Status konnte nicht gesetzt werden"); return; }
      fetchInbox();
    }
  };

  const handleArchive = async (item: InboxItem) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    if (item.source === 'email') {
      const { error } = await supabase.from('admin_emails').update({ is_archived: true }).eq('id', item.id);
      if (error) { toast.error("Archivierung fehlgeschlagen"); return; }
      toast.success("Archiviert");
      setSelectedItem(null);
      fetchInbox();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.source === 'email') {
        const { error } = await supabase.from('admin_emails').delete().eq('id', deleteTarget.id);
        if (error) throw error;
      } else if (deleteTarget.source === 'support') {
        const { error } = await supabase.from('support_messages').delete().eq('id', deleteTarget.id);
        if (error) throw error;
      } else if (deleteTarget.source === 'contact') {
        // Soft-Delete: Setzt deleted_at statt Zeilen zu löschen (Nachweispflicht)
        const { error } = await supabase.from('contact_messages').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id);
        if (error) throw error;
      }
      toast.success("Nachricht gelöscht");
      setSelectedItem(null);
      setDeleteTarget(null);
      fetchInbox();
    } catch (error: any) {
      console.error("Error deleting message:", error);
      toast.error("Nachricht konnte nicht gelöscht werden");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Bulk selection helpers ──
  const itemKey = (item: InboxItem) => `${item.source}-${item.id}`;

  const toggleSelect = (item: InboxItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const key = itemKey(item);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setIsDeleting(true);
    try {
      const toDelete = items.filter(i => selectedIds.has(itemKey(i)));
      const emailIds = toDelete.filter(i => i.source === 'email').map(i => i.id);
      const supportIds = toDelete.filter(i => i.source === 'support').map(i => i.id);
      const contactIds = toDelete.filter(i => i.source === 'contact').map(i => i.id);

      const errors: string[] = [];
      if (emailIds.length > 0) {
        const { error } = await supabase.from('admin_emails').delete().in('id', emailIds);
        if (error) errors.push(`E-Mails: ${error.message}`);
      }
      if (supportIds.length > 0) {
        const { error } = await supabase.from('support_messages').delete().in('id', supportIds);
        if (error) errors.push(`Support: ${error.message}`);
      }
      if (contactIds.length > 0) {
        // Soft-Delete: Setzt deleted_at statt Zeilen zu löschen (Nachweispflicht)
        const { error } = await supabase.from('contact_messages').update({ deleted_at: new Date().toISOString() }).in('id', contactIds);
        if (error) errors.push(`Kontakt: ${error.message}`);
      }

      if (errors.length > 0) {
        toast.error(`Fehler beim Löschen: ${errors.join(', ')}`);
      } else {
        toast.success(`${toDelete.length} Nachricht${toDelete.length > 1 ? 'en' : ''} gelöscht`);
      }
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      setSelectedItem(null);
      fetchInbox();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error("Nachrichten konnten nicht gelöscht werden");
    } finally {
      setIsDeleting(false);
    }
  };

  // Dynamische Postfach-Tabs aus den tatsächlich vorhandenen Items generieren
  const dynamicTabs = buildDynamicMailboxTabs(items);

  const filteredItems = items.filter(item => {
    // Postfach-Filter (dynamisch)
    if (mailboxFilter !== 'all' && getItemMailboxKey(item) !== mailboxFilter) return false;
    // Status-Filter
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

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginatedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageKeys = paginatedItems.map(itemKey);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every(k => selectedIds.has(k));
  const somePageSelected = pageKeys.some(k => selectedIds.has(k));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageKeys.forEach(k => next.delete(k));
      } else {
        pageKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

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
        return <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-600 dark:border-gray-400 gap-1"><Eye className="w-3 h-3" />Gelesen</Badge>;
      default:
        return <Badge variant="outline" className="text-orange-600 border-orange-600 gap-1"><Clock className="w-3 h-3" />Offen</Badge>;
    }
  };

  // Detail view
  if (selectedItem) {
    const orig = selectedItem.original;
    const cachedBody = selectedItem.source === 'email' ? bodyCache.get(selectedItem.id) : null;
    const messageBody = selectedItem.source === 'email'
      ? (cachedBody?.body_html || cachedBody?.body_text || '')
      : selectedItem.source === 'support'
        ? (orig as SupportMessage).message
        : (orig as ContactMessage).message;

    const attachments = selectedItem.source === 'email' ? (cachedBody?.attachments ?? null) : null;
    // resend_id comes from the lazy-loaded body payload; fall back to anything
    // that may have been in the list row (older shape) as a defensive default.
    const emailResendId = selectedItem.source === 'email'
      ? (cachedBody?.resend_id ?? (orig as AdminEmail).resend_id ?? null)
      : null;
    const isBodyLoading = selectedItem.source === 'email' && loadingBody && !cachedBody;

    return (<>
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
          <CardDescription className="flex items-center gap-4">
            <span>
              Von <strong>{selectedItem.from_name}</strong> ({selectedItem.from_email}) am{" "}
              {format(new Date(selectedItem.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
            </span>
            <Button
              variant="link"
              size="sm"
              className="text-xs p-0 h-auto"
              onClick={() => fetchContactHistory(selectedItem.from_email)}
            >
              <UserCircle className="w-3 h-3 mr-1" />
              Kontakt-Verlauf
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg border">
            {isBodyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Inhalt wird geladen…
              </div>
            ) : messageBody ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(messageBody) }} className="prose prose-sm max-w-none" />
            ) : (
              <p className="text-muted-foreground italic text-sm">Kein Inhalt verfügbar – der E-Mail-Body konnte beim Empfang nicht geladen werden.</p>
            )}
          </div>

          {/* Attachments */}
          {attachments && attachments.length > 0 && (
            <div className="p-3 bg-muted/30 rounded-lg border">
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <Paperclip className="w-4 h-4" /> {attachments.length} Anhang/Anhänge
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att: any, i: number) => {
                  const hasUrl = att.download_url;
                  const isExpired = att.expires_at && new Date(att.expires_at) < new Date();
                  const canOpen = hasUrl && !isExpired;

                  const handleAttachmentClick = async () => {
                    if (canOpen) {
                      window.open(att.download_url, '_blank');
                    } else if (att.id && emailResendId) {
                      // Fetch fresh download URL from Resend API via Edge Function
                      try {
                        const { data, error } = await invokeWithAuth('fetch-attachment-url', {
                          body: { emailId: emailResendId, attachmentId: att.id },
                        });
                        if (error) {
                          toast.error("Anhang konnte nicht geladen werden");
                          console.error('Failed to fetch attachment URL:', error);
                        } else if (data?.download_url) {
                          window.open(data.download_url, '_blank');
                        } else {
                          toast.error("Kein Download-Link verfügbar");
                        }
                      } catch (err) {
                        console.error('Failed to fetch attachment URL:', err);
                        toast.error("Anhang konnte nicht geladen werden");
                      }
                    } else {
                      toast.error("Anhang kann nicht geöffnet werden (keine Download-Daten verfügbar)");
                    }
                  };

                  return (
                    <Badge
                      key={i}
                      variant="secondary"
                      className={`gap-1 ${hasUrl || att.id ? 'cursor-pointer hover:bg-accent' : 'opacity-60'}`}
                      onClick={handleAttachmentClick}
                    >
                      <FileText className="w-3 h-3" />
                      {att.filename || `Anhang ${i + 1}`}
                      {att.size > 0 && <span className="text-xs opacity-70">({Math.round(att.size / 1024)}KB)</span>}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact info for contact messages */}
          {selectedItem.source === 'contact' && (orig as ContactMessage).phone && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm"><strong>Telefon:</strong> {(orig as ContactMessage).phone}</p>
            </div>
          )}

          {/* Admin response if already replied */}
          {selectedItem.source !== 'email' && (orig as any).admin_response && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-1 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Ihre Antwort
              </p>
              <p className="text-sm">{(orig as any).admin_response}</p>
              {(orig as any).responded_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date((orig as any).responded_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {selectedItem.source === 'email' && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleToggleStar(selectedItem)}>
                  {selectedItem.is_starred ? <StarOff className="w-4 h-4 mr-1" /> : <Star className="w-4 h-4 mr-1" />}
                  {selectedItem.is_starred ? "Stern entfernen" : "Markieren"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleArchive(selectedItem)}>
                  <Archive className="w-4 h-4 mr-1" /> Archivieren
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget(selectedItem)}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Löschen
            </Button>
          </div>

          {/* Reply section */}
          <div className="border-t pt-4">
            <Label className="mb-2 block font-medium">Antworten</Label>
            <RichTextEditor content={replyContent} onChange={setReplyContent} />
            <div className="flex justify-between items-center mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewHtml(replyContent);
                  setShowPreview(true);
                }}
                disabled={!replyContent.trim()}
              >
                <Eye className="w-4 h-4 mr-1" /> Vorschau
              </Button>
              <Button onClick={handleReply} disabled={isReplying || !replyContent.trim()}>
                {isReplying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Reply className="w-4 h-4 mr-2" />}
                Antwort senden
              </Button>
            </div>
          </div>
        </CardContent>

        {/* Contact history dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                Kontakt-Verlauf: {selectedItem.from_email}
              </DialogTitle>
              <DialogDescription>
                Alle E-Mail-Interaktionen mit diesem Kontakt
              </DialogDescription>
            </DialogHeader>
            {contactHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Keine vorherigen Interaktionen gefunden</p>
            ) : (
              <div className="space-y-3">
                {contactHistory.map((h) => (
                  <div key={h.id} className={`p-3 rounded-lg border ${h.direction === 'inbound' ? 'bg-muted/50' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={h.direction === 'inbound' ? '' : 'text-blue-600 border-blue-600'}>
                        {h.direction === 'inbound' ? 'Empfangen' : 'Gesendet'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(h.created_at), "dd.MM.yy HH:mm", { locale: de })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{h.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.body_text || 'Kein Textinhalt'}</p>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Email preview dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>E-Mail-Vorschau (mit CaravanWert-Branding)</DialogTitle>
              <DialogDescription>So wird die E-Mail beim Empfänger aussehen</DialogDescription>
            </DialogHeader>
            <div className="border rounded-lg overflow-hidden">
              <div style={{
                background: 'linear-gradient(135deg, #1a5c6e 0%, #1f8aa2 50%, #24a5c0 100%)',
                padding: '24px',
                textAlign: 'center' as const,
              }}>
                <img src="https://zcrwqxsyptjwkuxfacvq.supabase.co/storage/v1/object/public/branding/logo-email.png" alt="CaravanWert" style={{ height: '40px', margin: '0 auto' }} />
                <p style={{ color: '#b2ebf2', fontSize: '12px', marginTop: '8px' }}>Ihre Plattform für den Wohnmobil-Verkauf</p>
              </div>
              <div style={{ padding: '32px 24px', background: '#ffffff' }}>
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml || '') }} className="prose prose-sm max-w-none" />
              </div>
              <div style={{ background: '#0f4f5c', padding: '24px', textAlign: 'center' as const, color: '#94a3b8', fontSize: '12px' }}>
                <p>Mit freundlichen Grüßen – Ihr CaravanWert Team</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </Card>

      {/* Single delete confirmation dialog - in detail view */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nachricht löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diese Nachricht von <strong>{deleteTarget?.from_name}</strong> mit dem Betreff
              &quot;{deleteTarget?.subject}&quot; endgültig löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Endgültig löschen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);
  }

  return (<>
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-primary" />
              Posteingang
            </CardTitle>
            <CardDescription>
              {filteredItems.length} Nachrichten {filter !== "all" && `(${filter === "unread" ? "ungelesen" : "markiert"})`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9 w-[200px]"
              />
            </div>
            <Select value={filter} onValueChange={(v) => { setFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
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
      {/* Postfach Sub-Tabs (dynamisch generiert) */}
      <div className="px-6 pb-3 -mt-2">
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/40 rounded-lg">
          {dynamicTabs.map(tab => {
            const isActive = mailboxFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setMailboxFilter(tab.key); setPage(1); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                <span className={isActive ? tab.color : ''}>{tab.label}</span>
                {tab.unread > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                  }`}>
                    {tab.unread}
                  </span>
                )}
                {tab.unread === 0 && tab.key !== 'all' && tab.total > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium bg-muted-foreground/10 text-muted-foreground">
                    {tab.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : paginatedItems.length === 0 ? (
          <div className="text-center py-8">
            <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              {mailboxFilter === 'all' ? 'Keine Nachrichten' : `Keine Nachrichten in ${dynamicTabs.find(t => t.key === mailboxFilter)?.label || 'diesem Postfach'}`}
            </p>
          </div>
        ) : (
          <>
            {/* Bulk action toolbar */}
            <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30 rounded-t-lg">
              <Checkbox
                checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAll}
                aria-label="Alle auswählen"
              />
              {selectedIds.size > 0 ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    {selectedIds.size} ausgewählt
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    className="gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Löschen ({selectedIds.size})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-muted-foreground"
                  >
                    Auswahl aufheben
                  </Button>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Alle auswählen</span>
              )}
            </div>

            <div className="divide-y">
              {paginatedItems.map((item) => {
                const key = itemKey(item);
                const isSelected = selectedIds.has(key);
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors ${!item.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20 font-medium' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={() => { setSelectedItem(item); handleMarkRead(item); }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(item)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${item.from_name} auswählen`}
                      className="flex-shrink-0"
                    />
                    {item.source === 'email' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStar(item); }}
                        className="flex-shrink-0"
                      >
                        {item.is_starred
                          ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          : <Star className="w-4 h-4 text-muted-foreground hover:text-yellow-500" />
                        }
                      </button>
                    )}
                    {item.source !== 'email' && <div className="w-4" />}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {item.from_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm truncate ${!item.is_read ? 'font-semibold' : ''}`}>
                          {item.from_name}
                        </span>
                        {getSourceBadge(item.source)}
                        {mailboxFilter === 'all' && item.to_email && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                            {item.to_email.split('@')[0]}@
                          </span>
                        )}
                      </div>
                      <p className={`text-sm truncate ${!item.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {item.subject}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), "dd.MM.yy", { locale: de })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), "HH:mm", { locale: de })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                        className="flex-shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Seite {page} von {totalPages} ({filteredItems.length} Nachrichten)
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>

    {/* Single delete confirmation dialog - for list view */}
    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nachricht löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Sind Sie sicher, dass Sie diese Nachricht von <strong>{deleteTarget?.from_name}</strong> mit dem Betreff
            &quot;{deleteTarget?.subject}&quot; endgültig löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Endgültig löschen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Bulk delete confirmation dialog */}
    <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{selectedIds.size} Nachrichten löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Sind Sie sicher, dass Sie <strong>{selectedIds.size} ausgewählte Nachrichten</strong> endgültig löschen möchten?
            Dieser Vorgang kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {selectedIds.size} Nachrichten löschen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ─── Tab 2: Verfassen (with Preview + Attachments + Scheduled Send) ─────────

function ComposeTab() {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signature, setSignature] = useState(() => {
    return localStorage.getItem('admin_email_signature') || '';
  });
  const [appendSignature, setAppendSignature] = useState(() => {
    return localStorage.getItem('admin_email_append_signature') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('admin_email_signature', signature);
  }, [signature]);

  useEffect(() => {
    localStorage.setItem('admin_email_append_signature', String(appendSignature));
  }, [appendSignature]);

  useEffect(() => {
    supabase.from('email_templates').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setTemplates((data || []) as any));
  }, []);

  // Debounce profile search so we don't fire a query per keystroke (which
  // both hammers the DB and creates a flickering suggestion list).
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const searchRecipients = (query: string) => {
    setTo(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    searchTimerRef.current = setTimeout(async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, company_name")
        .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,company_name.ilike.%${query}%`)
        .limit(8);
      setSuggestions(data || []);
      setShowSuggestions(true);
    }, 250);
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
    if (!to || !subject || !bodyHtml) { toast.error("Bitte füllen Sie alle Pflichtfelder aus"); return; }
    setIsSending(true);
    try {
      const { data, error } = await invokeWithAuth('send-admin-email', {
        body: {
          to,
          subject,
          body_html: appendSignature && signature ? `${bodyHtml}<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;">${signature.replace(/\n/g, '<br/>')}</div>` : bodyHtml,
          recipient_name: recipientName || undefined,
          cc: cc || undefined,
          bcc: bcc || undefined,
          scheduled_at: scheduledAt || undefined,
        },
      });
      if (error) {
        const detail = await extractEdgeFunctionError(error);
        throw new Error(detail);
      }
      if (scheduledAt) {
        toast.success(`E-Mail geplant für ${format(new Date(scheduledAt), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}`);
      } else {
        toast.success(`E-Mail an ${to} gesendet`);
      }
      setTo(""); setSubject(""); setBodyHtml(""); setRecipientName("");
      setSelectedTemplate(""); setCc(""); setBcc(""); setScheduledAt("");
      setShowCcBcc(false); setShowSchedule(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(`E-Mail fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
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
                <div className="absolute z-50 w-full mt-1 bg-card dark:bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
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

          {/* CC/BCC toggle */}
          {!showCcBcc && (
            <div className="flex items-center gap-4">
              <div className="w-24" />
              <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setShowCcBcc(true)}>
                CC/BCC hinzufügen
              </Button>
            </div>
          )}

          {showCcBcc && (
            <>
              <div className="flex items-center gap-4">
                <Label className="w-24 flex-shrink-0">CC</Label>
                <Input placeholder="CC-Empfänger (kommagetrennt)" value={cc} onChange={(e) => setCc(e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <Label className="w-24 flex-shrink-0">BCC</Label>
                <Input placeholder="BCC-Empfänger (kommagetrennt)" value={bcc} onChange={(e) => setBcc(e.target.value)} />
              </div>
            </>
          )}

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

          {/* Signature */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
            <Switch
              checked={appendSignature}
              onCheckedChange={setAppendSignature}
              id="signature-toggle"
            />
            <Label htmlFor="signature-toggle" className="cursor-pointer flex-1">
              <span className="font-medium">E-Mail-Signatur anhängen</span>
              <p className="text-xs text-muted-foreground">
                {signature ? 'Signatur wird automatisch an jede E-Mail angehängt' : 'Noch keine Signatur konfiguriert'}
              </p>
            </Label>
            <Button variant="outline" size="sm" onClick={() => setShowSignature(true)}>
              {signature ? 'Bearbeiten' : 'Einrichten'}
            </Button>
          </div>

          {/* Scheduled send */}
          {!showSchedule ? (
            <div className="flex items-center gap-4">
              <div className="w-24" />
              <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setShowSchedule(true)}>
                <CalendarClock className="w-3 h-3 mr-1" /> Zeitversetzt senden
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
              <Label className="flex-shrink-0 flex items-center gap-1">
                <CalendarClock className="w-4 h-4" /> Senden am
              </Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="max-w-[250px]"
              />
              <Button variant="ghost" size="sm" onClick={() => { setShowSchedule(false); setScheduledAt(""); }}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!bodyHtml.trim()}
            >
              <Eye className="w-4 h-4 mr-2" /> Vorschau
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setTo(""); setSubject(""); setBodyHtml(""); setRecipientName("");
                setCc(""); setBcc(""); setScheduledAt("");
              }}>
                Verwerfen
              </Button>
              <Button onClick={handleSend} disabled={isSending || !to || !subject || !bodyHtml}>
                {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : scheduledAt ? <CalendarClock className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {scheduledAt ? "Planen" : "Senden"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature dialog */}
      <Dialog open={showSignature} onOpenChange={setShowSignature}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>E-Mail-Signatur konfigurieren</DialogTitle>
            <DialogDescription>
              Diese Signatur wird automatisch an alle E-Mails angehängt, die Sie über das E-Mail-Center senden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={"Max Mustermann\nGeschäftsführer\nCaravanWert GmbH\nTel: +49 123 456789\ninfo@caravanwert.de"}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-xs font-medium mb-1">Vorschau:</p>
              <div style={{marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '13px'}}>
                {signature ? signature.split('\n').map((line: string, i: number) => (
                  <span key={i}>{line}<br/></span>
                )) : <span className="text-muted-foreground italic">Keine Signatur</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSignature(''); setAppendSignature(false); setShowSignature(false); }}>Entfernen</Button>
            <Button onClick={() => { setAppendSignature(true); setShowSignature(false); toast.success('Signatur gespeichert'); }}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail-Vorschau</DialogTitle>
            <DialogDescription>
              An: {to} | Betreff: {subject}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <div style={{
              background: 'linear-gradient(135deg, #1a5c6e 0%, #1f8aa2 50%, #24a5c0 100%)',
              padding: '24px',
              textAlign: 'center' as const,
            }}>
              <img src="https://zcrwqxsyptjwkuxfacvq.supabase.co/storage/v1/object/public/branding/logo-email.png" alt="CaravanWert" style={{ height: '40px', margin: '0 auto' }} />
              <p style={{ color: '#b2ebf2', fontSize: '12px', marginTop: '8px' }}>Ihre Plattform für den Wohnmobil-Verkauf</p>
            </div>
            <div style={{ padding: '32px 24px', background: '#ffffff' }}>
              {recipientName && <p style={{ marginBottom: '16px' }}>Hallo {recipientName},</p>}
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml || '') }} className="prose prose-sm max-w-none" />
              {appendSignature && signature && (
                <div style={{marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '13px'}}>
                  {signature.split('\n').map((line: string, i: number) => (
                    <span key={i}>{line}<br/></span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ background: '#0f4f5c', padding: '24px', textAlign: 'center' as const, color: '#94a3b8', fontSize: '12px' }}>
              <p style={{ color: '#e2e8f0', marginBottom: '8px' }}>Mit freundlichen Grüßen – Ihr CaravanWert Team</p>
              <p>CaravanWert | info@caravanwert.de | caravanwert.de</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Tab 3: Rundmail (with Unsubscribe option) ─────────────────────────────

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
  const [includeUnsubscribe, setIncludeUnsubscribe] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const fetchRecipientCount = async (selectedGroup: string) => {
    if (!selectedGroup) { setRecipientCount(null); return; }
    setLoadingCount(true);
    try {
      const { data, error } = await invokeWithAuth('get-recipient-count', {
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
      const { data, error } = await invokeWithAuth('send-broadcast-email', {
        body: {
          subject,
          body_html: bodyHtml,
          group,
          test_mode: true,
          test_email: testEmail,
          include_unsubscribe: includeUnsubscribe,
        },
      });
      if (error) throw error;
      toast.success(`Test-E-Mail an ${testEmail} gesendet`);
    } catch (error: any) {
      toast.error("Test-E-Mail konnte nicht gesendet werden");
    } finally {
      setIsTesting(false);
    }
  };

  const checkDuplicate = async () => {
    if (!group || !subject) return;
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('admin_emails')
        .select('id, created_at')
        .eq('email_type', 'broadcast')
        .eq('broadcast_group', group)
        .eq('subject', subject)
        .gte('created_at', twoHoursAgo)
        .limit(1);
      if (data && data.length > 0) {
        const sentAt = format(new Date(data[0].created_at), "dd.MM.yy HH:mm", { locale: de });
        setDuplicateWarning(`Eine Rundmail mit dem gleichen Betreff wurde bereits am ${sentAt} an diese Gruppe gesendet.`);
      } else {
        setDuplicateWarning(null);
      }
    } catch (e) {
      console.error('Duplicate check error:', e);
    }
  };

  useEffect(() => {
    if (group && subject) checkDuplicate();
    else setDuplicateWarning(null);
  }, [group, subject]);

  const handleBroadcast = async () => {
    setShowConfirm(false);
    setIsSending(true);
    try {
      const { data, error } = await invokeWithAuth('send-broadcast-email', {
        body: {
          subject,
          body_html: bodyHtml,
          group,
          include_unsubscribe: includeUnsubscribe,
        },
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

          {/* Unsubscribe option */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
            <Switch
              checked={includeUnsubscribe}
              onCheckedChange={setIncludeUnsubscribe}
              id="unsubscribe"
            />
            <Label htmlFor="unsubscribe" className="cursor-pointer">
              <span className="font-medium">Abmelde-Link einfügen</span>
              <p className="text-xs text-muted-foreground">
                Empfänger können sich von zukünftigen Rundmails abmelden (empfohlen für Marketing-E-Mails)
              </p>
            </Label>
          </div>

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Möglicher Doppelversand</p>
                <p className="text-xs text-yellow-700">{duplicateWarning}</p>
              </div>
            </div>
          )}

          {/* Test send */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
            <Label className="flex-shrink-0">Test an:</Label>
            <Input
              type="email"
              placeholder="Ihre E-Mail für Testversand..."
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
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!bodyHtml.trim()}
            >
              <Eye className="w-4 h-4 mr-2" /> Vorschau
            </Button>
            <div className="flex gap-2">
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
              {includeUnsubscribe && " Ein Abmelde-Link wird am Ende der E-Mail eingefügt."}
              {" "}Dieser Vorgang kann nicht rückgängig gemacht werden.
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

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rundmail-Vorschau</DialogTitle>
            <DialogDescription>
              An: {recipientLabel || "Empfängergruppe"} ({recipientCount || 0} Empfänger)
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <div style={{
              background: 'linear-gradient(135deg, #1a5c6e 0%, #1f8aa2 50%, #24a5c0 100%)',
              padding: '24px',
              textAlign: 'center' as const,
            }}>
              <img src="https://zcrwqxsyptjwkuxfacvq.supabase.co/storage/v1/object/public/branding/logo-email.png" alt="CaravanWert" style={{ height: '40px', margin: '0 auto' }} />
              <p style={{ color: '#b2ebf2', fontSize: '12px', marginTop: '8px' }}>Ihre Plattform für den Wohnmobil-Verkauf</p>
            </div>
            <div style={{ padding: '32px 24px', background: '#ffffff' }}>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml || '') }} className="prose prose-sm max-w-none" />
            </div>
            {includeUnsubscribe && (
              <div style={{ padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center' as const }}>
                <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Sie erhalten diese E-Mail, weil Sie bei CaravanWert registriert sind.{" "}
                  <span style={{ color: '#1f8aa2', textDecoration: 'underline' }}>Abmelden</span>
                </p>
              </div>
            )}
            <div style={{ background: '#0f4f5c', padding: '24px', textAlign: 'center' as const, color: '#94a3b8', fontSize: '12px' }}>
              <p style={{ color: '#e2e8f0', marginBottom: '8px' }}>Mit freundlichen Grüßen – Ihr CaravanWert Team</p>
              <p>CaravanWert | info@caravanwert.de | caravanwert.de</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

// ─── Tab 5: Gesendet (with Pagination) ─────────────────────────────────────

function SentTab() {
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<AdminEmail | null>(null);
  const [filter, setFilter] = useState<"all" | "single" | "broadcast" | "reply">("all");
  const [page, setPage] = useState(1);

  // Cache for lazy-loaded body content (body_html / cc / bcc fetched only when
  // the user opens an email in detail view). Keeps the list query light.
  const [bodyCache, setBodyCache] = useState<Map<string, { body_html: string; body_text: string; cc: string | null; bcc: string | null; resend_id: string | null }>>(new Map());
  const [loadingBody, setLoadingBody] = useState(false);

  const fetchSent = async () => {
    setLoading(true);
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) { setLoading(false); return; }

    // body_html / body_text excluded from the list — they're lazy-loaded when
    // the admin opens an individual email. Limit lowered from 1000 → 500 since
    // the UI paginates at 25 per page; 500 already covers ~20 pages.
    const query = supabase
      .from('admin_emails')
      .select('id, sender_email, sender_name, recipient_email, recipient_name, subject, status, email_type, direction, created_at, scheduled_at, broadcast_id, broadcast_group')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filter !== 'all') {
      query.eq('email_type', filter);
    }

    const { data } = await query;
    setEmails((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchSent(); setPage(1); }, [filter]);

  // Lazy-load body when user opens a sent email
  useEffect(() => {
    if (!selectedEmail) return;
    if (bodyCache.has(selectedEmail.id)) return;

    let cancelled = false;
    setLoadingBody(true);
    (async () => {
      const ok = await ensureValidRLSSession();
      if (!ok || cancelled) { if (!cancelled) setLoadingBody(false); return; }
      const { data, error } = await supabase
        .from('admin_emails')
        .select('body_html, body_text, cc, bcc, resend_id')
        .eq('id', selectedEmail.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadingBody(false);
        return;
      }
      const row = data as Partial<EmailBodyRow>;
      setBodyCache(prev => {
        const next = new Map(prev);
        next.set(selectedEmail.id, {
          body_html: row.body_html || '',
          body_text: row.body_text || '',
          cc: row.cc ?? null,
          bcc: row.bcc ?? null,
          resend_id: row.resend_id ?? null,
        });
        return next;
      });
      setLoadingBody(false);
    })();
    return () => { cancelled = true; };
  }, [selectedEmail, bodyCache]);

  const totalPages = Math.ceil(emails.length / PAGE_SIZE);
  const paginatedEmails = emails.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'single': return <Badge variant="outline">Einzelmail</Badge>;
      case 'broadcast': return <Badge variant="outline" className="text-purple-600 border-purple-600">Rundmail</Badge>;
      case 'reply': return <Badge variant="outline" className="text-blue-600 border-blue-600">Antwort</Badge>;
      case 'auto': return <Badge variant="outline" className="text-orange-600 border-orange-600">Automatisch</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const sentToday = emails.filter(e => e.created_at.startsWith(today)).length;
  const broadcastCount = emails.filter(e => e.email_type === 'broadcast').length;

  if (selectedEmail) {
    const cachedBody = bodyCache.get(selectedEmail.id);
    const ccLine = cachedBody?.cc ?? selectedEmail.cc;
    const resendId = cachedBody?.resend_id ?? selectedEmail.resend_id;
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
            {ccLine && <span className="block mt-1">CC: {ccLine}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg border">
            {loadingBody && !cachedBody ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Inhalt wird geladen…
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(cachedBody?.body_html || cachedBody?.body_text || '') }} className="prose prose-sm max-w-none" />
            )}
          </div>
          {resendId && (
            <p className="text-xs text-muted-foreground mt-4">Resend-ID: {resendId}</p>
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
            <CardDescription>{emails.length} E-Mails insgesamt</CardDescription>
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
        ) : paginatedEmails.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Keine gesendeten E-Mails</p>
          </div>
        ) : (
          <>
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
                {paginatedEmails.map((e) => (
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
                      <Badge variant={e.status === 'bounced' || e.status === 'failed' ? 'destructive' : 'outline'} className={
                        e.status === 'sent' || e.status === 'delivered' ? 'text-green-600 border-green-600' :
                        e.status === 'opened' ? 'text-blue-600 border-blue-600' :
                        e.status === 'clicked' ? 'text-purple-600 border-purple-600' : ''
                      }>
                        {e.status === 'sent' ? 'Gesendet' : e.status === 'delivered' ? 'Zugestellt' : e.status === 'opened' ? 'Geöffnet' : e.status === 'clicked' ? 'Angeklickt' : e.status === 'bounced' ? 'Bounced' : e.status === 'failed' ? 'Fehlgeschlagen' : e.status}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Seite {page} von {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <Button key={pageNum} variant={page === pageNum ? "default" : "outline"} size="sm" onClick={() => setPage(pageNum)} className="w-8 h-8 p-0">
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 6: Statistiken ─────────────────────────────────────────────────────

function StatsTab() {
  const [stats, setStats] = useState({
    totalSent: 0,
    totalInbound: 0,
    sentToday: 0,
    sentThisWeek: 0,
    sentThisMonth: 0,
    broadcasts: 0,
    singleEmails: 0,
    replies: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) { setLoading(false); return; }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayStartIso = todayStart.toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

      // Server-side aggregation via head:true count queries — runs in Postgres
      // and transfers ZERO rows over the wire. The previous implementation
      // pulled the entire outbound table (10K+ rows with metadata) just to
      // call .filter().length — fine at 100 emails, fatal at 100K.
      type CountRes = { count: number | null };
      // Minimal builder surface we use — typing the full PostgrestFilterBuilder
      // generic chain would require importing it from @supabase/postgrest-js
      // and threading 5+ type params through every call, which adds noise
      // without runtime safety.
      interface CountQuery {
        eq(col: string, val: string): CountQuery;
        in(col: string, vals: readonly string[]): CountQuery;
        gte(col: string, val: string): CountQuery;
        then<T>(onfulfilled: (v: CountRes) => T): Promise<T>;
      }
      const outboundCount = (build: (q: CountQuery) => CountQuery = (q) => q): Promise<CountRes> => {
        const base = supabase.from('admin_emails').select('id', { count: 'exact', head: true }).eq('direction', 'outbound') as unknown as CountQuery;
        return build(base) as unknown as Promise<CountRes>;
      };

      const [
        totalSentRes,
        totalInboundRes,
        sentTodayRes,
        sentWeekRes,
        sentMonthRes,
        broadcastsRes,
        singleRes,
        replyRes,
        deliveredRes,
        openedRes,
        clickedRes,
        bouncedRes,
        failedRes,
        recentBroadcastEmails,
      ] = await Promise.all([
        outboundCount(),
        // Inbound count uses the same head:true trick. Returned shape is
        // { data, count, error } — only `count` is needed.
        supabase.from('admin_emails').select('id', { count: 'exact', head: true }).eq('direction', 'inbound').then((r) => ({ count: r.count })),
        outboundCount((q) => q.gte('created_at', todayStartIso)),
        outboundCount((q) => q.gte('created_at', weekAgo)),
        outboundCount((q) => q.gte('created_at', monthAgo)),
        outboundCount((q) => q.eq('email_type', 'broadcast')),
        outboundCount((q) => q.eq('email_type', 'single')),
        outboundCount((q) => q.eq('email_type', 'reply')),
        outboundCount((q) => q.in('status', ['delivered', 'sent'])),
        outboundCount((q) => q.in('status', ['opened', 'clicked'])),
        outboundCount((q) => q.eq('status', 'clicked')),
        outboundCount((q) => q.eq('status', 'bounced')),
        outboundCount((q) => q.eq('status', 'failed')),
        // Recent broadcasts: scope to last 90 days + hard cap at 5000 rows.
        // Even at 500 recipients per broadcast that covers ~10 distinct
        // broadcasts, which is exactly what the UI shows below.
        supabase
          .from('admin_emails')
          .select('subject, broadcast_id, broadcast_group, created_at')
          .eq('direction', 'outbound')
          .eq('email_type', 'broadcast')
          .not('broadcast_id', 'is', null)
          .gte('created_at', ninetyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5000),
      ]);

      setStats({
        totalSent: totalSentRes.count || 0,
        totalInbound: totalInboundRes.count || 0,
        sentToday: sentTodayRes.count || 0,
        sentThisWeek: sentWeekRes.count || 0,
        sentThisMonth: sentMonthRes.count || 0,
        broadcasts: broadcastsRes.count || 0,
        singleEmails: singleRes.count || 0,
        replies: replyRes.count || 0,
        delivered: deliveredRes.count || 0,
        opened: openedRes.count || 0,
        clicked: clickedRes.count || 0,
        bounced: bouncedRes.count || 0,
        failed: failedRes.count || 0,
      });

      type BroadcastRow = Pick<AdminEmail, "subject" | "broadcast_id" | "broadcast_group" | "created_at">;
      const broadcastMap = new Map<string, { subject: string; group: string; count: number; date: string }>();
      const broadcastRows = (recentBroadcastEmails.data ?? []) as BroadcastRow[];
      broadcastRows.forEach((e) => {
        if (!e.broadcast_id) return;
        const existing = broadcastMap.get(e.broadcast_id);
        if (existing) {
          existing.count++;
        } else {
          broadcastMap.set(e.broadcast_id, {
            subject: e.subject,
            group: e.broadcast_group || '',
            count: 1,
            date: e.created_at,
          });
        }
      });

      setRecentBroadcasts(
        Array.from(broadcastMap.values())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10)
      );
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGroupLabel = (group: string) => {
    const labels: Record<string, string> = {
      all: 'Alle Benutzer', customers: 'Kunden', dealers: 'Händler',
      verified_dealers: 'Verifizierte Händler', newsletter: 'Newsletter', active_bidders: 'Aktive Bieter',
    };
    return labels[group] || group;
  };

  if (loading) {
    return (
      <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSent}</p>
                <p className="text-xs text-muted-foreground">Gesamt gesendet</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Inbox className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalInbound}</p>
                <p className="text-xs text-muted-foreground">Empfangen</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.broadcasts}</p>
                <p className="text-xs text-muted-foreground">Rundmail-Empfänger</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sentToday}</p>
                <p className="text-xs text-muted-foreground">Heute gesendet</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Versand-Übersicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Heute</span>
                <Badge variant="secondary">{stats.sentToday}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Diese Woche</span>
                <Badge variant="secondary">{stats.sentThisWeek}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Diesen Monat</span>
                <Badge variant="secondary">{stats.sentThisMonth}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Einzelmails</span>
                <Badge variant="outline">{stats.singleEmails}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Rundmails</span>
                <Badge variant="outline" className="text-purple-600 border-purple-600">{stats.broadcasts}</Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">Antworten</span>
                <Badge variant="outline" className="text-blue-600 border-blue-600">{stats.replies}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zustellstatus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" /> Zugestellt
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-600">{stats.delivered}</Badge>
                  {stats.totalSent > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((stats.delivered / stats.totalSent) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" /> Geöffnet
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-600 border-blue-600">{stats.opened}</Badge>
                  {stats.delivered > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((stats.opened / stats.delivered) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-purple-600" /> Angeklickt
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-purple-600 border-purple-600">{stats.clicked}</Badge>
                  {stats.opened > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((stats.clicked / stats.opened) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" /> Bounced
                </span>
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">{stats.bounced}</Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" /> Fehlgeschlagen
                </span>
                <Badge variant="outline" className="text-red-600 border-red-600">{stats.failed}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent broadcasts */}
      {recentBroadcasts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Letzte Rundmails</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Empfängergruppe</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBroadcasts.map((b, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium max-w-[250px] truncate">{b.subject}</TableCell>
                    <TableCell><Badge variant="outline">{getGroupLabel(b.group)}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{b.count}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(b.date), "dd.MM.yy HH:mm", { locale: de })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: System-E-Mails (automatisch versendete E-Mails) ─────────────────

// System email types that are NOT manually sent by admin
const SYSTEM_EMAIL_TYPES = [
  'auto_response',
  'welcome',
  'wizard_recovery_first',
  'wizard_recovery_followup',
  'inactivity',
  'appointment_reminder',
  'payment_reminder',
  'auction_summary',
  'favorite_notification',
  'scheduled',
];

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  auto_response: 'Auto-Antwort',
  welcome: 'Willkommen',
  wizard_recovery_first: 'Wizard-Erinnerung (2h)',
  wizard_recovery_followup: 'Wizard-Follow-up (14d)',
  inactivity: 'Inaktivitäts-Erinnerung',
  appointment_reminder: 'Termin-Erinnerung',
  payment_reminder: 'Zahlungserinnerung',
  auction_summary: 'Auktions-Zusammenfassung',
  favorite_notification: 'Favoriten-Benachrichtigung',
  scheduled: 'Geplant',
  bid_outbid: 'Überboten',
  bid_confirmed: 'Gebot bestätigt',
  expert_valuation: 'Expertenbewertung',
  bid_won: 'Auktion gewonnen',
  auction_ending: 'Auktion endet bald',
  new_auction: 'Neue Auktion',
  lead_notification: 'Lead-Benachrichtigung',
  contact_confirmation: 'Kontaktbestätigung',
  password_reset: 'Passwort zurücksetzen',
  verification: 'Verifizierung',
  invoice: 'Rechnung',
  notification: 'Benachrichtigung',
};

const SYSTEM_TYPE_COLORS: Record<string, string> = {
  auto_response: 'text-blue-600 border-blue-600',
  welcome: 'text-green-600 border-green-600',
  wizard_recovery_first: 'text-orange-600 border-orange-600',
  wizard_recovery_followup: 'text-amber-600 border-amber-600',
  inactivity: 'text-purple-600 border-purple-600',
  appointment_reminder: 'text-cyan-600 border-cyan-600',
  payment_reminder: 'text-red-600 border-red-600',
  auction_summary: 'text-indigo-600 border-indigo-600',
  favorite_notification: 'text-pink-600 border-pink-600',
  scheduled: 'text-slate-600 border-slate-600',
  bid_outbid: 'text-red-500 border-red-500',
  bid_confirmed: 'text-emerald-600 border-emerald-600',
  expert_valuation: 'text-violet-600 border-violet-600',
  bid_won: 'text-green-700 border-green-700',
  auction_ending: 'text-yellow-600 border-yellow-600',
  new_auction: 'text-sky-600 border-sky-600',
  lead_notification: 'text-teal-600 border-teal-600',
  contact_confirmation: 'text-lime-600 border-lime-600',
  password_reset: 'text-gray-600 border-gray-600',
  verification: 'text-blue-500 border-blue-500',
  invoice: 'text-amber-700 border-amber-700',
  notification: 'text-gray-500 border-gray-500',
};

function SystemEmailsTab() {
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<AdminEmail | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Body cache for lazy-loaded detail view (same pattern as InboxTab/SentTab)
  const [bodyCache, setBodyCache] = useState<Map<string, { body_html: string; body_text: string; resend_id: string | null }>>(new Map());
  const [loadingBody, setLoadingBody] = useState(false);

  const fetchSystemEmails = useCallback(async () => {
    setLoading(true);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) { setLoading(false); return; }

      // Fetch all outbound emails that are NOT manual (single, reply, broadcast).
      // body_html / body_text excluded — lazy-loaded on detail open. Limit
      // lowered 1000 → 500 (UI paginates 25 per page).
      const { data, error } = await supabase
        .from('admin_emails')
        .select('id, sender_email, sender_name, recipient_email, recipient_name, subject, status, email_type, direction, created_at, scheduled_at')
        .eq('direction', 'outbound')
        .not('email_type', 'in', '("single","reply","broadcast")')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setEmails((data || []) as AdminEmail[]);
    } catch (error) {
      console.error("Error fetching system emails:", error);
      toast.error("System-E-Mails konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSystemEmails(); }, [fetchSystemEmails]);

  // Lazy-load body when user opens a system email
  useEffect(() => {
    if (!selectedEmail) return;
    if (bodyCache.has(selectedEmail.id)) return;

    let cancelled = false;
    setLoadingBody(true);
    (async () => {
      const ok = await ensureValidRLSSession();
      if (!ok || cancelled) { if (!cancelled) setLoadingBody(false); return; }
      const { data, error } = await supabase
        .from('admin_emails')
        .select('body_html, body_text, resend_id')
        .eq('id', selectedEmail.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadingBody(false);
        return;
      }
      const row = data as Partial<EmailBodyRow>;
      setBodyCache(prev => {
        const next = new Map(prev);
        next.set(selectedEmail.id, {
          body_html: row.body_html || '',
          body_text: row.body_text || '',
          resend_id: row.resend_id ?? null,
        });
        return next;
      });
      setLoadingBody(false);
    })();
    return () => { cancelled = true; };
  }, [selectedEmail, bodyCache]);

  // Filter by type and search
  const filteredEmails = emails.filter(e => {
    if (filter !== 'all' && e.email_type !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.subject.toLowerCase().includes(q) ||
        e.recipient_email.toLowerCase().includes(q) ||
        (e.recipient_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredEmails.length / PAGE_SIZE);
  const paginatedEmails = filteredEmails.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Count per type for summary
  const typeCounts = emails.reduce<Record<string, number>>((acc, e) => {
    acc[e.email_type] = (acc[e.email_type] || 0) + 1;
    return acc;
  }, {});

  const getSystemTypeBadge = (type: string) => {
    const label = SYSTEM_TYPE_LABELS[type] || type;
    const color = SYSTEM_TYPE_COLORS[type] || 'text-gray-600 border-gray-600';
    return <Badge variant="outline" className={`${color} gap-1`}><Zap className="w-3 h-3" />{label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="outline" className="text-green-600 border-green-600 gap-1"><CheckCircle className="w-3 h-3" />Gesendet</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="text-green-700 border-green-700 gap-1"><CheckCircle className="w-3 h-3" />Zugestellt</Badge>;
      case 'opened':
        return <Badge variant="outline" className="text-blue-600 border-blue-600 gap-1"><Eye className="w-3 h-3" />Geöffnet</Badge>;
      case 'clicked':
        return <Badge variant="outline" className="text-purple-600 border-purple-600 gap-1"><MousePointerClick className="w-3 h-3" />Angeklickt</Badge>;
      case 'bounced':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600 gap-1"><AlertCircle className="w-3 h-3" />Bounced</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-red-600 border-red-600 gap-1"><XCircle className="w-3 h-3" />Fehlgeschlagen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Detail view
  if (selectedEmail) {
    const cachedBody = bodyCache.get(selectedEmail.id);
    const resendId = cachedBody?.resend_id ?? selectedEmail.resend_id;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
            </Button>
            {getSystemTypeBadge(selectedEmail.email_type)}
            {getStatusBadge(selectedEmail.status)}
          </div>
          <CardTitle className="text-xl mt-2">{selectedEmail.subject}</CardTitle>
          <CardDescription>
            An <strong>{selectedEmail.recipient_name || selectedEmail.recipient_email}</strong> ({selectedEmail.recipient_email}) am{" "}
            {format(new Date(selectedEmail.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg border">
            {loadingBody && !cachedBody ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Inhalt wird geladen…
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(cachedBody?.body_html || cachedBody?.body_text || '') }} className="prose prose-sm max-w-none" />
            )}
          </div>
          {resendId && (
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Resend-ID: {resendId}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Unique types found in data for the filter dropdown
  const availableTypes = [...new Set(emails.map(e => e.email_type))].sort();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              System-E-Mails
            </CardTitle>
            <CardDescription>
              Automatisch versendete E-Mails (Willkommen, Erinnerungen, Benachrichtigungen)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9 w-[200px]"
              />
            </div>
            <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Alle Typen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                {availableTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {SYSTEM_TYPE_LABELS[type] || type} ({typeCounts[type] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchSystemEmails}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary badges */}
        {Object.keys(typeCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
            <Badge variant="secondary" className="gap-1">
              <Bot className="w-3 h-3" /> Gesamt: {emails.length}
            </Badge>
            {Object.entries(typeCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <Badge
                  key={type}
                  variant="outline"
                  className={`gap-1 cursor-pointer hover:bg-muted/50 ${filter === type ? 'bg-primary/10 ring-1 ring-primary' : ''} ${SYSTEM_TYPE_COLORS[type] || ''}`}
                  onClick={() => { setFilter(filter === type ? 'all' : type); setPage(1); }}
                >
                  {SYSTEM_TYPE_LABELS[type] || type}: {count}
                </Badge>
              ))
            }
          </div>
        )}

        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : paginatedEmails.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              {filter !== 'all' ? 'Keine System-E-Mails für diesen Typ' : 'Noch keine System-E-Mails versendet'}
            </p>
          </div>
        ) : (
          <>
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
                {paginatedEmails.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEmail(e)}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{e.recipient_name || e.recipient_email}</p>
                        {e.recipient_name && <p className="text-xs text-muted-foreground">{e.recipient_email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="truncate text-sm">{e.subject}</p>
                    </TableCell>
                    <TableCell>{getSystemTypeBadge(e.email_type)}</TableCell>
                    <TableCell>{getStatusBadge(e.status)}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(e.created_at), "dd.MM.yy HH:mm", { locale: de })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); setSelectedEmail(e); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Seite {page} von {totalPages} ({filteredEmails.length} System-E-Mails)
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <Button key={pageNum} variant={page === pageNum ? "default" : "outline"} size="sm" onClick={() => setPage(pageNum)} className="w-8 h-8 p-0">
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 8: Einstellungen ──────────────────────────────────────────────────

function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Lead-Weiterleitung
  const [leadForwardEmail, setLeadForwardEmail] = useState("");

  // Benachrichtigungen
  const [notifyNewAuction, setNotifyNewAuction] = useState(true);
  const [notifyNewBid, setNotifyNewBid] = useState(true);
  const [notifyNewRegistration, setNotifyNewRegistration] = useState(true);

  // E-Mail-Absender
  const [fromEmail, setFromEmail] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("id, lead_forward_email, notify_new_auction, notify_new_bid, notify_new_registration, from_email, contact_email")
        .limit(1)
        .single();

      if (error) throw error;
      if (data) {
        setSettingsId(data.id);
        setLeadForwardEmail(data.lead_forward_email || "");
        setNotifyNewAuction(data.notify_new_auction ?? true);
        setNotifyNewBid(data.notify_new_bid ?? true);
        setNotifyNewRegistration(data.notify_new_registration ?? true);
        setFromEmail(data.from_email || "");
        setContactEmail(data.contact_email || "");
      }
    } catch (err) {
      console.error("Fehler beim Laden der Einstellungen:", err);
      toast.error("Einstellungen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settingsId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({
          lead_forward_email: leadForwardEmail.trim() || null,
          notify_new_auction: notifyNewAuction,
          notify_new_bid: notifyNewBid,
          notify_new_registration: notifyNewRegistration,
          from_email: fromEmail.trim(),
          contact_email: contactEmail.trim(),
        })
        .eq("id", settingsId);

      if (error) throw error;
      toast.success("Einstellungen erfolgreich gespeichert");
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      toast.error("Einstellungen konnten nicht gespeichert werden");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Einstellungen werden geladen...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lead-Weiterleitung */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="w-5 h-5 text-primary" />
            Lead-Weiterleitung
          </CardTitle>
          <CardDescription>
            Fahrzeuganfragen, Wizard-Bewertungen und Wertrechner-Anfragen werden an diese E-Mail-Adresse weitergeleitet, anstatt im Posteingang angezeigt zu werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-forward-email">Weiterleitungs-E-Mail</Label>
            <Input
              id="lead-forward-email"
              type="email"
              placeholder="z.B. r.daban@icloud.com"
              value={leadForwardEmail}
              onChange={(e) => setLeadForwardEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Alle Lead-Benachrichtigungen werden an diese Adresse gesendet. Leer lassen, um die Standard-Admin-E-Mail zu verwenden.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Admin-Benachrichtigungen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Admin-Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Steuern Sie, bei welchen Ereignissen der Admin per E-Mail benachrichtigt wird.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">Neue Auktion erstellt</p>
              <p className="text-sm text-muted-foreground">Benachrichtigung, wenn ein Verkäufer eine neue Auktion erstellt</p>
            </div>
            <Switch
              checked={notifyNewAuction}
              onCheckedChange={setNotifyNewAuction}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">Neues Gebot abgegeben</p>
              <p className="text-sm text-muted-foreground">Benachrichtigung bei jedem neuen Gebot auf eine Auktion</p>
            </div>
            <Switch
              checked={notifyNewBid}
              onCheckedChange={setNotifyNewBid}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">Neue Registrierung</p>
              <p className="text-sm text-muted-foreground">Benachrichtigung, wenn sich ein neuer Nutzer registriert</p>
            </div>
            <Switch
              checked={notifyNewRegistration}
              onCheckedChange={setNotifyNewRegistration}
            />
          </div>
        </CardContent>
      </Card>

      {/* E-Mail-Konfiguration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            E-Mail-Konfiguration
          </CardTitle>
          <CardDescription>
            Absender- und Kontakt-E-Mail-Adressen für das System.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from-email">Absender-E-Mail (From)</Label>
            <Input
              id="from-email"
              type="email"
              placeholder="noreply@caravanwert.de"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Diese Adresse wird als Absender für alle System-E-Mails verwendet.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Kontakt-E-Mail</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="info@caravanwert.de"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Öffentliche Kontakt-E-Mail-Adresse, die auf der Website angezeigt wird.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Speichern-Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Einstellungen speichern
        </Button>
      </div>
    </div>
  );
}
