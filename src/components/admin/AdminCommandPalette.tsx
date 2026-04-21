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
  LayoutDashboard, Car, Gavel, Users, Building2, Mail, Settings,
  TrendingUp, FileText, Calculator, Calendar, Shield, Search,
  MessageCircle, Star, AlertTriangle, CreditCard, FileSignature,
  Scale, UserPlus, Receipt, TimerReset,
} from "lucide-react";

const ADMIN_PAGES = [
  { title: "Übersicht", path: "/admin", icon: LayoutDashboard, keywords: "dashboard startseite home" },
  { title: "Leads & Anfragen", path: "/admin/leads", icon: UserPlus, keywords: "wizard sessions anfragen kontakt" },
  { title: "Wohnmobile", path: "/admin/motorhomes", icon: Car, keywords: "fahrzeuge motorhome" },
  { title: "Auktionen", path: "/admin/auctions", icon: Gavel, keywords: "gebote bieten versteigerung" },
  { title: "Nachauktions-Angebote", path: "/admin/offers", icon: Gavel, keywords: "kaufchance angebote" },
  { title: "E-Mail-Center", path: "/admin/email", icon: Mail, keywords: "nachrichten posteingang" },
  { title: "Support-Nachrichten", path: "/admin/messages", icon: MessageCircle, keywords: "support hilfe" },
  { title: "Fahrzeugfragen", path: "/admin/questions", icon: MessageCircle, keywords: "fragen antworten" },
  { title: "Benutzer", path: "/admin/users", icon: Users, keywords: "nutzer accounts konten" },
  { title: "Händler", path: "/admin/dealers", icon: Building2, keywords: "dealer bewerbungen" },
  { title: "Händler-Statistik", path: "/admin/dealer-stats", icon: TrendingUp, keywords: "statistik level ranking" },
  { title: "Bewertungen", path: "/admin/reviews", icon: Star, keywords: "rezensionen sterne händler dealer" },
  { title: "Wertrechner-Bewertungen", path: "/admin/wertrechner-reviews", icon: Star, keywords: "wertrechner calculator rezensionen sterne moderation" },
  { title: "Google-Review-Outreach", path: "/admin/google-reviews", icon: Mail, keywords: "google bewertung outreach mail kampagne suppression unsubscribe" },
  { title: "Provisionen", path: "/admin/commissions", icon: Calculator, keywords: "provision staffel" },
  { title: "Kaufverträge", path: "/admin/contracts", icon: FileSignature, keywords: "vertrag dokument" },
  { title: "Finanzen", path: "/admin/financials", icon: CreditCard, keywords: "rechnungen umsatz zahlung" },
  { title: "Ankaufstationen", path: "/admin/stations", icon: Building2, keywords: "station standort" },
  { title: "Termine", path: "/admin/appointments", icon: Calendar, keywords: "besichtigung kalender" },
  { title: "Übergabe", path: "/admin/handover", icon: Calendar, keywords: "übergabe pin" },
  { title: "Reklamationen", path: "/admin/claims", icon: AlertTriangle, keywords: "beschwerde reklamation" },
  { title: "Analytics", path: "/admin/analytics", icon: TrendingUp, keywords: "statistik besucher" },
  { title: "Blog", path: "/admin/blog", icon: FileText, keywords: "artikel beitrag" },
  { title: "Rechtliches", path: "/admin/legal", icon: Scale, keywords: "impressum datenschutz agb" },
  { title: "Fehlerprotokoll", path: "/admin/error-logs", icon: AlertTriangle, keywords: "fehler bugs errors" },
  { title: "Cron-Health", path: "/admin/cron-health", icon: TimerReset, keywords: "cron jobs scheduler pg_cron pg_net edge functions" },
  { title: "Audit-Log", path: "/admin/audit-log", icon: Shield, keywords: "protokoll änderungen" },
  { title: "Einstellungen", path: "/admin/settings", icon: Settings, keywords: "konfiguration branding" },
];

function useQuickSearchData(query: string) {
  return useQuery({
    queryKey: ["adminQuickSearch", query],
    queryFn: async () => {
      if (!query || query.length < 2)
        return { motorhomes: [], profiles: [], auctions: [], invoices: [], contracts: [] };
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid)
        return { motorhomes: [], profiles: [], auctions: [], invoices: [], contracts: [] };

      const q = `%${query}%`;
      const [mhRes, profileRes, auctionRes, invoiceRes, contractRes] = await Promise.all([
        supabase
          .from("motorhomes")
          .select("id, manufacturer, model, year, status")
          .or(`manufacturer.ilike.${q},model.ilike.${q}`)
          .limit(5),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email, company_name")
          .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`)
          .limit(5),
        supabase
          .from("auctions")
          .select("id, status, motorhome:motorhomes!inner(manufacturer, model)")
          .or(`manufacturer.ilike.${q},model.ilike.${q}`, { referencedTable: 'motorhomes' })
          .limit(5),
        supabase
          .from("invoices")
          .select("id, invoice_number, gross_amount, payment_status, dealer_id")
          .ilike("invoice_number", q)
          .limit(5),
        supabase
          .from("purchase_contracts")
          .select("id, contract_number, status")
          .ilike("contract_number", q)
          .limit(5),
      ]);

      return {
        motorhomes: mhRes.data || [],
        profiles: profileRes.data || [],
        auctions: auctionRes.data || [],
        invoices: invoiceRes.data || [],
        contracts: contractRes.data || [],
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 sm:w-48 lg:w-64 rounded-lg border border-input bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left truncate hidden sm:inline">Suchen…</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Seite, Kunde, Wohnmobil, Auktion, Rechnung oder Vertrag suchen…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>

          {/* Daten-Ergebnisse */}
          {searchData?.motorhomes && searchData.motorhomes.length > 0 && (
            <CommandGroup heading="Wohnmobile">
              {searchData.motorhomes.map((m: any) => (
                <CommandItem key={m.id} onSelect={() => go(`/admin/motorhomes/${m.id}`)}>
                  <Car className="mr-2 h-4 w-4 text-green-600" />
                  <span>{m.manufacturer} {m.model}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{m.year}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchData?.profiles && searchData.profiles.length > 0 && (
            <CommandGroup heading="Benutzer">
              {searchData.profiles.map((p: any) => (
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

          {searchData?.auctions && searchData.auctions.length > 0 && (
            <CommandGroup heading="Auktionen">
              {searchData.auctions.map((a: any) => (
                <CommandItem key={a.id} onSelect={() => go(`/admin/auctions/${a.id}`)}>
                  <Gavel className="mr-2 h-4 w-4 text-purple-600" />
                  <span>{a.motorhome?.manufacturer} {a.motorhome?.model}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{a.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchData?.invoices && searchData.invoices.length > 0 && (
            <CommandGroup heading="Rechnungen">
              {searchData.invoices.map((inv: any) => (
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

          {searchData?.contracts && searchData.contracts.length > 0 && (
            <CommandGroup heading="Kaufverträge">
              {searchData.contracts.map((c: any) => (
                <CommandItem key={c.id} onSelect={() => go("/admin/contracts")}>
                  <FileText className="mr-2 h-4 w-4 text-slate-600" />
                  <span>{c.contract_number}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(searchData?.motorhomes?.length || 0) > 0 ||
          (searchData?.profiles?.length || 0) > 0 ||
          (searchData?.auctions?.length || 0) > 0 ||
          (searchData?.invoices?.length || 0) > 0 ||
          (searchData?.contracts?.length || 0) > 0 ? (
            <CommandSeparator />
          ) : null}

          {/* Seiten-Navigation */}
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
