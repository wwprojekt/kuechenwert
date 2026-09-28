import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Building2, FileText, Mail, MessageSquare, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { formLabel, styleLabel } from "@/features/funnel-a/catalog";

export interface ActionItem {
  id: string;
  type: "wizard" | "lead" | "message" | "dealer";
  title: string;
  subtitle: string;
  time: string;
  link: string;
  priority: "high" | "medium" | "low";
  icon: ElementType;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
}

export interface TimelineItem {
  id: string;
  type: "lead" | "wizard" | "email" | "dealer";
  title: string;
  subtitle: string;
  time: string;
}

export const LEAD_TYPE_LABELS: Record<string, string> = {
  a: "Angebote einholen",
  b: "Unterbieten",
  traumkueche: "Traumküchen-KI",
};

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  approved: "angenommen",
  rejected: "abgelehnt",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: de });
  } catch {
    return "";
  }
}

function wizardSummary(kitchenSummary: string | null, formData: unknown): string {
  const fd = formData && typeof formData === "object" ? (formData as Record<string, unknown>) : null;
  const fromForm = fd ? `${fd.kitchen_style || ""} ${fd.kitchen_form || ""}`.trim() : "";
  return kitchenSummary || fromForm || "Küche (ohne Details)";
}

export function leadSummary(lead: {
  kitchen_style: string | null;
  kitchen_form: string | null;
  budget_midpoint: number | null;
}): string {
  const parts = [
    styleLabel(lead.kitchen_style) ?? lead.kitchen_style,
    formLabel(lead.kitchen_form) ?? lead.kitchen_form,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  if (lead.budget_midpoint) return `Budget ${lead.budget_midpoint.toLocaleString("de-DE")} €`;
  return "ohne Details";
}

function personLabel(first: string | null, last: string | null, fallback: string): string {
  return [first, last].filter(Boolean).join(" ") || fallback;
}

const POLL_OPTIONS = {
  refetchInterval: 90000,
  staleTime: 60000,
  refetchOnWindowFocus: false,
} as const;

// ============================================================================
// Zähler für Kacheln und Schnellzugriff
// ============================================================================

export function useDashboardCounts() {
  return useQuery({
    queryKey: ["adminDashboardCounts"],
    queryFn: async () => {
      const empty = {
        openSupport: 0, newContacts: 0, newWizards: 0, recentLeads: 0,
        pendingDealers: 0, totalUsers: 0, totalLeads: 0, totalMessages: 0, totalAnfragen: 0,
      };
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return empty;

      const [supportRes, contactRes, wizardRes, recentLeadsRes, dealerRes, usersRes, totalLeadsRes] = await Promise.all([
        supabase.from("support_messages").select("id", { count: "exact", head: true }).or("status.eq.open,status.is.null"),
        supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new").is("deleted_at", null),
        supabase.from("wizard_sessions").select("id", { count: "exact", head: true }).eq("status", "completed").or("is_viewed.is.null,is_viewed.eq.false").is("disposition", null),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", isoDaysAgo(1)),
        supabase.from("dealer_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
      ]);

      const failed = [supportRes, contactRes, wizardRes, recentLeadsRes, dealerRes, usersRes, totalLeadsRes].filter((r) => r.error);
      if (failed.length > 0) {
        console.error("Dashboard-Zähler fehlgeschlagen:", failed.map((r) => r.error));
      }

      const openSupport = supportRes.count || 0;
      const newContacts = contactRes.count || 0;
      const newWizards = wizardRes.count || 0;
      const recentLeads = recentLeadsRes.count || 0;
      return {
        openSupport,
        newContacts,
        newWizards,
        recentLeads,
        pendingDealers: dealerRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalLeads: totalLeadsRes.count || 0,
        totalMessages: openSupport + newContacts,
        totalAnfragen: newWizards + recentLeads,
      };
    },
    ...POLL_OPTIONS,
  });
}

// ============================================================================
// Offene Aufgaben
// ============================================================================

export function useActionItems() {
  return useQuery({
    queryKey: ["adminActionItems"],
    queryFn: async (): Promise<ActionItem[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const [wizardRes, leadsRes, supportRes, contactRes, dealerRes] = await Promise.all([
        supabase
          .from("wizard_sessions")
          .select("id, customer_name, customer_email, kitchen_summary, completed_at, form_data")
          .eq("status", "completed")
          .or("is_viewed.is.null,is_viewed.eq.false")
          .is("disposition", null)
          .order("completed_at", { ascending: false })
          .limit(10),
        // leads hat keine is_viewed/disposition-Spalte, daher die Einträge der letzten 24 h.
        supabase
          .from("leads")
          .select("id, funnel_type, first_name, last_name, email, postal_code, kitchen_style, kitchen_form, budget_midpoint, created_at")
          .gte("created_at", isoDaysAgo(1))
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("support_messages")
          .select("id, subject, message, created_at")
          .or("status.eq.open,status.is.null")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("contact_messages")
          .select("id, name, email, subject, created_at")
          .eq("status", "new")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("dealer_applications")
          .select("id, company_name, contact_person_name, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const items: ActionItem[] = [];

      for (const w of wizardRes.data || []) {
        items.push({
          id: `wizard-${w.id}`,
          type: "wizard",
          title: `Neue Funnel-A-Anfrage: ${wizardSummary(w.kitchen_summary, w.form_data)}`,
          subtitle: w.customer_name || w.customer_email || "Unbekannter Kunde",
          time: w.completed_at || "",
          link: "/admin/leads",
          priority: "high",
          icon: FileText,
          iconColor: "text-blue-600 bg-blue-100",
          badge: "Funnel A",
          badgeColor: "bg-blue-500",
        });
      }

      for (const l of leadsRes.data || []) {
        const typeLabel = LEAD_TYPE_LABELS[l.funnel_type] ?? "Lead";
        items.push({
          id: `lead-${l.id}`,
          type: "lead",
          title: `${typeLabel}: ${leadSummary(l)}`,
          subtitle: personLabel(l.first_name, l.last_name, l.email || (l.postal_code ? `PLZ ${l.postal_code}` : "Unbekannt")),
          time: l.created_at,
          link: "/admin/leads",
          priority: "medium",
          icon: TrendingUp,
          iconColor: "text-emerald-600 bg-emerald-100",
          badge: typeLabel,
          badgeColor: "bg-emerald-500",
        });
      }

      for (const m of supportRes.data || []) {
        const text = m.message || "";
        items.push({
          id: `support-${m.id}`,
          type: "message",
          title: m.subject || "Support-Nachricht",
          subtitle: text.length > 80 ? `${text.substring(0, 80)}...` : text,
          time: m.created_at || "",
          link: "/admin/messages?tab=support",
          priority: "high",
          icon: MessageSquare,
          iconColor: "text-orange-600 bg-orange-100",
          badge: "Support",
          badgeColor: "bg-orange-500",
        });
      }

      for (const c of contactRes.data || []) {
        items.push({
          id: `contact-${c.id}`,
          type: "message",
          title: c.subject || "Kontaktnachricht",
          subtitle: `${c.name} (${c.email})`,
          time: c.created_at || "",
          link: "/admin/messages?tab=kontakt",
          priority: "medium",
          icon: Mail,
          iconColor: "text-purple-600 bg-purple-100",
          badge: "Kontakt",
          badgeColor: "bg-purple-500",
        });
      }

      for (const d of dealerRes.data || []) {
        items.push({
          id: `dealer-${d.id}`,
          type: "dealer",
          title: `Studio-Bewerbung: ${d.company_name}`,
          subtitle: d.contact_person_name || "",
          time: d.created_at || "",
          link: "/admin/dealers",
          priority: "high",
          icon: Building2,
          iconColor: "text-amber-600 bg-amber-100",
          badge: "Studio",
          badgeColor: "bg-amber-500",
        });
      }

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return items.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      });
    },
    ...POLL_OPTIONS,
  });
}

// ============================================================================
// Umsatz / Rechnungen
// ============================================================================

export function useRevenueStats() {
  return useQuery({
    queryKey: ["adminRevenueStats"],
    queryFn: async () => {
      const empty = { weekRevenue: 0, monthRevenue: 0, openInvoices: 0, overdueInvoices: 0, openAmount: 0, overdueAmount: 0 };
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return empty;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString();

      const { data: allInvoices } = await supabase
        .from("invoices")
        .select("id, gross_amount, payment_status, due_date, paid_at")
        .in("status", ["sent", "paid", "overdue", "partial"]);

      if (!allInvoices) return empty;

      const sum = (list: typeof allInvoices) => list.reduce((s, i) => s + Number(i.gross_amount || 0), 0);
      const paidThisMonth = allInvoices.filter((i) => i.paid_at && i.paid_at >= startOfMonth);
      const paidThisWeek = allInvoices.filter((i) => i.paid_at && i.paid_at >= startOfWeek);
      const open = allInvoices.filter((i) => i.payment_status === "pending" || i.payment_status === "partial");
      const overdue = allInvoices.filter(
        (i) => i.payment_status === "overdue" || (i.due_date && new Date(i.due_date) < now && i.payment_status !== "paid"),
      );

      return {
        weekRevenue: sum(paidThisWeek),
        monthRevenue: sum(paidThisMonth),
        openInvoices: open.length,
        overdueInvoices: overdue.length,
        openAmount: sum(open),
        overdueAmount: sum(overdue),
      };
    },
    // Rechnungen ändern sich selten – 5 min reichen.
    refetchInterval: 300000,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
}

// ============================================================================
// Lead-Kennzahlen (30 Tage)
// ============================================================================

export function useLeadMetrics() {
  return useQuery({
    queryKey: ["adminLeadMetrics30d"],
    queryFn: async () => {
      const empty = { total: 0, funnelA: 0, funnelB: 0, funnelC: 0, inTender: 0, won: 0 };
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return empty;

      const since = isoDaysAgo(30);
      const countSince = () => supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since);
      const [totalRes, aRes, bRes, cRes, tenderRes, wonRes] = await Promise.all([
        countSince(),
        countSince().eq("funnel_type", "a"),
        countSince().eq("funnel_type", "b"),
        countSince().eq("funnel_type", "traumkueche"),
        countSince().eq("status", "in_auction"),
        countSince().eq("status", "closed_won"),
      ]);

      return {
        total: totalRes.count || 0,
        funnelA: aRes.count || 0,
        funnelB: bRes.count || 0,
        funnelC: cRes.count || 0,
        inTender: tenderRes.count || 0,
        won: wonRes.count || 0,
      };
    },
    refetchInterval: 300000,
    staleTime: 180000,
    refetchOnWindowFocus: false,
  });
}

// ============================================================================
// Nicht bearbeitete Funnel-A-Anfragen (älteste zuerst)
// ============================================================================

export function useUrgentLeads() {
  return useQuery({
    queryKey: ["adminUrgentLeads"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data } = await supabase
        .from("wizard_sessions")
        .select("id, customer_name, customer_email, kitchen_summary, completed_at, resume_email_sent_at, admin_called_at, form_data")
        .eq("status", "completed")
        .is("disposition", null)
        .order("completed_at", { ascending: true })
        .limit(10);

      return (data || []).map((s) => ({
        id: s.id,
        name: s.customer_name || s.customer_email || "Unbekannt",
        summary: wizardSummary(s.kitchen_summary, s.form_data),
        ageDays: s.completed_at ? differenceInDays(new Date(), new Date(s.completed_at)) : 0,
        contacted: !!(s.resume_email_sent_at || s.admin_called_at),
      }));
    },
    ...POLL_OPTIONS,
  });
}

// ============================================================================
// Aktivitäts-Timeline
// ============================================================================

export function useActivityTimeline() {
  return useQuery({
    queryKey: ["adminActivityTimeline"],
    queryFn: async (): Promise<TimelineItem[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const [leadsRes, wizardRes, emailsRes, dealerRes] = await Promise.all([
        supabase.from("leads").select("id, funnel_type, first_name, last_name, postal_code, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("wizard_sessions").select("id, customer_name, kitchen_summary, created_at, status, form_data").order("created_at", { ascending: false }).limit(5),
        supabase.from("admin_emails").select("id, subject, created_at, sender_email").eq("direction", "inbound").order("created_at", { ascending: false }).limit(5),
        supabase.from("dealer_applications").select("id, company_name, created_at, status").order("created_at", { ascending: false }).limit(3),
      ]);

      const items: TimelineItem[] = [];
      for (const l of leadsRes.data || []) {
        items.push({
          id: `lead-${l.id}`, type: "lead",
          title: `Neuer Lead · ${LEAD_TYPE_LABELS[l.funnel_type] ?? l.funnel_type}`,
          subtitle: personLabel(l.first_name, l.last_name, `PLZ ${l.postal_code}`),
          time: l.created_at,
        });
      }
      for (const w of wizardRes.data || []) {
        items.push({
          id: `wizard-${w.id}`, type: "wizard",
          title: w.status === "completed" ? "Anfrage abgeschlossen" : "Neue Anfrage",
          subtitle: `${w.customer_name || "Unbekannt"} – ${wizardSummary(w.kitchen_summary, w.form_data)}`,
          time: w.created_at || "",
        });
      }
      for (const e of emailsRes.data || []) {
        items.push({
          id: `email-${e.id}`, type: "email",
          title: "E-Mail eingegangen",
          subtitle: `${e.sender_email || "Unbekannt"}: ${e.subject || "Kein Betreff"}`,
          time: e.created_at || "",
        });
      }
      for (const d of dealerRes.data || []) {
        items.push({
          id: `dealer-${d.id}`, type: "dealer",
          title: d.status === "pending" ? "Neue Studio-Bewerbung" : `Studio-Bewerbung ${APPLICATION_STATUS_LABELS[d.status] ?? d.status}`,
          subtitle: d.company_name || "Unbekannt",
          time: d.created_at || "",
        });
      }

      return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12);
    },
    ...POLL_OPTIONS,
  });
}
