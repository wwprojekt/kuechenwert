# KüchenWert – Projekt-Kontext & Aufgaben-Management

## Projektübersicht

**KüchenWert** ist eine deutschsprachige Plattform für Küchenangebote, Preisvergleich und Studio-Leads (Funnel A/B/C). Der Code stammt von einem Caravan-Auktions-Fork — neue Features immer für Küchen, nie für Wohnmobile.

- **URL:** kuechenwert24.de
- **Supabase-Projekt:** `gzqayoalwtmypndrmqes`
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
- [x] Bug 1: bids max_autobid_amount – Column-Level REVOKE + bids_public View (14.04.2026)
- [x] Bug 3: AdminAnalytics Revenue – current_bid statt reserve_price, usersTrend-Fix (14.04.2026)
- [x] Bug 4: AppointmentBookingModal – 'verified' → 'confirmed' Status-Fix (14.04.2026)
- [x] Bug 5: AdminAuctions Recycling – Delete-before-activate + Error-Handling (14.04.2026)
- [x] Bug 6: DashboardOverview N+1 → 3 Batch-Queries (14.04.2026)
- [x] Kaufchance Variante A+B: "Anderen Betrag vorschlagen"-Button im Dialog + Inline Counter-Offer im MyKaufchancen Dashboard (17.04.2026)
- [x] Kaufchance Bug 2 (REVERTED): Server-Hard-Block für kaufchance_min_price wieder entfernt – der Verkäufer ist mündig und darf bewusst unter seinem Mindestpreis verkaufen, das ist gerade der Sinn der Nachverhandlung. Es bleibt nur ein informatives Server-Log. (17.04.2026)
- [x] Kaufchance Bug 7: Stille Mail-/Notification-Fehler über logEdgeError in error_logs persistieren (accept-kaufchance-offer, close-auction, check-expired-auctions) (17.04.2026)
- [x] Kaufchance Bug 3: close-auction löscht jetzt alte kaufchance_invitations vor UPSERT + One-Time Cleanup-Migration für Phantom-Invitations (17.04.2026)
- [x] Kaufchance Bug 1: post_auction_offers.expires_at jetzt konsistent zu auction.kaufchance_expires_at (Frontend + One-Time Sync-Migration) (17.04.2026)
- [x] Kaufchance Bug 4: accept-kaufchance-offer in atomare Postgres RPC `accept_kaufchance_offer_atomic` ausgelagert (kein Split-Brain mehr möglich) (17.04.2026)
- [x] Vertragsstrafen atomar: Neue Edge Function `create-and-send-seller-penalty` (Auth → RPC → PDF → E-Mail → audit_logs in einem Server-Call). `CreateSellerPenaltyDialog` ruft diese statt 3-step-Browser-Chain. Stille Mail-Fehler landen in `error_logs`. (17.04.2026)
- [x] Admin-Support-Antwort lügt nicht mehr: `AdminMessages.handleRespond` hat bisher nur `support_messages.admin_response` in der DB gesetzt und einen "Antwort gesendet"-Toast angezeigt – ohne dass je eine Mail rausging. Ruft jetzt `send-admin-email` mit `reply_to_message_type: 'support'`, das beides in einem Schritt macht. (17.04.2026)
- [x] Zahlungsbestätigung atomar: Neue Edge Function `record-invoice-payment` (Auth → payment_history insert → invoice update → Quittungs-Mail → audit_logs in einem Server-Call). `RecordPaymentDialog` ruft diese statt 2-step-Browser-Update. Händler bekommt jetzt automatisch eine Bestätigung mit Zahlungsdetails + Restbetrag. (17.04.2026)
- [x] Storno atomar: Neue Edge Function `cancel-invoice` (Auth → invoice cancel → Storno-Mail mit optionalem Grund → audit_logs). `AdminFinancials.cancelInvoiceMutation` + AlertDialog ruft diese statt stiller Browser-Update. Händler erfährt jetzt von Stornierungen und bekommt ggf. Erstattungs-Hinweis bei Teilzahlung. (17.04.2026)
- [x] Session-Expired UX-Architektur: Globale `registerSessionExpiredHandler`-Registry in `sessionGuard.ts` + Auto-Trigger des `SessionExpiredDialog` aus `invokeWithAuth()`, sodass alle ~150 Aufrufstellen automatisch korrekt funktionieren ohne manuelle `instanceof SessionExpiredError`-Checks. Toast-Wrapper (`use-toast.ts`) unterdrückt zusätzlich `SESSION_EXPIRED`-Toasts → Nutzer sieht nur den Dialog, nie verwirrenden Doppel-UI. `PostAuctionOfferDialog` (5 Handler) gehärtet. Behebt Error-Log "Mittel/Unbekannt/Händler/Global SESSION_EXPIRED". (19.04.2026)
- [x] Error-Log-Rauschen reduziert: Globaler `console.error`/`unhandledrejection`-Interceptor in `errorLogService.ts` filtert jetzt `SessionExpiredError` (Dialog handhabt UX) und transiente Netzwerkfehler ("Load failed" Safari, "Failed to fetch" Chrome) komplett raus. Begründung: nicht actionable, User-sichtbare Netzwerkfehler werden weiter über `toast()` und `handleApiError()` korrekt erfasst. Behebt Error-Log "Niedrig/API/seller/Global Load failed" auf Startseite. (19.04.2026)

- [x] P0 Audit-Batch 21.08.2026: site_settings Secrets gesperrt, Google-Review-RPCs gehärtet, Funnel Helmet+Tracking, km/Wohnmobil-Copy auf Karten/Dashboard, Funnel-CSS, request-price-change verify_jwt=false, AGENTS.md/project.md auf KüchenWert

### Offene Aufgaben
- [ ] DealerListingCreate noch Wohnmobil-Formular (Hymer/km) — auf Küchenfelder umbauen oder verstecken
- [ ] Funnel A/B: send-lead-notification / track-conversion serverseitig verdrahten
- [ ] sessionGuard: ensureValidRLSSession auf Seller/Dealer-Reads (MyListings, ListingEdit, DealerDashboard)
- [ ] Query-Keys: ConvertToKitchenDialog + Admin-Delete invalidieren myListings/myLeads
- [ ] Google-Review-Send-Pipeline wiederherstellen (Function fehlt) oder Cron dauerhaft tot lassen
- [ ] Dealer-Inserat + Admin Kitchen Detail: restliche Fahrzeug/km-Copy
- [ ] Stille Admin-Aktionen ohne Empfänger-Mail (Audit 17.04.2026):
  - [x] HIGH: `purchase_contracts cancel` (`AdminContracts`) → atomic via Edge Function `cancel-purchase-contract` (Käufer + Verkäufer Mail, Motorhome-Reset, Audit, Error-Logs) [17.04.2026]
  - [x] HIGH: `cancelAuctionAsAdmin` / `AdminMotorhomes.cancelAuctionMutation` → atomic via Edge Function `cancel-auction-as-admin` (Verkäufer + alle Bieter + Festpreis-Anbieter + Kaufchance-Invitees informiert, Audit, Error-Logs) [17.04.2026]
  - [x] HIGH: `AdminPostAuctionOffers.handleEndKaufchance` / `handleBackToAuction` → atomic via Edge Function `end-kaufchance` (mode=`end_unsold`/`restart_auction`, alle Bieter+Vorschläger+Kaufchance-Invitees + Verkäufer informiert, Audit, Error-Logs) [17.04.2026]
  - [x] HIGH: `admin_delete_bid` → atomic Wrapper Edge Function `admin-delete-bid` (RPC + Mail an betroffenen Bieter inkl. höchstes-Gebot-Hinweis, Audit, Error-Logs) [17.04.2026]
  - [x] HIGH: `complete-handover` Edge Function – jetzt Käufer- und Verkäufer-Mail mit Übergabedetails + optionalem PDF-Link, Audit, Error-Logs [17.04.2026]
  - [x] HIGH: `deleteDealerApplication` → atomic via Edge Function `admin-delete-dealer-application` (Mail an Bewerber inkl. optionalem Grund VOR Löschung, Audit, Error-Logs) [17.04.2026]
  - [x] HIGH: User/Dealer-Suspend (`AdminUsers`/`AdminDealers`/`AdminDealerDetail`/`UserEditDialog`) → atomic via Edge Function `admin-suspend-user` (Sperr-/Entsperr-Mail mit optionalem Grund, Audit, Error-Logs) [17.04.2026]
  - [x] HIGH: `admin-delete-user` – Lösch-Mail VOR Account-Löschung mit optionalem Grund, Audit, Error-Logs [17.04.2026]
  - MEDIUM: Claim-Status-Wechsel, Appointment-Status-Wechsel, Doc-Verify, Review-Moderation, Rollen-Wechsel, Auction-Activate, Kaufchance-Min-Preis/Verlängerung
  - LOW: Blog-Publish, Commission-Tier-Änderung
- [ ] Bug 2: motorhomes RLS – sensible Spalten (reserve_price, contract_url, VIN, Kennzeichen) mit Column-Level Grants / View schützen (40+ Dateien betroffen, phased approach)
- [ ] Bug 4 (DB): EXCLUSION-Constraint auf appointments(station_id, appointment_date) für echte TOCTOU-Absicherung
- [ ] Bug 7: RESEND_API_KEY in Supabase Edge Function Secrets prüfen/erneuern
- [ ] Blog-System: Tabelle + Seiten existieren, 0 Artikel (Content fehlt)
- [ ] Migration Edge Functions deaktivieren (harmlos, niedrige Priorität)
- [ ] Baujahr-Ranges per Model implementieren
- [ ] Fuzzy-Search für Tippfehler (z.B. "Exzellent" → "Excellent")
- [ ] GA4_API_SECRET erstellen (Google Analytics Admin → Data Streams)
- [ ] Google Ads: LANDING_PAGE_LEAD von Primary auf Secondary umstellen
