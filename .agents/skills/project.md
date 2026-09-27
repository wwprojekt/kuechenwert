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
- [x] DealerListingCreate auf Küchenfelder (Marke/Form/Jahr/Zustand), body_type-Enum um Layouts erweitert, ListingEdit ohne Fahrzeug-Tabs (21.08.2026)
- [x] Marktplatz 25.09.2026: Security-Hardening (Lead-PII, Definer-Views, offene RPCs), Ausschreibungen/Studio-Angebote/Kontaktkauf/Annahme als RPCs, Outbox + kw-market-worker (E-Mails), PLZ-Umkreis, Funnel-B-Laufzeit 72 h (`tender_duration_hours_unterbieten`), Admin-Freigabe/Anlage von Ausschreibungen (`kw_admin_open_tender`, AdminLeads)
- [x] Traumküche-Konfigurator v2 (/funnel/c): Raumfoto + Maße, Stil/Fronten/Geräte, KI-Edit (fal.ai), Preis-Engine (shared TS + Tests), Projektseite /projekt/:token, Studio-Projekt-Börse /dashboard/projekte inkl. JSON/DXF-Export (25.09.2026)
- [x] Branding 25.09.2026: Caravan-Rasterlogos/OG-Bild/Favicons ersetzt (`scripts/generate-logo-assets.mjs`), Caravan-Bilder entfernt, Hero mit klickbaren 3 Wegen, Landing-Texte an echte Abläufe angepasst, FAQ als eine Quelle (`src/data/faq.ts`), nginx: immutable nur für /assets/
- [x] Site-Settings wieder live: `public_site_settings` lieferte seit 21.08. für anon 401 → RPC `get_public_site_settings` + localStorage-Cache; Laufzeit-Farbüberschreibung entfernt (DB-HSL ohne %, überschrieb Dark Mode) (25.09.2026)
- [x] Supabase-Client: `lockAcquireTimeout` entfernt (hat Database-Typen des Clients zerstört, Typfehler 1962 → ~250) (25.09.2026)
- [x] Funnel A v2 (25.09.2026): 18 Schritte nach kuechenportal-Vorbild, gemeinsamer Katalog `_shared/funnel-a-catalog.ts` (Labels, Legacy-IDs, Preisanker), Submit über Edge Function `kw-lead` (Honeypot, Turnstile, Rate-Limit, `lead_consents` mit `text_version`), Telefon optional + Nachtragen auf der Projektseite (`kw-project` add-phone), Landing `/formular`, Grundriss-Piktogramme statt falscher Formfotos, Labels in Studio-Portal/Admin/Mails, Funnel-B-Budget in Euro (Trigger). Migrationen `20260925221331_kw_funnel_a_v2`, `20260925222534_kw_funnel_b_budget_eur`. Deployt: kw-lead v1, kw-project v2, kw-market-worker v3. E2E mit echtem Submit getestet, Testdaten gelöscht.

- [x] Auftragsverlauf nach dem Zuschlag (26.09.2026): `kw_orders` + `kw_order_events`, Trigger beim Zuschlag, Studio-Etappen per `kw_dealer_order_update` (Kontakt, Aufmaß, Kaufvertrag mit finalem Auftragswert, Montage, Fertig, „nicht zustande gekommen“), Kundenseite mit Bestätigen/Problem melden (`kw-project` v3), Tick `kw-order-tick` (Erinnerung 48 h, Eskalation 96 h, Montage-Rückfrage), eigener Outbox-Kanal `order` + Edge Function `kw-order-worker` v1. Migration `20260926132427_kw_order_lifecycle`, per Rollback-Test durchgeprüft.
- [x] P0 Umbenennung `motorhomes` → `kitchens` (26.09.2026): 28 DB-Funktionen, davon 7 Trigger, verwiesen noch auf alte Namen; u. a. brach jede Studio-Freischaltung ab (Trigger auf `user_roles`). Migration `20260926133055_kw_fix_kitchen_rename_in_functions`.
- [x] Studio-Mails und Rechnungen (26.09.2026): `send-dealer-notification` v10 (Küchen-Marktplatz statt Wohnmobil-Auktionen), `send-invoice-email` v10 und `generate-invoice-pdf` v9 beschriften je Rechnungstyp (Kontaktfreischaltung/Provision mit Projektbezug statt „FAHRZEUGREFERENZ“), PDF in Forest Sage, lange Positionstexte umbrechen. Mail-Footer: Antworten erreichen das Service-Team.
- [x] Sicherheit (26.09.2026): `_shared/auth.ts` akzeptierte gefälschte service_role-JWTs (Payload nur dekodiert, Functions mit `verify_jwt = false`). Methode 2 prüft jetzt beim Auth-Server. Live bestätigt und behoben für `generate-invoice-pdf`, `send-invoice-email`, `send-dealer-notification`.

### Offene Aufgaben
- [x] Security-Sweep abgeschlossen (27.09.2026): Alle 42 Functions mit `checkServiceRoleOrAdmin` laufen mit dem gehärteten `_shared/auth.ts`; die 38 offenen per MCP-Shim auf Commit `39e2cfe` (Raw-Import aus dem öffentlichen Repo, siehe AGENTS.md). Vorher geprüft: keine davon per Cron oder DB-Trigger aufgerufen. `node scripts/redeploy-secure-functions.mjs --probe-only` bestätigt 42/42 mit 401 bei gefälschtem Token.
- [x] Mail-Test (27.09.2026): Testprojekt über `kw-lead` eingereicht; Trigger, Outbox (`tender_published`, `project_created`) und `kw-market-worker` liefen fehlerfrei, Resend hat Projektlink-Mail und Admin-Hinweis angenommen (an die Lead-Weiterleitungsadresse). Testdaten danach vollständig gelöscht. Sichtprüfung im Postfach steht beim Betreiber.
- [ ] **Resend-Webhook** auf `https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/inbound-webhook` einrichten (Events `email.sent/delivered/bounced/complained/delivery_delayed`): In 24 h kam kein einziger Aufruf an, Zustellstatus in `admin_emails` bleibt deshalb auf `sent`, Bounces bleiben unbemerkt.
- [ ] **DMARC fehlt** für `kuechenwert24.de` (DKIM `resend._domainkey` und SPF auf `send.` sind vorhanden). In Cloudflare-DNS: TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:info@kuechenwert24.de`, nach ein paar Wochen Berichten auf `p=quarantine` erhöhen.
- [ ] **Turnstile ist serverseitig aus**: Supabase-Secret `CLOUDFLARE_TURNSTILE_SECRET` fehlt, `kw-lead` überspringt die Prüfung (live mit Token-losem Request bestätigt). Secret aus Cloudflare Turnstile setzen, `VITE_TURNSTILE_SITE_KEY` im Build prüfen.
- [ ] 5 Leads aus Juni/Juli 2026 stehen noch auf `new` (vor dem Marktplatz eingegangen, ohne Ausschreibung): sichten, nachfassen oder als Test markieren.
- [ ] Nach dem Frontend-Release den Auftragsverlauf einmal Ende-zu-Ende live durchspielen (Studio meldet Etappen, Kundenseite, Mails von `kw-order-worker`).
- [x] Caravan-Legacy reversibel ausgeblendet (27.09.2026): `/kaufen` und `/auktion/:id` leiten auf `/formular` um (auch aus Sitemap und Lighthouse entfernt), Studio-Deep-Routes (`auctions`, `inventory`, `bids`, `kaufchancen`, `appointments`, `contracts`, `claims`, `search-alerts`, `listings*`) leiten auf die Projekt-Börse um, Kunden-Menü ohne Inserate/Gebote/Favoriten/Kaufchancen/Termine. Seiten bleiben im Code (`LEGACY_DEALER_PATHS` in `SmartDashboard`). Neue Einstellungsseite `/dashboard/settings` für Studios und Kunden ersetzt `DealerSettings` samt Auktions-`NotificationPreferences` und kaputtem Dark-Mode-Schalter (ThemeProvider erzwingt Hell).
- [x] E-Mail-Einwilligungen (27.09.2026): Werbe-Rundmails nur noch mit Opt-in, Newsletter-Default `false` (Migration `20260927152955_kw_newsletter_opt_in_default`), gemeinsame Empfängerlogik `_shared/broadcast-recipients.ts` mit Paging und Abbruch bei Lesefehlern, Admin-Empfängerzahl berücksichtigt das Werbe-Flag. Deployt: `send-broadcast-email` v11, `get-recipient-count` v9.
- [ ] Echter One-Click-Abmeldelink für Rundmails (RFC 8058, signiertes Token + Edge Function); bisher verlinkt die Mail auf `/dashboard/settings` (Login nötig). Pflicht spätestens ab ~5.000 Mails/Tag an Gmail/Yahoo.
- [ ] Übrige Caravan-Reste: Admin-Seiten (Auktionen, Übergaben, Kaufverträge), Legacy-Mails/PDFs (Kaufvertrag, Übergabeprotokoll, Auktions-Mails), Fehlermeldungen in DB-Funktionen („Wohnmobil nicht gefunden“), `worker/` (nicht deployt, vor Aktivierung umstellen).
- [x] **Production-Deploy freigeschaltet (27.09.2026)**: Frontend einmal manuell in Dokploy deployt (vorher lief der Build vom 10.05.2026), `sw.js` v7, `/formular` und `/projekt/:token` live geprüft. Repo-Secrets `DOKPLOY_URL`, `DOKPLOY_APP_ID` und `DOKPLOY_API_KEY` (Dokploy-Key `github-actions-deploy`) gesetzt: `.github/workflows/deploy.yml` deployt jeden Push auf `main` nach Typecheck, Tests und Build. Bewusst kein Repo-Webhook, sonst baut Dokploy doppelt und ungeprüft.
- [x] Nach dem Frontend-Release (27.09.2026): `sitemap` v15 in der Repo-Fassung deployt, `kuechenwert24.de/sitemap.xml` listet `/formular` statt `/funnel/a`. `kw-planner` bleibt v3: live und Repo verhalten sich gleich (aus `brand-config.ts` wird nur `baseUrl` genutzt, `validIp` und `loadRateCard` sind nur verschoben), Repo-Fassung mit der nächsten echten Änderung deployen.
- [ ] **Dokploy-Panel nur per HTTP** (Server-IP mit Port 3000, keine Domain, kein TLS): Login und der API-Key des Deploy-Workflows gehen unverschlüsselt übers Netz. Subdomain (z. B. `deploy.kuechenwert24.de`, A-Record auf die Server-IP, in Cloudflare nur DNS) unter Dokploy → Settings → Web Server mit Let's Encrypt eintragen, danach Secret `DOKPLOY_URL` auf https umstellen und Port 3000 von außen sperren. Den älteren Dokploy-Key „Github“ löschen, falls ihn nichts mehr nutzt. Server-IP und Panel-URL nicht ins Repo schreiben (Repo ist öffentlich, die Seite läuft hinter Cloudflare).
- [ ] Nach dem Release: Anon-Insert-Policy auf `leads` entfernen, sobald auch Funnel B serverseitig absendet (Funnel A nutzt `kw-lead`).
- [ ] Click-Wrap-, Einwilligungs- und Transparenztexte in Funnel A (`kw-anfrage-2026-09`) anwaltlich prüfen lassen.
- [x] Funnel A/B/C: send-lead-notification type=funnel + track-conversion (Click-IDs) (21.08.2026)
- [x] sessionGuard: ensureValidRLSSession auf Seller/Dealer-Reads (MyBids, DealerInventory, DealerClaims, MyKuechenJourney, NotificationPreferences, DealerDashboard, ListingEdit) (21.08.2026)
- [x] Query-Keys: ConvertToKitchenDialog + Admin-Delete invalidieren myListings/myLeads/admin-leads (21.08.2026)
- [ ] Google-Review-Send-Pipeline wiederherstellen (Function fehlt) oder Cron dauerhaft tot lassen
- [x] Admin Kitchen/Auction/Appointment Copy: Form statt km/Aufbauart (21.08.2026)
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
- [ ] Veraltete Unit-Tests (Caravan-Rename nicht nachgezogen): useWizardForm, security, validation, useUserRole, AuthContext – 13 Fehler, vor 25.09.2026 entstanden
- [ ] Restliche ~250 Typfehler in Caravan-Altmodulen (Listings, AuctionDetail, Admin-Seiten) – `npm run typecheck:all`
- [ ] Turnstile einrichten: Der bis 25.09.2026 fest eingebaute Site-Key ist für kuechenwert24.de nicht freigegeben (Fehler 110200, Widget aus der Caravan-Zeit) und wurde entfernt; ohne Key lädt Turnstile gar nicht. In Cloudflare ein Widget mit Hostname `kuechenwert24.de` anlegen (Modus „Managed“ oder „Invisible“), `VITE_TURNSTILE_SITE_KEY` als Build-Variable in Dokploy und `CLOUDFLARE_TURNSTILE_SECRET` als Supabase-Secret setzen. Bis dahin schützen Honeypot und Rate-Limit.
- [ ] Supabase Auth: Leaked-Password-Protection aktivieren (Dashboard)
- [ ] Alte Edge Functions `kw-planner-generate` / `kw-planner-submit-lead` löschen, sobald der neue Konfigurator live verifiziert ist
- [ ] `send-lead-notification`: deployte Fassung (21.08., gebündelt) mit Repo abgleichen, bevor sie neu deployt wird
- [ ] Planungssoftware: CARAT-Projektimport bzw. CARAT planner als Plattform-Lizenz mit CARAT klären; „DataX“ existiert nicht, Alternativen (K:PLAN, IDM/DCC, Winner Flex) in docs/planning-software-integration.md
