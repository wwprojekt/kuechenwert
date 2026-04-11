# CaravanWert – Projekt-Kontext & Aufgaben-Management

## Projektübersicht

**CaravanWert** ist eine deutschsprachige Online-Plattform zum Verkauf und Ankauf von Wohnmobilen und Wohnwagen über ein Auktionssystem.

- **URL:** caravanwert.de
- **Supabase-Projekt:** `zcrwqxsyptjwkuxfacvq` (Region: eu-west-1)
- **Stack:** React 18 + TypeScript + Vite 5 + Tailwind + shadcn/ui + Supabase
- **Architektur-Details:** Siehe `AGENTS.md` im Root

---

## WICHTIG: Aufgaben-Management

### Regeln für den Agent
1. **Vor jeder Aufgabe**: Lies diese TODO-Liste und prüfe ob die Aufgabe bereits erledigt ist
2. **Nach jeder erledigten Aufgabe**: Aktualisiere diese Liste (markiere als erledigt mit `[x]` und Datum)
3. **Bei neuen Aufgaben**: Füge sie unter "Offen" hinzu
4. **NIEMALS** eine bereits erledigte Aufgabe erneut bearbeiten

### Erledigte Aufgaben (nicht erneut bearbeiten!)
- [x] Session-Expired Fix: `ensureValidRLSSession()`, `invokeWithAuth()`, periodic refresh (10.04.2026)
- [x] Live-Gebots-Update: Optimistic Update + Realtime Dedup in AuctionDetail (10.04.2026)
- [x] Bid-Increment-Display: `bids[index + 1]` statt `bids[index]` (10.04.2026)
- [x] Auction-Realtime: Zweiter `.on("postgres_changes")` Handler für `auctions` Tabelle (10.04.2026)
- [x] React Hooks Violation: `useCommissionFromTiers` vor early return verschoben (10.04.2026)
- [x] AuctionDetail Architektur: Commission-Hook in Child-Component verschoben (10.04.2026)
- [x] Email Anti-Spam Phase 1+2: bid_confirmed entfernt, ending_soon Dedup, favorite throttle, wizard_recovery throttle, seller new_bid throttle (08.04.2026)
- [x] Email Center Bugfixes: send-admin-email v13, fetch-attachment-url v9, place-bid v25 (10.04.2026)
- [x] Push-Notification Integration: SW registriert, UI-Toggle, VAPID/ECDH (08.04.2026)
- [x] Google Tracking Fixes: 7 critical bugs, trackEvent in 12 Dateien (08.04.2026)
- [x] Wertrechner Kalibrierung: Basispreise, Tiers, Abschreibungskurven (09.04.2026)
- [x] Dealer Activation: send-dealer-auction-digest, /haendler Rewrite, first-nudge (08.04.2026)
- [x] Dealer Flow Audit: RLS Stats Bug, Wrong Column Names, Platform Stats RPC (08.04.2026)
- [x] Dealer Flow Fixes: DB Migrations, Invoice Fixes, Reverse Charge (08.04.2026)
- [x] Händler-Verkauf Features: DealerListingCreate, Privat/Händler Badge, Eigene-Auktionen-Filter (08.04.2026)
- [x] UX-Audit Fixes: DealerListingCreate Bugs, MotorhomeCard Badges, Sidebar Icons (08.04.2026)
- [x] Conversion Optimizations Phase 1-6: Wizard Redesign, Progressive Disclosure, Zero-Friction (08.04.2026)
- [x] Security: 11x search_path, SECURITY INVOKER, RLS Policies, audit_logs cleanup (08.04.2026)
- [x] Repo-Bereinigung: Alle veralteten Analyse-MDs, Snapshots, Task-Exports gelöscht (11.04.2026)

### Offene Aufgaben
- [ ] Blog-System: Tabelle + Seiten existieren, 0 Artikel (Content fehlt)
- [ ] Migration Edge Functions deaktivieren (harmlos, niedrige Priorität)
- [ ] Baujahr-Ranges per Model implementieren
- [ ] Fuzzy-Search für Tippfehler (z.B. "Exzellent" → "Excellent")
- [ ] GA4_API_SECRET erstellen (Google Analytics Admin → Data Streams)
- [ ] Google Ads: LANDING_PAGE_LEAD von Primary auf Secondary umstellen
