import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { Link } from "react-router-dom";
import { Bell, UserPlus, Mail, MessageCircle, Building2, FileWarning, Star, Calendar, AlertTriangle } from "lucide-react";
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
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      const [
        wizardRes, valuationRes, supportRes, contactRes,
        dealerRes, questionsRes, unreadEmailsRes, reviewsRes,
        claimsRes, appointmentsRes, offersRes, festpreisNoPriceRes,
        wertrechnerReviewsRes,
      ] = await Promise.all([
        supabase.from("wizard_sessions").select("*", { count: "exact", head: true }).is("disposition", null).or("is_viewed.is.null,is_viewed.eq.false"),
        supabase.from("value_assessment_leads").select("*", { count: "exact", head: true }).is("disposition", null).or("is_viewed.is.null,is_viewed.eq.false"),
        supabase.from("support_messages").select("*", { count: "exact", head: true }).is("admin_response", null),
        supabase.from("contact_messages").select("*", { count: "exact", head: true }).or("status.eq.new,status.is.null"),
        supabase.from("dealer_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("vehicle_questions").select("*", { count: "exact", head: true }).is("answer", null),
        supabase.from("admin_emails").select("*", { count: "exact", head: true }).eq("direction", "inbound").eq("status", "unread"),
        supabase.from("dealer_reviews").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("claims").select("*", { count: "exact", head: true }).or("status.eq.submitted,status.eq.in_review"),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "scheduled").gte("appointment_date", new Date().toISOString().split("T")[0]),
        supabase.from("post_auction_offers").select("*", { count: "exact", head: true }).in("status", ["pending", "countered"]),
        // Bug-fix #4: surface festpreis listings that are missing a price.
        // The DB CHECK constraint (motorhomes_instant_price_positive, NOT VALID)
        // blocks new violators, but legacy rows + the cron auto-extend window
        // mean admins still need a one-click view. This count powers both the
        // bell badge and the /admin/motorhomes?filter=festpreis_no_price view.
        supabase
          .from("motorhomes")
          .select("*", { count: "exact", head: true })
          .eq("sale_channel", "instant_price")
          .eq("status", "available")
          .or("instant_price.is.null,instant_price.eq.0"),
        supabase.from("wertrechner_reviews").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      return {
        leads: (wizardRes.count || 0) + (valuationRes.count || 0),
        support: supportRes.count || 0,
        contacts: contactRes.count || 0,
        dealers: dealerRes.count || 0,
        questions: questionsRes.count || 0,
        unreadEmails: unreadEmailsRes.count || 0,
        reviews: reviewsRes.count || 0,
        claims: claimsRes.count || 0,
        appointments: appointmentsRes.count || 0,
        offers: offersRes.count || 0,
        festpreisNoPrice: festpreisNoPriceRes.count || 0,
        wertrechnerReviews: wertrechnerReviewsRes.count || 0,
      };
    },
    // Badge counts are not time-critical; 90 s is plenty and cuts the total
    // count-query load in the admin layout by ~66 %. staleTime 60 s prevents
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
    { label: "Neue Leads", count: data?.leads || 0, path: "/admin/leads", icon: UserPlus, color: "text-cyan-600" },
    { label: "Ungelesene E-Mails", count: data?.unreadEmails || 0, path: "/admin/email", icon: Mail, color: "text-purple-600" },
    { label: "Support-Nachrichten", count: data?.support || 0, path: "/admin/messages", icon: MessageCircle, color: "text-orange-600" },
    { label: "Kontakt-Anfragen", count: data?.contacts || 0, path: "/admin/messages", icon: MessageCircle, color: "text-pink-600" },
    { label: "Offene Fragen", count: data?.questions || 0, path: "/admin/questions", icon: MessageCircle, color: "text-indigo-600" },
    { label: "Händler-Bewerbungen", count: data?.dealers || 0, path: "/admin/dealers", icon: Building2, color: "text-amber-600" },
    { label: "Neue Händler-Bewertungen", count: data?.reviews || 0, path: "/admin/reviews", icon: Star, color: "text-yellow-600" },
    { label: "Neue Wertrechner-Bewertungen", count: data?.wertrechnerReviews || 0, path: "/admin/wertrechner-reviews", icon: Star, color: "text-amber-600" },
    { label: "Offene Reklamationen", count: data?.claims || 0, path: "/admin/claims", icon: FileWarning, color: "text-red-600" },
    { label: "Anstehende Termine", count: data?.appointments || 0, path: "/admin/appointments", icon: Calendar, color: "text-teal-600" },
    { label: "Offene Angebote", count: data?.offers || 0, path: "/admin/offers", icon: Building2, color: "text-green-600" },
    {
      label: "Festpreis ohne Preis",
      count: data?.festpreisNoPrice || 0,
      path: "/admin/motorhomes?filter=festpreis_no_price",
      icon: AlertTriangle,
      color: "text-rose-600",
    },
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
