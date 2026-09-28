import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Building2, Mail, Settings,
  TrendingUp, FileText, Shield, Search, MessageCircle,
  AlertTriangle, CreditCard, Scale, UserPlus, Receipt, TimerReset, Sparkles,
} from "lucide-react";

const ADMIN_PAGES = [
  { title: "Übersicht", path: "/admin", icon: LayoutDashboard, keywords: "dashboard startseite home" },
  { title: "Leads & Anfragen", path: "/admin/leads", icon: UserPlus, keywords: "leads anfragen funnel ausschreibung projekte" },
  { title: "Traumküchen-KI (Funnel C)", path: "/admin/planner-sessions", icon: Sparkles, keywords: "ai ki fal flux openai planner renders visualisierung funnel c traumkueche" },
  { title: "E-Mail-Center", path: "/admin/email", icon: Mail, keywords: "nachrichten posteingang" },
  { title: "Nachrichten", path: "/admin/messages", icon: MessageCircle, keywords: "support kontakt kontaktformular hilfe" },
  { title: "Benutzer", path: "/admin/users", icon: Users, keywords: "nutzer accounts konten kunden" },
  { title: "Küchenstudios", path: "/admin/dealers", icon: Building2, keywords: "studios händler dealer bewerbungen" },
  { title: "Finanzen", path: "/admin/financials", icon: CreditCard, keywords: "rechnungen umsatz zahlung" },
  { title: "Analytics", path: "/admin/analytics", icon: TrendingUp, keywords: "statistik besucher" },
  { title: "Blog", path: "/admin/blog", icon: FileText, keywords: "artikel beitrag" },
  { title: "Rechtliches", path: "/admin/legal", icon: Scale, keywords: "impressum datenschutz agb" },
  { title: "Fehlerprotokoll", path: "/admin/error-logs", icon: AlertTriangle, keywords: "fehler bugs errors" },
  { title: "Cron-Health", path: "/admin/cron-health", icon: TimerReset, keywords: "cron jobs scheduler pg_cron pg_net edge functions" },
  { title: "Audit-Log", path: "/admin/audit-log", icon: Shield, keywords: "protokoll änderungen" },
  { title: "Einstellungen", path: "/admin/settings", icon: Settings, keywords: "konfiguration branding" },
];

const EMPTY_RESULTS = { profiles: [], leads: [], invoices: [] };

// Kommas und Klammern würden den PostgREST-`or`-Filter aufbrechen.
function toSearchPattern(query: string): string {
  return `%${query.replace(/[,()%*\\]/g, " ").trim()}%`;
}

function useQuickSearchData(query: string) {
  return useQuery({
    queryKey: ["adminQuickSearch", query],
    queryFn: async () => {
      if (!query || query.length < 2) return EMPTY_RESULTS;
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return EMPTY_RESULTS;

      const q = toSearchPattern(query);
      const [profileRes, leadRes, invoiceRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email, company_name")
          .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`)
          .limit(5),
        supabase
          .from("leads")
          .select("id, first_name, last_name, email, postal_code, created_at")
          .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},postal_code.ilike.${q}`)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("invoices")
          .select("id, invoice_number, gross_amount, payment_status")
          .ilike("invoice_number", q)
          .limit(5),
      ]);

      return {
        profiles: profileRes.data || [],
        leads: leadRes.data || [],
        invoices: invoiceRes.data || [],
      };
    },
    enabled: query.length >= 2,
    staleTime: 5000,
  });
}

export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { data: searchData } = useQuickSearchData(query);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const go = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
      setQuery("");
    },
    [navigate]
  );

  const hasDataResults =
    (searchData?.profiles.length || 0) > 0 ||
    (searchData?.leads.length || 0) > 0 ||
    (searchData?.invoices.length || 0) > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Globale Suche öffnen (Strg+K)"
        title="Globale Suche (Strg+K)"
        className="flex items-center justify-center sm:justify-start gap-2 h-10 w-10 sm:h-9 sm:w-48 lg:w-64 rounded-lg border border-input bg-muted/50 sm:px-3 text-sm text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left truncate hidden sm:inline">Suchen…</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Seite, Benutzer, Studio, Lead oder Rechnung suchen…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>

          {searchData && searchData.profiles.length > 0 && (
            <CommandGroup heading="Benutzer & Studios">
              {searchData.profiles.map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/admin/users/${p.id}`)}>
                  <Users className="mr-2 h-4 w-4 text-blue-600" />
                  <span>
                    {p.company_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchData && searchData.leads.length > 0 && (
            <CommandGroup heading="Leads">
              {searchData.leads.map((l) => (
                <CommandItem key={l.id} onSelect={() => go("/admin/leads")}>
                  <UserPlus className="mr-2 h-4 w-4 text-cyan-600" />
                  <span>{`${l.first_name || ""} ${l.last_name || ""}`.trim() || l.email || "Ohne Namen"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">PLZ {l.postal_code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchData && searchData.invoices.length > 0 && (
            <CommandGroup heading="Rechnungen">
              {searchData.invoices.map((inv) => (
                <CommandItem key={inv.id} onSelect={() => go("/admin/financials")}>
                  <Receipt className="mr-2 h-4 w-4 text-amber-600" />
                  <span>{inv.invoice_number}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {inv.payment_status ?? "—"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {hasDataResults ? <CommandSeparator /> : null}

          <CommandGroup heading="Seiten">
            {ADMIN_PAGES.map((page) => (
              <CommandItem key={page.path} onSelect={() => go(page.path)} keywords={[page.keywords]}>
                <page.icon className="mr-2 h-4 w-4" />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
