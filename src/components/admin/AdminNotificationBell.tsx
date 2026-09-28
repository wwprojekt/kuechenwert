import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { Link } from "react-router-dom";
import { Bell, UserPlus, Mail, MessageCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

interface NotificationItem {
  label: string;
  count: number;
  path: string;
  icon: React.ElementType;
  color: string;
}

export interface AdminNotificationCounts {
  leads: number;
  support: number;
  contacts: number;
  dealers: number;
  unreadEmails: number;
}

/** Zentrale Zähler-Abfrage – wird von Sidebar und Header geteilt */
export function useAdminNotificationCounts() {
  return useQuery({
    queryKey: ["adminNotificationCounts"],
    queryFn: async (): Promise<AdminNotificationCounts | null> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [leadsRes, supportRes, contactRes, dealerRes, unreadEmailsRes] = await Promise.all([
        // leads hat keine is_viewed-Spalte – gezählt werden die neuen Leads aller Funnel der letzten 24 h.
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", twentyFourHoursAgo),
        supabase.from("support_messages").select("id", { count: "exact", head: true }).or("status.eq.open,status.is.null"),
        supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new").is("deleted_at", null),
        supabase.from("dealer_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("admin_emails").select("id", { count: "exact", head: true }).eq("direction", "inbound").eq("status", "unread"),
      ]);

      return {
        leads: leadsRes.count || 0,
        support: supportRes.count || 0,
        contacts: contactRes.count || 0,
        dealers: dealerRes.count || 0,
        unreadEmails: unreadEmailsRes.count || 0,
      };
    },
    // Badge counts are not time-critical; 90 s is plenty. staleTime 60 s prevents
    // refetch-on-window-focus from hammering the DB when an admin alt-tabs.
    refetchInterval: 90000,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

export function AdminNotificationBell() {
  const { data } = useAdminNotificationCounts();
  const [open, setOpen] = useState(false);

  const items: NotificationItem[] = [
    { label: "Neue Leads (24 h)", count: data?.leads || 0, path: "/admin/leads", icon: UserPlus, color: "text-cyan-600" },
    { label: "Ungelesene E-Mails", count: data?.unreadEmails || 0, path: "/admin/email", icon: Mail, color: "text-purple-600" },
    { label: "Kontaktanfragen", count: data?.contacts || 0, path: "/admin/messages?tab=kontakt", icon: MessageCircle, color: "text-pink-600" },
    { label: "Support-Nachrichten", count: data?.support || 0, path: "/admin/messages?tab=support", icon: MessageCircle, color: "text-orange-600" },
    { label: "Studio-Bewerbungen", count: data?.dealers || 0, path: "/admin/dealers", icon: Building2, color: "text-amber-600" },
  ];

  const activeItems = items.filter((i) => i.count > 0);
  const totalCount = activeItems.reduce((sum, i) => sum + i.count, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            totalCount > 0
              ? `Benachrichtigungen öffnen (${totalCount} offen)`
              : "Benachrichtigungen öffnen"
          }
          className="relative h-10 w-10 sm:h-9 sm:w-9 flex-shrink-0"
        >
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-0" align="end" sideOffset={8}>
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">Benachrichtigungen</h4>
          {totalCount > 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">{totalCount} offene Aufgaben</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Alles erledigt ✓</p>
          )}
        </div>
        <ScrollArea className="max-h-[320px]">
          {activeItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Keine offenen Aufgaben 🎉
            </div>
          ) : (
            <div className="p-1">
              {activeItems.map((item) => (
                <Link
                  key={`${item.path}-${item.label}`}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted transition-colors"
                >
                  <item.icon className={`h-4 w-4 flex-shrink-0 ${item.color}`} />
                  <span className="flex-1 text-sm">{item.label}</span>
                  <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {item.count}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
