import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Bell, UserPlus, Mail, MessageCircle, Building2, FileWarning, Star, Calendar } from "lucide-react";
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

/** Zentrale Zähler-Abfrage – wird von Sidebar und Header geteilt */
export function useAdminNotificationCounts() {
  return useQuery({
    queryKey: ["adminNotificationCounts"],
    queryFn: async () => {
      const [
        wizardRes, leadsRes, valuationRes, supportRes, contactRes,
        dealerRes, questionsRes, unreadEmailsRes, reviewsRes,
        claimsRes, appointmentsRes, offersRes,
      ] = await Promise.all([
        supabase.from("wizard_sessions").select("*", { count: "exact", head: true }).is("disposition", null).or("is_viewed.is.null,is_viewed.eq.false"),
        supabase.from("quick_leads").select("*", { count: "exact", head: true }).is("disposition", null).or("is_viewed.is.null,is_viewed.eq.false"),
        supabase.from("value_assessment_leads").select("*", { count: "exact", head: true }).is("disposition", null).or("is_viewed.is.null,is_viewed.eq.false"),
        supabase.from("support_messages").select("*", { count: "exact", head: true }).is("admin_response", null),
        supabase.from("contact_messages").select("*", { count: "exact", head: true }).or("status.eq.new,status.is.null"),
        supabase.from("dealer_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("vehicle_questions").select("*", { count: "exact", head: true }).is("answer", null),
        supabase.from("admin_emails").select("*", { count: "exact", head: true }).eq("direction", "inbound").eq("status", "unread"),
        supabase.from("dealer_reviews").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("claims").select("*", { count: "exact", head: true }).or("status.eq.submitted,status.eq.in_review"),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "scheduled").gte("appointment_date", new Date().toISOString().split("T")[0]),
        supabase.from("post_auction_offers").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      return {
        leads: (wizardRes.count || 0) + (leadsRes.count || 0) + (valuationRes.count || 0),
        support: supportRes.count || 0,
        contacts: contactRes.count || 0,
        dealers: dealerRes.count || 0,
        questions: questionsRes.count || 0,
        unreadEmails: unreadEmailsRes.count || 0,
        reviews: reviewsRes.count || 0,
        claims: claimsRes.count || 0,
        appointments: appointmentsRes.count || 0,
        offers: offersRes.count || 0,
      };
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function AdminNotificationBell() {
  const { data } = useAdminNotificationCounts();
  const [open, setOpen] = useState(false);

  const items: NotificationItem[] = [
    { label: "Neue Leads", count: data?.leads || 0, path: "/admin/leads", icon: UserPlus, color: "text-cyan-600" },
    { label: "Ungelesene E-Mails", count: data?.unreadEmails || 0, path: "/admin/email", icon: Mail, color: "text-purple-600" },
    { label: "Support-Nachrichten", count: data?.support || 0, path: "/admin/messages", icon: MessageCircle, color: "text-orange-600" },
    { label: "Kontakt-Anfragen", count: data?.contacts || 0, path: "/admin/messages", icon: MessageCircle, color: "text-pink-600" },
    { label: "Offene Fragen", count: data?.questions || 0, path: "/admin/questions", icon: MessageCircle, color: "text-indigo-600" },
    { label: "Händler-Bewerbungen", count: data?.dealers || 0, path: "/admin/dealers", icon: Building2, color: "text-amber-600" },
    { label: "Neue Bewertungen", count: data?.reviews || 0, path: "/admin/reviews", icon: Star, color: "text-yellow-600" },
    { label: "Offene Reklamationen", count: data?.claims || 0, path: "/admin/claims", icon: FileWarning, color: "text-red-600" },
    { label: "Anstehende Termine", count: data?.appointments || 0, path: "/admin/appointments", icon: Calendar, color: "text-teal-600" },
    { label: "Offene Angebote", count: data?.offers || 0, path: "/admin/offers", icon: Building2, color: "text-green-600" },
  ];

  const activeItems = items.filter((i) => i.count > 0);
  const totalCount = activeItems.reduce((sum, i) => sum + i.count, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
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
                  key={item.path}
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
