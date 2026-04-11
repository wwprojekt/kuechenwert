import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Gavel, Car, Users, TrendingUp, Clock, UserPlus, Mail,
  Phone, AlertCircle, MessageSquare, Building2, FileText,
  CheckCircle2, Eye, ArrowRight, Bell, Inbox, CalendarClock,
  RefreshCw, ChevronRight, ExternalLink, Timer, PhoneOff,
  AlertTriangle, Star, FileWarning, Flame, Euro, Activity, BarChart3, Banknote, Receipt, PhoneCall,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow, differenceInHours, differenceInMinutes, differenceInDays, isPast } from "date-fns";
import { de } from "date-fns/locale";

// ============================================================================
// Types
// ============================================================================

interface ActionItem {
  id: string;
  type: "wizard" | "lead" | "message" | "dealer" | "question" | "motorhome";
  title: string;
  subtitle: string;
  time: string;
  link: string;
  priority: "high" | "medium" | "low";
  icon: React.ElementType;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
}

// ============================================================================
// Dashboard Stats Hook
// ============================================================================

function useDashboardStats() {
  return useQuery({
    queryKey: ["adminDashboardStats"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return { totalMotorhomes: 0, activeAuctions: 0, totalAuctions: 0, totalUsers: 0, totalLeads: 0, completedWizards: 0, totalValuations: 0 };

      const [
        motorhomesRes,
        auctionsRes,
        usersRes,
        leadsRes,
        wizardRes,
        valuationRes,
      ] = await Promise.all([
        supabase.from("motorhomes").select("*", { count: "exact", head: true }),
        supabase.from("auctions").select("status"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("quick_leads").select("*", { count: "exact", head: true }),
        supabase.from("wizard_sessions").select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("value_assessment_leads").select("*", { count: "exact", head: true }),
      ]);

      const activeAuctions = auctionsRes.data?.filter(a => a.status === "active").length || 0;

      return {
        totalMotorhomes: motorhomesRes.count || 0,
        activeAuctions,
        totalAuctions: auctionsRes.data?.length || 0,
        totalUsers: usersRes.count || 0,
        totalLeads: leadsRes.count || 0,
        completedWizards: wizardRes.count || 0,
        totalValuations: valuationRes.count || 0,
      };
    },
    refetchInterval: 30000,
  });
}

// ============================================================================
// Action Items Hook - Sammelt alle offenen Aufgaben
// ============================================================================

function useActionItems() {
  return useQuery({
    queryKey: ["adminActionItems"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const items: ActionItem[] = [];

      // 1. Neue Wizard-Anfragen (abgeschlossen, noch nicht angesehen, ohne Disposition)
      const { data: newWizards } = await supabase
        .from("wizard_sessions")
        .select("id, customer_name, customer_email, vehicle_summary, completed_at, is_viewed, status, form_data")
        .eq("status", "completed")
        .or("is_viewed.is.null,is_viewed.eq.false")
        .is("disposition", null)
        .order("completed_at", { ascending: false })
        .limit(10);

      if (newWizards) {
        for (const w of newWizards) {
          const fd = w.form_data as Record<string, unknown> | null;
          const vehicle = w.vehicle_summary
            || (fd ? `${fd.manufacturer || ""} ${fd.model || ""}`.trim() : "")
            || "Unbekanntes Fahrzeug";
          items.push({
            id: `wizard-${w.id}`,
            type: "wizard",
            title: `Neue Wizard-Anfrage: ${vehicle}`,
            subtitle: w.customer_name || w.customer_email || "Unbekannter Kunde",
            time: w.completed_at || "",
            link: "/admin/leads",
            priority: "high",
            icon: FileText,
            iconColor: "text-blue-600 bg-blue-100",
            badge: "Neu",
            badgeColor: "bg-blue-500",
          });
        }
      }

      // 2. Neue Quick Leads (nicht angesehen, ohne Disposition)
      const { data: newLeads } = await supabase
        .from("quick_leads")
        .select("id, name, email, phone, manufacturer, model, created_at, is_viewed")
        .or("is_viewed.is.null,is_viewed.eq.false")
        .is("disposition", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (newLeads) {
        for (const l of newLeads) {
          const vehicle = `${l.manufacturer || ""} ${l.model || ""}`.trim() || "Kein Fahrzeug";
          items.push({
            id: `lead-${l.id}`,
            type: "lead",
            title: `Neuer Lead: ${vehicle}`,
            subtitle: l.name || l.email || l.phone || "Unbekannt",
            time: l.created_at || "",
            link: "/admin/leads",
            priority: "medium",
            icon: UserPlus,
            iconColor: "text-cyan-600 bg-cyan-100",
            badge: "Lead",
            badgeColor: "bg-cyan-500",
          });
        }
      }

      // 3. Neue Bewertungsanfragen (nicht angesehen, ohne Disposition)
      const { data: newValuations } = await supabase
        .from("value_assessment_leads")
        .select("id, name, email, manufacturer, model, year, created_at, is_viewed")
        .or("is_viewed.is.null,is_viewed.eq.false")
        .is("disposition", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (newValuations) {
        for (const v of newValuations) {
          const vehicle = `${v.manufacturer || ""} ${v.model || ""} ${v.year || ""}`.trim() || "Kein Fahrzeug";
          items.push({
            id: `valuation-${v.id}`,
            type: "lead",
            title: `Bewertungsanfrage: ${vehicle}`,
            subtitle: v.name || v.email || "Unbekannt",
            time: v.created_at || "",
            link: "/admin/leads",
            priority: "medium",
            icon: TrendingUp,
            iconColor: "text-emerald-600 bg-emerald-100",
            badge: "Bewertung",
            badgeColor: "bg-emerald-500",
          });
        }
      }

      // 4. Offene Support-Nachrichten
      const { data: openMessages } = await supabase
        .from("support_messages")
        .select("id, subject, message, created_at, status")
        .or("status.eq.open,status.is.null")
        .order("created_at", { ascending: false })
        .limit(5);

      if (openMessages) {
        for (const m of openMessages) {
          items.push({
            id: `support-${m.id}`,
            type: "message",
            title: m.subject || "Support-Nachricht",
            subtitle: m.message?.substring(0, 80) + (m.message && m.message.length > 80 ? "..." : "") || "",
            time: m.created_at || "",
            link: "/admin/messages",
            priority: "high",
            icon: MessageSquare,
            iconColor: "text-orange-600 bg-orange-100",
            badge: "Support",
            badgeColor: "bg-orange-500",
          });
        }
      }

      // 5. Neue Kontaktnachrichten
      const { data: newContacts } = await supabase
        .from("contact_messages")
        .select("id, name, email, subject, created_at, status")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(5);

      if (newContacts) {
        for (const c of newContacts) {
          items.push({
            id: `contact-${c.id}`,
            type: "message",
            title: c.subject || "Kontaktnachricht",
            subtitle: `${c.name} (${c.email})`,
            time: c.created_at || "",
            link: "/admin/email",
            priority: "medium",
            icon: Mail,
            iconColor: "text-purple-600 bg-purple-100",
            badge: "Kontakt",
            badgeColor: "bg-purple-500",
          });
        }
      }

      // 6. Offene Händler-Bewerbungen
      const { data: pendingDealers } = await supabase
        .from("dealer_applications")
        .select("id, company_name, contact_person_name, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (pendingDealers) {
        for (const d of pendingDealers) {
          items.push({
            id: `dealer-${d.id}`,
            type: "dealer",
            title: `Händler-Bewerbung: ${d.company_name}`,
            subtitle: d.contact_person_name || "",
            time: d.created_at || "",
            link: "/admin/dealers",
            priority: "high",
            icon: Building2,
            iconColor: "text-amber-600 bg-amber-100",
            badge: "Händler",
            badgeColor: "bg-amber-500",
          });
        }
      }

      // 7. Unbeantwortete Fahrzeugfragen
      const { data: openQuestions } = await supabase
        .from("vehicle_questions")
        .select("id, question, questioner_name, questioner_email, created_at, answer")
        .is("answer", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (openQuestions) {
        for (const q of openQuestions) {
          items.push({
            id: `question-${q.id}`,
            type: "question",
            title: q.question?.substring(0, 60) + (q.question && q.question.length > 60 ? "..." : "") || "Fahrzeugfrage",
            subtitle: q.questioner_name || q.questioner_email || "Unbekannt",
            time: q.created_at || "",
            link: "/admin/questions",
            priority: "medium",
            icon: MessageSquare,
            iconColor: "text-indigo-600 bg-indigo-100",
            badge: "Frage",
            badgeColor: "bg-indigo-500",
          });
        }
      }

      // Sortieren: Priorität zuerst, dann nach Zeit
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      items.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      });

      return items;
    },
    refetchInterval: 30000,
  });
}

// ============================================================================
// Revenue / Financial Overview Hook
// ============================================================================

function useRevenueStats() {
  return useQuery({
    queryKey: ["adminRevenueStats"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return { weekRevenue: 0, monthRevenue: 0, openInvoices: 0, overdueInvoices: 0, openAmount: 0, overdueAmount: 0 };

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString();

      const { data: allInvoices } = await supabase
        .from("invoices")
        .select("id, gross_amount, net_amount, tax_amount, payment_status, status, due_date, created_at, paid_at")
        .in("status", ["sent", "paid", "overdue", "partial"]);

      if (!allInvoices) return { weekRevenue: 0, monthRevenue: 0, openInvoices: 0, overdueInvoices: 0, openAmount: 0, overdueAmount: 0 };

      const paidThisMonth = allInvoices.filter(i => i.paid_at && i.paid_at >= startOfMonth);
      const paidThisWeek = allInvoices.filter(i => i.paid_at && i.paid_at >= startOfWeek);
      const open = allInvoices.filter(i => i.payment_status === "pending" || i.payment_status === "partial");
      const overdue = allInvoices.filter(i => i.payment_status === "overdue" || (i.due_date && new Date(i.due_date) < now && i.payment_status !== "paid"));

      return {
        weekRevenue: paidThisWeek.reduce((s, i) => s + Number(i.gross_amount || 0), 0),
        monthRevenue: paidThisMonth.reduce((s, i) => s + Number(i.gross_amount || 0), 0),
        openInvoices: open.length,
        overdueInvoices: overdue.length,
        openAmount: open.reduce((s, i) => s + Number(i.gross_amount || 0), 0),
        overdueAmount: overdue.reduce((s, i) => s + Number(i.gross_amount || 0), 0),
      };
    },
    refetchInterval: 60000,
  });
}

// ============================================================================
// Activity Timeline Hook
// ============================================================================

function useActivityTimeline() {
  return useQuery({
    queryKey: ["adminActivityTimeline"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const [bidsRes, leadsRes, emailsRes, dealerRes] = await Promise.all([
        supabase.from("bids").select("id, amount, created_at, is_autobid, auction:auctions(motorhome:motorhomes(manufacturer, model)), bidder:profiles!bids_bidder_id_fkey(company_name, first_name, last_name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("wizard_sessions").select("id, customer_name, vehicle_summary, created_at, status, form_data").order("created_at", { ascending: false }).limit(5),
        supabase.from("admin_emails").select("id, subject, direction, created_at, from_email").eq("direction", "inbound").order("created_at", { ascending: false }).limit(5),
        supabase.from("dealer_applications").select("id, company_name, created_at, status").order("created_at", { ascending: false }).limit(3),
      ]);

      type TimelineItem = { id: string; type: string; title: string; subtitle: string; time: string; icon: string; color: string };
      const items: TimelineItem[] = [];

      for (const b of bidsRes.data || []) {
        const bidder = (b as any).bidder;
        const vehicle = (b as any).auction?.motorhome;
        items.push({
          id: `bid-${b.id}`, type: "bid",
          title: `Gebot: ${Number(b.amount).toLocaleString("de-DE")} €`,
          subtitle: `${bidder?.company_name || `${bidder?.first_name || ""} ${bidder?.last_name || ""}`.trim()} → ${vehicle?.manufacturer || ""} ${vehicle?.model || ""}`,
          time: b.created_at, icon: "gavel", color: "text-green-600",
        });
      }
      for (const l of leadsRes.data || []) {
        const vehicle = l.vehicle_summary || ((l.form_data as any)?.manufacturer || "Fahrzeug");
        items.push({
          id: `lead-${l.id}`, type: "lead",
          title: l.status === "completed" ? "Lead abgeschlossen" : "Neuer Lead",
          subtitle: `${l.customer_name || "Unbekannt"} – ${vehicle}`,
          time: l.created_at, icon: "user-plus", color: "text-blue-600",
        });
      }
      for (const e of emailsRes.data || []) {
        items.push({
          id: `email-${e.id}`, type: "email",
          title: "E-Mail eingegangen",
          subtitle: `${e.from_email || "Unbekannt"}: ${e.subject || "Kein Betreff"}`,
          time: e.created_at, icon: "mail", color: "text-orange-600",
        });
      }
      for (const d of dealerRes.data || []) {
        items.push({
          id: `dealer-${d.id}`, type: "dealer",
          title: d.status === "pending" ? "Neue Händler-Bewerbung" : `Händler ${d.status}`,
          subtitle: d.company_name || "Unbekannt",
          time: d.created_at, icon: "building", color: "text-amber-600",
        });
      }

      return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12);
    },
    refetchInterval: 15000,
  });
}

// ============================================================================
// Performance-Kennzahlen Hook
// ============================================================================

function usePerformanceMetrics() {
  return useQuery({
    queryKey: ["adminPerformanceMetrics"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return { totalLeads30d: 0, totalAuctions30d: 0, totalSold30d: 0, avgResponseHours: null, conversionRate: 0, avgSalePrice: 0 };

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [wizardRes, auctionRes, soldRes] = await Promise.all([
        supabase.from("wizard_sessions").select("id, created_at, completed_at, admin_called_at, status").gte("created_at", thirtyDaysAgo),
        supabase.from("auctions").select("id, status, created_at, end_time, current_bid").gte("created_at", thirtyDaysAgo),
        supabase.from("auctions").select("id, current_bid").eq("status", "sold").gte("created_at", thirtyDaysAgo),
      ]);

      const wizards = wizardRes.data || [];
      const auctions = auctionRes.data || [];
      const sold = soldRes.data || [];

      const completedWizards = wizards.filter(w => w.status === "completed");
      const calledWizards = completedWizards.filter(w => w.admin_called_at);
      const avgResponseHours = calledWizards.length > 0
        ? calledWizards.reduce((s, w) => {
            const created = new Date(w.completed_at || w.created_at).getTime();
            const called = new Date(w.admin_called_at!).getTime();
            return s + (called - created) / (1000 * 60 * 60);
          }, 0) / calledWizards.length
        : null;

      const conversionRate = completedWizards.length > 0
        ? Math.round((auctions.filter(a => a.status !== "draft").length / completedWizards.length) * 100)
        : 0;

      const avgSalePrice = sold.length > 0
        ? sold.reduce((s, a) => s + Number(a.current_bid || 0), 0) / sold.length
        : 0;

      return {
        totalLeads30d: completedWizards.length,
        totalAuctions30d: auctions.filter(a => a.status !== "draft").length,
        totalSold30d: sold.length,
        avgResponseHours: avgResponseHours !== null ? Math.round(avgResponseHours * 10) / 10 : null,
        conversionRate,
        avgSalePrice,
      };
    },
    refetchInterval: 120000,
  });
}

// ============================================================================
// Laufende Auktionen mit Countdown
// ============================================================================

function useActiveAuctions() {
  return useQuery({
    queryKey: ["adminActiveAuctions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auctions")
        .select(`
          id, end_time, current_bid, starting_bid, status,
          motorhome:motorhomes(id, manufacturer, model, year, motorhome_photos(url, display_order)),
          bids(count)
        `)
        .eq("status", "active")
        .order("end_time", { ascending: true })
        .limit(8);
      return data || [];
    },
    refetchInterval: 15000,
  });
}

// ============================================================================
// Nicht-kontaktierte Leads (dringend)
// ============================================================================

function useUrgentLeads() {
  return useQuery({
    queryKey: ["adminUrgentLeads"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data } = await supabase
        .from("wizard_sessions")
        .select("id, customer_name, customer_email, customer_phone, vehicle_summary, created_at, completed_at, status, is_viewed, resume_email_sent_at, admin_called_at, form_data")
        .eq("status", "completed")
        .is("disposition", null)
        .order("completed_at", { ascending: true })
        .limit(10);
      return (data || []).map(s => ({
        ...s,
        ageDays: s.completed_at ? differenceInDays(new Date(), new Date(s.completed_at)) : 0,
        contacted: !!(s.resume_email_sent_at || s.admin_called_at),
      }));
    },
    refetchInterval: 30000,
  });
}

// ============================================================================
// Letzte Gebote (Live-Feed)
// ============================================================================

function useRecentBids() {
  return useQuery({
    queryKey: ["adminRecentBids"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data } = await supabase
        .from("bids")
        .select(`
          id, amount, created_at, is_autobid,
          auction:auctions(id, motorhome:motorhomes(manufacturer, model)),
          bidder:profiles!bids_bidder_id_fkey(first_name, last_name, company_name)
        `)
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
    refetchInterval: 15000,
  });
}

// ============================================================================
// Recently Changed Motorhomes Hook
// ============================================================================

function useRecentlyChangedMotorhomes() {
  return useQuery({
    queryKey: ["adminRecentMotorhomes"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data } = await supabase
        .from("motorhomes")
        .select(`
          id, manufacturer, model, year, status, updated_at, created_at, seller_id,
          motorhome_photos(url, display_order)
        `)
        .order("updated_at", { ascending: false })
        .limit(8);

      if (!data) return [];

      const sellerIds = [...new Set(data.map(m => m.seller_id).filter(Boolean))];
      let profileMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};

      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", sellerIds);

        if (profiles) {
          for (const p of profiles) {
            profileMap[p.id] = p;
          }
        }
      }

      return data.map(m => ({
        ...m,
        seller: profileMap[m.seller_id] || null,
        isRecentlyUpdated: m.updated_at && m.created_at
          ? new Date(m.updated_at).getTime() - new Date(m.created_at).getTime() > 60000
          : false,
      }));
    },
    refetchInterval: 30000,
  });
}

// ============================================================================
// Counts for badges
// ============================================================================

function useUnreadCounts() {
  return useQuery({
    queryKey: ["adminUnreadCounts"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return { openSupport: 0, newContacts: 0, newWizards: 0, newLeads: 0, newValuations: 0, pendingDealers: 0, openQuestions: 0, totalMessages: 0, totalAnfragen: 0 };

      const [
        supportRes,
        contactRes,
        wizardRes,
        leadsRes,
        valuationRes,
        dealerRes,
        questionsRes,
      ] = await Promise.all([
        supabase.from("support_messages").select("*", { count: "exact", head: true }).or("status.eq.open,status.is.null"),
        supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("wizard_sessions").select("*", { count: "exact", head: true }).eq("status", "completed").or("is_viewed.is.null,is_viewed.eq.false").is("disposition", null),
        supabase.from("quick_leads").select("*", { count: "exact", head: true }).or("is_viewed.is.null,is_viewed.eq.false").is("disposition", null),
        supabase.from("value_assessment_leads").select("*", { count: "exact", head: true }).or("is_viewed.is.null,is_viewed.eq.false").is("disposition", null),
        supabase.from("dealer_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("vehicle_questions").select("*", { count: "exact", head: true }).is("answer", null),
      ]);

      return {
        openSupport: supportRes.count || 0,
        newContacts: contactRes.count || 0,
        newWizards: wizardRes.count || 0,
        newLeads: leadsRes.count || 0,
        newValuations: valuationRes.count || 0,
        pendingDealers: dealerRes.count || 0,
        openQuestions: questionsRes.count || 0,
        totalMessages: (supportRes.count || 0) + (contactRes.count || 0),
        totalAnfragen: (wizardRes.count || 0) + (leadsRes.count || 0) + (valuationRes.count || 0),
      };
    },
    refetchInterval: 30000,
  });
}

// ============================================================================
// Helper: Time ago
// ============================================================================

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: de });
  } catch {
    return "";
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function CountBadge({ count, color = "bg-red-500" }: { count: number; color?: string }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white rounded-full ${color}`}>
      {count}
    </span>
  );
}

function QuickStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  bgColor,
  link,
  badge,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  link: string;
  badge?: number;
}) {
  return (
    <Link to={link}>
      <Card className="relative overflow-hidden hover:shadow-md border-2 hover:border-primary/30 transition-all duration-200 cursor-pointer group">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{title}</p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5">{value}</p>
              {subtitle && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-lg ${bgColor} dark:bg-opacity-20 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
            </div>
          </div>
          {badge !== undefined && badge > 0 && (
            <div className="absolute top-2 right-2">
              <CountBadge count={badge} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ============================================================================
// Grouped Action Items Component
// ============================================================================

function ActionItemsList({ items }: { items: ActionItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 8;

  const grouped = useMemo(() => {
    const groups: Record<string, ActionItem[]> = {};
    for (const item of items) {
      const key = item.badge || item.type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [items]);

  const displayed = showAll ? items : items.slice(0, INITIAL_COUNT);

  return (
    <div className="space-y-1">
      {/* Zusammenfassung */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(grouped).map(([key, groupItems]) => (
          <span key={key} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-muted">
            <span className="font-medium">{groupItems.length}</span>
            <span className="text-muted-foreground">{key}</span>
          </span>
        ))}
      </div>

      {displayed.map((item) => (
        <Link key={item.id} to={item.link} className="block">
          <div className={`flex items-start gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group ${
            item.priority === "high" ? "border-l-4 border-l-red-400" : ""
          }`}>
            <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg ${item.iconColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{item.title}</p>
                {item.badge && (
                  <Badge className={`${item.badgeColor} text-[10px] px-1.5 py-0 h-4 text-white flex-shrink-0`}>
                    {item.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap">
                {timeAgo(item.time)}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
            </div>
          </div>
        </Link>
      ))}
      {items.length > INITIAL_COUNT && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {showAll ? "Weniger anzeigen" : `+ ${items.length - INITIAL_COUNT} weitere anzeigen`}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Countdown Component (Live-Ticker)
// ============================================================================

function AuctionCountdown({ endTime }: { endTime: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const end = new Date(endTime);
  if (isPast(end)) return <span className="text-red-600 font-semibold text-xs">Abgelaufen</span>;

  const hours = differenceInHours(end, now);
  const mins = differenceInMinutes(end, now) % 60;

  if (hours < 1) {
    return (
      <span className="text-red-600 font-bold text-xs animate-pulse">
        {mins}min
      </span>
    );
  }
  if (hours < 24) {
    return (
      <span className={`font-semibold text-xs ${hours < 6 ? "text-orange-600" : "text-amber-600"}`}>
        {hours}h {mins}min
      </span>
    );
  }
  return (
    <span className="text-muted-foreground text-xs">
      {Math.floor(hours / 24)}T {hours % 24}h
    </span>
  );
}

// ============================================================================
// Urgency Badge
// ============================================================================

function UrgencyBadge({ days }: { days: number }) {
  if (days >= 3) return <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">{days} Tage</Badge>;
  if (days >= 1) return <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">{days} Tag{days > 1 ? "e" : ""}</Badge>;
  return <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">Heute</Badge>;
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function AdminDashboard() {
  const { data: stats } = useDashboardStats();
  const { data: actionItems, isLoading: actionsLoading } = useActionItems();
  const { data: recentMotorhomes } = useRecentlyChangedMotorhomes();
  const { data: counts } = useUnreadCounts();
  const { data: activeAuctions } = useActiveAuctions();
  const { data: urgentLeads } = useUrgentLeads();
  const { data: recentBids } = useRecentBids();
  const { data: revenue } = useRevenueStats();
  const { data: timeline } = useActivityTimeline();
  const { data: metrics } = usePerformanceMetrics();
  const queryClient = useQueryClient();

  // Realtime: Sofortige Updates bei neuen Geboten, Leads, Nachrichten
  useEffect(() => {
    const channel = supabase.channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, () => {
        queryClient.invalidateQueries({ queryKey: ["adminRecentBids"] });
        queryClient.invalidateQueries({ queryKey: ["adminActiveAuctions"] });
        queryClient.invalidateQueries({ queryKey: ["adminActivityTimeline"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wizard_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["adminUrgentLeads"] });
        queryClient.invalidateQueries({ queryKey: ["adminActionItems"] });
        queryClient.invalidateQueries({ queryKey: ["adminActivityTimeline"] });
        queryClient.invalidateQueries({ queryKey: ["adminUnreadCounts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wizard_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["adminUrgentLeads"] });
        queryClient.invalidateQueries({ queryKey: ["adminActionItems"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_emails" }, () => {
        queryClient.invalidateQueries({ queryKey: ["adminUnreadCounts"] });
        queryClient.invalidateQueries({ queryKey: ["adminActivityTimeline"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["adminActiveAuctions"] });
        queryClient.invalidateQueries({ queryKey: ["adminDashboardStats"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dealer_applications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["adminUnreadCounts"] });
        queryClient.invalidateQueries({ queryKey: ["adminActivityTimeline"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const totalActionItems = actionItems?.length || 0;
  const highPriorityItems = actionItems?.filter(i => i.priority === "high").length || 0;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Willkommen zurück. Hier ist dein Überblick.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span className="hidden sm:inline">Aktualisiert sich automatisch</span>
          <span className="sm:hidden">Auto-Aktualisierung</span>
        </div>
      </div>

      {/* Alert Banner wenn dringende Aufgaben */}
      {highPriorityItems > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-800 dark:text-red-300">
                {highPriorityItems} dringende {highPriorityItems === 1 ? "Aufgabe" : "Aufgaben"} warten auf dich
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                Neue Anfragen, offene Nachrichten oder Händler-Bewerbungen erfordern deine Aufmerksamkeit.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <QuickStatCard
          title="Neue Anfragen"
          value={counts?.totalAnfragen || 0}
          subtitle="unbearbeitet"
          icon={FileText}
          color="text-blue-600"
          bgColor="bg-blue-100"
          link="/admin/leads"
          badge={counts?.totalAnfragen}
        />
        <QuickStatCard
          title="Nachrichten"
          value={counts?.totalMessages || 0}
          subtitle={counts?.totalMessages ? "offen" : "alles erledigt"}
          icon={Inbox}
          color="text-orange-600"
          bgColor="bg-orange-100"
          link="/admin/email"
          badge={counts?.totalMessages}
        />
        <QuickStatCard
          title="Wohnmobile"
          value={stats?.totalMotorhomes || 0}
          subtitle={`${stats?.activeAuctions || 0} in Auktion`}
          icon={Car}
          color="text-green-600"
          bgColor="bg-green-100"
          link="/admin/motorhomes"
        />
        <QuickStatCard
          title="Laufende Auktionen"
          value={stats?.activeAuctions || 0}
          subtitle={`${stats?.totalAuctions || 0} insgesamt`}
          icon={Gavel}
          color="text-purple-600"
          bgColor="bg-purple-100"
          link="/admin/auctions"
        />
        <QuickStatCard
          title="Händler-Bewerbungen"
          value={counts?.pendingDealers || 0}
          subtitle="ausstehend"
          icon={Building2}
          color="text-amber-600"
          bgColor="bg-amber-100"
          link="/admin/dealers"
          badge={counts?.pendingDealers}
        />
        <QuickStatCard
          title="Benutzer"
          value={stats?.totalUsers || 0}
          subtitle="registriert"
          icon={Users}
          color="text-slate-600"
          bgColor="bg-slate-100"
          link="/admin/users"
        />
      </div>

      {/* Main Content: Action Items + Recent Motorhomes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Left: Action Items (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  Offene Aufgaben
                  {totalActionItems > 0 && (
                    <CountBadge count={totalActionItems} color="bg-primary" />
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {actionsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Lade Aufgaben...
                </div>
              ) : !actionItems || actionItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="font-medium text-green-700 dark:text-green-400">Alles erledigt!</p>
                  <p className="text-sm text-muted-foreground mt-1">Keine offenen Aufgaben vorhanden.</p>
                </div>
              ) : (
                <ActionItemsList items={actionItems} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Recently Changed Motorhomes (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="w-5 h-5 text-green-600" />
                  Letzte Wohnmobil-Aktivität
                </CardTitle>
                <Link to="/admin/motorhomes">
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    Alle <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {!recentMotorhomes || recentMotorhomes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keine Wohnmobile vorhanden.
                </p>
              ) : (
                <div className="space-y-1">
                  {recentMotorhomes.map((m) => {
                    const firstPhoto = [...(m.motorhome_photos || [])]
                      .sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;
                    const sellerName = m.seller
                      ? `${m.seller.first_name || ""} ${m.seller.last_name || ""}`.trim() || m.seller.email
                      : "Unbekannt";

                    return (
                      <Link key={m.id} to={`/admin/motorhomes/${m.id}`} className="block">
                        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group">
                          <div className="w-12 h-9 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {firstPhoto ? (
                              <img
                                src={firstPhoto}
                                alt={`${m.manufacturer} ${m.model}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                <Car className="w-4 h-4 text-primary" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {m.manufacturer} {m.model}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">{sellerName}</span>
                              {m.isRecentlyUpdated && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-300 text-amber-600">
                                  Aktualisiert
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {m.status === "active" ? "Aktiv" : m.status === "draft" ? "Entwurf" : m.status}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {timeAgo(m.updated_at)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schnellzugriff-Karten */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                Bereiche mit Handlungsbedarf
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <Link to="/admin/leads">
                  <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/60 transition-colors cursor-pointer">
                    <UserPlus className="w-4 h-4 text-cyan-500" />
                    <div>
                      <p className="text-xs font-medium">Leads</p>
                      {(counts?.totalAnfragen || 0) > 0 && (
                        <p className="text-[10px] text-cyan-600">{counts?.totalAnfragen} neu</p>
                      )}
                    </div>
                  </div>
                </Link>
                <Link to="/admin/email">
                  <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/60 transition-colors cursor-pointer">
                    <Mail className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-xs font-medium">E-Mails</p>
                      {(counts?.totalMessages || 0) > 0 && (
                        <p className="text-[10px] text-purple-600">{counts?.totalMessages} offen</p>
                      )}
                    </div>
                  </div>
                </Link>
                <Link to="/admin/questions">
                  <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/60 transition-colors cursor-pointer">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="text-xs font-medium">Fragen</p>
                      {(counts?.openQuestions || 0) > 0 && (
                        <p className="text-[10px] text-indigo-600">{counts?.openQuestions} offen</p>
                      )}
                    </div>
                  </div>
                </Link>
                <Link to="/admin/dealers">
                  <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/60 transition-colors cursor-pointer">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium">Händler</p>
                      {(counts?.pendingDealers || 0) > 0 && (
                        <p className="text-[10px] text-amber-600">{counts?.pendingDealers} ausstehend</p>
                      )}
                    </div>
                  </div>
                </Link>
                <Link to="/admin/appointments">
                  <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/60 transition-colors cursor-pointer">
                    <CalendarClock className="w-4 h-4 text-teal-500" />
                    <div>
                      <p className="text-xs font-medium">Termine</p>
                    </div>
                  </div>
                </Link>
                <Link to="/admin/analytics">
                  <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/60 transition-colors cursor-pointer">
                    <TrendingUp className="w-4 h-4 text-rose-500" />
                    <div>
                      <p className="text-xs font-medium">Analytics</p>
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
