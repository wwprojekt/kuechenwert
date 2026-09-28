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
- [x] **Audit-Umsetzung (28.09.2026)**, alles deployt und live geprüft:
  - Datenbank: Lead-Policies, offene Buckets, Legacy-RPC-Rechte, Audit-Log, Blog-Entwürfe und Caravan-Spalten gehärtet; `log_error` gegen leere und gefälschte Einträge (Migration `20260928195924`, Function `log-error` stillgelegt); Planer-Bilder nur noch signiert, Bucket `planner-renders` privat (`20260928201301`); direkter INSERT auf `contact_messages` entzogen, Kontakt nur noch über `kw-contact` (`20260928211341`); Triggerfunktion `kw_log_email_consent` ohne öffentliche Ausführungsrechte (`20260928211918`).
  - Einwilligungen: Funnel-Defaults, Studio-Einwilligung in Funnel B, Freischaltung prüft die Einwilligung; Abmeldung per Link ohne Login (RFC 8058, `kw-unsubscribe`, `/abmelden`) mit Einwilligungsprotokoll (`20260928201711`).
  - Projektlink: Token nicht mehr in Tracking, Error- und Mail-Logs, Ablauf und Begrenzung, `no-referrer`/`noindex`/`no-store`; Raumfotos ohne EXIF/GPS (Browser und Server); Abdeckungsprüfung per PLZ mit ehrlichen Texten.
  - Abrechnung: automatische Ausstellung mit Pflichtangaben nach § 14 UStG (`_shared/issuer-profile.ts`, IBAN-Prüfziffer), Entwurf solange Angaben fehlen, GoBD-Schutz, PDFs write-once, Leistungsdatum, Mahnlauf-Fixes (`20260928194846`); Entwürfe in Admin-Finanzen und „Meine Rechnungen“ gekennzeichnet.
  - Studio-Registrierung mit Turnstile: ohne bestandene Prüfung kein Konto, keine Bestätigungsmail (schützt das Resend-Tageskontingent) und keine Auskunft, ob eine Adresse schon registriert ist.
  - Marktplatz/Admin: Reklamation gekaufter Kontakte, Admin-Aktionen an Ausschreibungen, Reklamationen im Admin (`20260928202413`, `20260928202636`), Marktplatz-Einstellungen unter `/admin/marktplatz`.
  - Betrieb: `kw-maintenance` (Löschfristen täglich, Health-Check stündlich, entprellte Admin-Alarme, `20260928200833`); Cron-Functions prüfen `x-kw-cron-secret`.
  - Recht: AGB für das Vermittlungsmodell, Konditionen für Studios (`/konditionen`), Datenschutz mit Löschfristen (`20260928204008`), Mail-Fußzeile nach § 35a GmbHG.
  - Frontend: Caravan-Code entfernt (tsc projektweit fehlerfrei), ehrliche Texte ohne unbelegte Claims, Preise live aus der DB, Kontakt über `kw-contact`, `/barrierefreiheit`.
  - SEO/Infra: Prerendering im Docker-Build, echte 404, 301 für Altlinks, CSP ohne Inline-Skripte, HSTS `includeSubDomains`, Real-IP hinter Cloudflare, Sitemap nur mit indexierbaren Seiten, Service Worker v8.
  - CI: ESLint und alle Vitest-Tests vor jedem Deploy, Actions auf Commit-SHAs gepinnt, Dependabot; `AGENTS.md` auf KüchenWert-Stand.
- [x] **Funnel B mit Unterlagen (28.09.2026)**: Angebot und Unterlagen sind jetzt Schritt 1 (Angebot, Planung, Fotos; mehrere Dateien, PDF oder Bild, bis 10 × 20 MB), die Detailschritte lassen sich überspringen. Nachreichen über den Projektlink (`kw-project` upload-files/attach-files, Admin-Mail `lead_files_added`). Studios sehen Unterlagen nur nach Freigabe durch das Team (ggf. geschwärzte Fassung, Admin → Anfragen → Ausschreibung) oder nach Kontaktkauf/Zuschlag (Migration `20260928214801`, Einwilligung `kw-unterbieten-2026-09-28b`).

### Offene Aufgaben
- [x] Security-Sweep abgeschlossen (27.09.2026): Alle 42 Functions mit `checkServiceRoleOrAdmin` laufen mit dem gehärteten `_shared/auth.ts`; die 38 offenen per MCP-Shim auf Commit `39e2cfe` (Raw-Import aus dem öffentlichen Repo, siehe AGENTS.md). Vorher geprüft: keine davon per Cron oder DB-Trigger aufgerufen. `node scripts/redeploy-secure-functions.mjs --probe-only` bestätigt 42/42 mit 401 bei gefälschtem Token.
- [x] Mail-Test (27.09.2026): Testprojekt über `kw-lead` eingereicht; Trigger, Outbox (`tender_published`, `project_created`) und `kw-market-worker` liefen fehlerfrei, Resend hat Projektlink-Mail und Admin-Hinweis angenommen (an die Lead-Weiterleitungsadresse). Testdaten danach vollständig gelöscht. Sichtprüfung im Postfach steht beim Betreiber.
- [ ] **Resend-Webhook** auf `https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/inbound-webhook` einrichten (Events `email.sent/delivered/bounced/complained/delivery_delayed`): In 24 h kam kein einziger Aufruf an, Zustellstatus in `admin_emails` bleibt deshalb auf `sent`, Bounces bleiben unbemerkt.
- [x] DMARC (27.09.2026): TXT `_dmarc.kuechenwert24.de` = `v=DMARC1; p=none` (DKIM `resend._domainkey` und SPF auf `send.` waren schon da). Bewusst ohne `rua`: Berichte an `info@` liefen über den Inbound-Webhook und könnten Auto-Antworten auslösen.
- [ ] DMARC-Berichte: in Cloudflare „DMARC Management“ aktivieren (eigene Report-Adresse und Auswertung), nach ein paar Wochen ohne Fremdversand auf `p=quarantine` erhöhen.
- [x] **Turnstile aktiv (27.09.2026)**: Widget „KuechenWert Formulare“ (Managed, `kuechenwert24.de` und `www`), Site-Key als Dokploy-Build-Argument `VITE_TURNSTILE_SITE_KEY`, Secret im Supabase Vault (`cloudflare_turnstile_secret`, gelesen über `kw_turnstile_secret`). Ohne gültiges Token wird ein Lead nicht abgelehnt, sondern als `leads.bot_check = unverified` markiert und nicht automatisch an Studios veröffentlicht (Migration `20260927221032`; Admin → Leads zeigt „Ungeprüft“, Freigabe im Ausschreibungs-Panel). Live geprüft: Widget lädt, ungültiges Token ergibt `unverified` und einen Entwurf (Secret also gültig), Testdaten gelöscht.
- [x] Entfällt (28.09.2026): Das Kontaktformular sendet über `kw-contact` (Turnstile aus dem Vault, Rate-Limit, Zod), `send-lead-notification` ist stillgelegt (410).
- [ ] 5 Leads aus Juni/Juli 2026 stehen noch auf `new` (vor dem Marktplatz eingegangen, ohne Ausschreibung): sichten, nachfassen oder als Test markieren.
- [ ] Nach dem Frontend-Release den Auftragsverlauf einmal Ende-zu-Ende live durchspielen (Studio meldet Etappen, Kundenseite, Mails von `kw-order-worker`).
- [x] Caravan-Legacy reversibel ausgeblendet (27.09.2026): `/kaufen` und `/auktion/:id` leiten auf `/formular` um (auch aus Sitemap und Lighthouse entfernt), Studio-Deep-Routes (`auctions`, `inventory`, `bids`, `kaufchancen`, `appointments`, `contracts`, `claims`, `search-alerts`, `listings*`) leiten auf die Projekt-Börse um, Kunden-Menü ohne Inserate/Gebote/Favoriten/Kaufchancen/Termine. Seiten bleiben im Code (`LEGACY_DEALER_PATHS` in `SmartDashboard`). Neue Einstellungsseite `/dashboard/settings` für Studios und Kunden ersetzt `DealerSettings` samt Auktions-`NotificationPreferences` und kaputtem Dark-Mode-Schalter (ThemeProvider erzwingt Hell).
- [x] E-Mail-Einwilligungen (27.09.2026): Werbe-Rundmails nur noch mit Opt-in, Newsletter-Default `false` (Migration `20260927152955_kw_newsletter_opt_in_default`), gemeinsame Empfängerlogik `_shared/broadcast-recipients.ts` mit Paging und Abbruch bei Lesefehlern, Admin-Empfängerzahl berücksichtigt das Werbe-Flag. Deployt: `send-broadcast-email` v11, `get-recipient-count` v9.
- [x] One-Click-Abmeldelink für Rundmails (28.09.2026): signiertes Token, `kw-unsubscribe`, `List-Unsubscribe`/`List-Unsubscribe-Post` pro Empfänger, Seite `/abmelden` ohne Login.
- [x] Caravan-Reste in Frontend und Edge Functions (28.09.2026): Seiten, Komponenten, Mails/PDFs entfernt bzw. Functions stillgelegt (410), Altrouten per 301.
- [ ] Caravan-Reste in der Datenbank: Tabellen (`auctions`, `bids`, `kitchens`, `kaufchance_invitations`, `post_auction_offers`, `appointments`, `wizard_sessions` u. a.), zugehörige Funktionen, Trigger und Buckets sowie Fehlermeldungen wie „Wohnmobil nicht gefunden“ per Migration entfernen, sobald feststeht, dass nichts mehr darauf zugreift. `worker/` (nicht deployt) löschen oder umstellen.
- [ ] Stillgelegte Edge Functions (59, Liste „Stillgelegt“ in `supabase/config.toml`) nach einer Beobachtungszeit im Supabase-Dashboard löschen, danach Verzeichnisse und Einträge entfernen.
- [ ] Strikter Typcheck: `AdminUserDetail` (8 Fehler), `AdminDealerDetail` (3), `SmartDashboard` (3), `AdminErrorLogs` (2), `AdminFinancials` (2), `MyInvoices` (1), `MyMessages` (1) beheben und in `tsconfig.strict.json` aufnehmen.
- [ ] Vor dem ersten Blogbeitrag mit eigenem Bild: Seiten mit `ogImage` bekämen zwei `og:image`-Tags (statischer Default in `index.html` ohne `data-rh`). Default-Tag Helmet-verwaltet machen und in `PageLayout` immer ein `og:image` setzen.
- [ ] Vorgerenderte Seiten: Beim Übernehmen durch React blitzt bei lazy geladenen Seiten kurz der Lade-Spinner auf (lokal ~25 ms, langsames 4G ~100 ms, CLS ≤ 0,002). Route-Chunk vor dem ersten Render vorladen.
- [x] **Production-Deploy freigeschaltet (27.09.2026)**: Frontend einmal manuell in Dokploy deployt (vorher lief der Build vom 10.05.2026), `sw.js` v7, `/formular` und `/projekt/:token` live geprüft. Repo-Secrets `DOKPLOY_APP_ID` und `DOKPLOY_API_KEY` (Dokploy-Key `github-actions-deploy`) gesetzt: `.github/workflows/deploy.yml` deployt jeden Push auf `main` nach Typecheck, Tests und Build. Bewusst kein Repo-Webhook, sonst baut Dokploy doppelt und ungeprüft.
- [x] Nach dem Frontend-Release (27.09.2026): `sitemap` v15 in der Repo-Fassung deployt, `kuechenwert24.de/sitemap.xml` listet `/formular` statt `/funnel/a`. `kw-planner` bleibt v3: live und Repo verhalten sich gleich (aus `brand-config.ts` wird nur `baseUrl` genutzt, `validIp` und `loadRateCard` sind nur verschoben), Repo-Fassung mit der nächsten echten Änderung deployen.
- [x] **Dokploy-Panel unter `https://deploy.kuechenwert24.de`** (27.09.2026): A-Record über den Cloudflare-Proxy (Server-IP bleibt verborgen), Let's-Encrypt-Zertifikat über Traefik, Login und API darüber geprüft. `deploy.yml` nutzt die HTTPS-Adresse fest; das alte Secret `DOKPLOY_URL` (IP-Adresse) liest der Workflow nicht mehr, es kann in GitHub gelöscht werden. Alter Dokploy-Key „Github“ (zuletzt benutzt am 26.04.2026) gelöscht.
- [ ] Port 3000 des Servers von außen sperren (IONOS-Firewall), damit das Panel nur noch über die Domain erreichbar ist, und 2FA für den Dokploy-Admin aktivieren. Außerdem 80/443 nur für die Cloudflare-IP-Bereiche öffnen (oder Authenticated Origin Pulls): nginx übernimmt die Client-IP aus `CF-Connecting-IP`, wer den Server direkt erreicht, kann sie fälschen und die Rate-Limits umgehen. Server-IP nicht ins Repo schreiben (Repo ist öffentlich, die Seite läuft hinter Cloudflare).
- [x] **Mobil-/Tablet-Audit der drei Funnels (27.09.2026)**, Browser-Durchlauf 320–1366 px plus axe (WCAG 2.2 AA):
  - Kopfzeile war auf Handys 432 px breit (Startseite, `/formular`, alle Inhaltsseiten): Logo schrumpft jetzt, Slogan erst ab `sm`. Dazu der CTA in `Benefits` bei 320 px.
  - Funnel B: echte Support-Nummer statt Platzhaltern (`+49 30 555 80 100`, `+49 000 …`, jetzt `useSupportPhone`), Kopf und feste Weiter-Leiste wie Funnel A, Schritt in der URL (`?schritt=`, Zurück-Geste und Neuladen bleiben im Funnel). Außerdem: Labels und Autofill an allen Feldern, verständliche Fehlermeldung statt Datenbanktext, gemeldete statt verschluckte Upload-Fehler, Tracking blockiert keinen erfolgreichen Versand mehr, keine Lead-ID mehr in der Danke-URL.
  - Funnel B Texte: Auktion/Händler/verbindliches Gebot und das nie eingelöste Upload-Link-Versprechen entfernt. `FunnelBClient` ist jetzt im strikten Typecheck.
  - Funnel C: Schritt in der URL, Haken verdeckte Kachel-Titel, Qualitätsstufen auf Handys einspaltig, Preisleiste passt ab 360 px, Screenreader-Namen für Schrittleiste/Telefon/Foto-Feld, „Preisschätzung“ statt „KI-Preisschätzung“ (Preis kommt aus der Rate-Card).
  - Funnel A: überall „ca. 3 Minuten“, Budget-Buttons 44 px. Kontrast: `ink-subtle` volle Deckkraft, Footer-Zeiten `slate-400`.
- [x] **Google-Ads-Test vorbereitet (27.09.2026)**:
  - Tracking: GA4 `G-H4BCV8DS0B` und Google Ads `AW-18033517246` gehörten CaravanWert (Wizard-Labels, MCC 974-650-8145, Server-Upload-Aktion 7576040066). Aus Frontend-Fallbacks, `track-conversion` und `tracking_config` entfernt (Migration `20260927203110`); GA4/Ads bleiben aus, bis KüchenWert-IDs eingetragen sind. Küchenanfragen aller Funnels melden `KUECHEN_LEAD` (Admin → Tracking), Enhanced Conversions mit E.164-Telefon und Land DE, kein zweiter Server-Upload für Funnel-Leads (Doppelzählung, Einwilligung).
  - Einwilligung: Google-Tag und Meta-Pixel laden erst nach Zustimmung (Basic Consent Mode), keine noscript-Pixel mehr, Clixtell entfernt, Schriften lokal über `@fontsource/fira-sans` statt Google Fonts. Klick-IDs (gclid, gbraid, wbraid, msclkid, fbclid) nur mit Marketing-Einwilligung im localStorage und am Lead.
  - Abbruchanalyse: Event `funnel_step` pro Schritt und `funnel_submit_error` in allen drei Funnels (eigene Tabellen und GA4, nur mit Analyse-Einwilligung).
  - Lead-Eingang (Migration `20260927203642`): `submission_id` gegen Doppel-Leads, Lead und `lead_consents` in einer Transaktion (`kw_insert_lead_with_consents`), Klick-ID-Spalten. Funnel B sendet über die neue Function `kw-lead-b` (Validierung gegen Katalog, Turnstile, Honeypot, Rate-Limit, signierte Upload-URLs mit `lead_upload_tokens`), Ende-zu-Ende getestet.
  - Funnel C: Kostenschutz für KI-Bilder (Rate-Limits fail-closed, 30/Tag/IP, 300/Tag gesamt über `KW_DAILY_RENDER_CAP`, laufende Visualisierung wird wiederverwendet), `already_submitted` gegen doppelte Conversions, abgeschickte Planung wird nicht fortgesetzt.
  - Recht: Datenschutzerklärung neu (alle Dienste, Vermittlungsablauf, KI, Enhanced Conversions, TDDDG), Impressum DDG statt TMG, EU-OS-Plattform entfernt (Migrationen `20260927205628`, `20260927205936`), KI-Hinweis im Planer, Cookie-Banner kompakt mit gleichwertigen Buttons.
- [x] **Direkte Lead-Inserts entfernt (27.09.2026)**: Policies „Leads: anon insert via funnel“, „Leads: authenticated insert own“, „LeadFiles: anon/auth insert“, „LeadFiles Storage: funnel upload“ und die Funktion `kw_lead_accepts_uploads` gelöscht, `anon` ohne INSERT auf `leads`, `lead_files`, `lead_consents` (Migration `20260927215839`). Direkter Insert liefert 42501, Funnel-B-Upload über signierte URL weiter geprüft.
- [x] **Edge Functions live und Ende-zu-Ende geprüft (27.09.2026)**: `track-conversion` v9 (keine CaravanWert-Fallbacks mehr), `kw-lead` v3, `kw-lead-b` v2, `kw-planner` v5. Doppeltes Absenden liefert denselben Lead, Klick-IDs und Einwilligungen kommen an, Preisschätzung identisch mit dem Repo-Code; Outbox-Ereignisse vor dem Versand gelöscht, Testdaten entfernt.
- [x] **Auto-Deploy repariert (27.09.2026)**: Der Dokploy-Key `github-actions-deploy` hatte die better-auth-Standarddrosselung (10 Aufrufe, Zähler erst nach 24 h ohne Aufruf zurückgesetzt), ab dem 11. Deploy kam 401. Drosselung für den Key in der Dokploy-Datenbank abgeschaltet (einmaliger Zeitplan-Job „dokploy-server“, danach gelöscht). Neue Dokploy-Keys immer mit ausgeschalteter Drosselung anlegen (`user.createApiKey` mit `rateLimitEnabled: false`).
- [x] **Sicherheits-Header wirksam (27.09.2026)**: CSP, HSTS, X-Frame-Options, nosniff, Referrer- und Permissions-Policy fehlten auf allen HTML-Seiten (nginx vererbt `add_header` nicht an Blöcke mit eigenen Headern). Jetzt `docker/security-headers.conf`, in jedem solchen Block eingebunden; elf Seiten ohne CSP-Verstoß geprüft.
- [x] **Kein Doppel-Laden beim Erstbesuch (27.09.2026)**: Der Service Worker lud jede Seite beim ersten Besuch neu (`controllerchange` nach `clients.claim()`), jetzt nur noch beim Versionswechsel.
- [ ] **KüchenWert-Tracking anlegen (Betreiber)**: GA4-Property für kuechenwert24.de und Google-Ads-Conversion „Küchenanfrage“ (Lead-Formular, Zählung „Eine“, Enhanced Conversions an). IDs unter Admin → Tracking eintragen (GA4 Measurement-ID, Ads Conversion-ID, Label bei `KUECHEN_LEAD`) und GA4/Ads einschalten. Meta-Pixel `1846623132710484` auf Zugehörigkeit prüfen. Für die Auswertung in der eigenen DB: finales URL-Suffix mit UTM-Parametern in Google Ads setzen.
- [ ] **Studios für den Test (Betreiber)**: Es sind 0 Studios registriert. Vor dem Test 2–3 Studios in der Testregion gewinnen und die Anzeigen auf diese Region begrenzen, oder Anfragen bewusst selbst vermitteln (Kunden werden sonst nie beliefert).
- [x] **Betreiberin WohnWert GmbH (28.09.2026)**: Impressum, Datenschutz und AGB nennen jetzt wie wohnwert24.de die WohnWert GmbH (Hannoversche Str. 106, 30627 Hannover, HRB 230114 AG Hannover, GF Mona Kareem-Ameen), Impressum mit USt-ID DE462042479 und Angabe nach § 18 Abs. 2 MStV (Migration `20260928094517`). Passt zu `BRAND.legalName` im Footer.
- [x] **AGB neu gefasst (28.09.2026)**: Vermittlungsmodell (kostenlose Anfrage, Weitergabe an Studios, KI-Visualisierung), eigene Konditionen für Studios unter `/konditionen` (P2B-Transparenz), Migration `20260928204008`.
- [ ] **AGB, Konditionen für Studios und Erklärung zur Barrierefreiheit anwaltlich prüfen lassen** (Stand 28.09.2026), vor dem Anzeigenstart. Barrierefreiheit: „teilweise vereinbar“ mit WCAG 2.2 AA ist eine eigene Einschätzung, kein Audit; Verweise auf Marktüberwachung und Schlichtung nach § 16 BGG sowie die mögliche Ausnahme für Kleinstunternehmen (BFSG) prüfen.
- [ ] Provisionsbasis bestätigen: Provision auf den angenommenen Angebotspreis **brutto**, Provisionsbetrag netto zzgl. USt. Datenbank (`calculate_lead_commission_cents`), Konditionen und `/preise` sind einheitlich; bewusst so gewollt?
- [x] Mail-Fußzeile mit Pflichtangaben nach § 35a GmbHG aus `BRAND_LEGAL` (28.09.2026), Mail-Functions neu deployt.
- [ ] **IBAN hinterlegen (Betreiber)**: Admin → Einstellungen → Tab „Rechnung“. Ohne gültige IBAN bleiben Rechnungen Entwürfe (Admin-Mail „invoice_issue_blocked“), Zahlungserinnerung und Mahnlauf greifen erst nach der Ausstellung.
- [ ] Lead-Weiterleitungsadresse (`site_settings.lead_forward_email`, Admin → E-Mail-Center) zeigt auf ein privates iCloud-Postfach; auf eine Geschäftsadresse unter `kuechenwert24.de` umstellen.
- [ ] Datenschutzerklärung anwaltlich prüfen lassen; Auftragsverarbeitung und Drittlandübermittlung bei Resend und fal.ai klären und in Abschnitt 4/5 ergänzen.
- [ ] Click-Wrap-, Einwilligungs- und Transparenztexte in Funnel A (`kw-anfrage-2026-09`) anwaltlich prüfen lassen.
- [x] Funnel A/B/C: send-lead-notification type=funnel + track-conversion (Click-IDs) (21.08.2026)
- [x] sessionGuard: ensureValidRLSSession auf Seller/Dealer-Reads (MyBids, DealerInventory, DealerClaims, MyKuechenJourney, NotificationPreferences, DealerDashboard, ListingEdit) (21.08.2026)
- [x] Query-Keys: ConvertToKitchenDialog + Admin-Delete invalidieren myListings/myLeads/admin-leads (21.08.2026)
- [x] Entfällt (28.09.2026): Google-Review-Pipeline war ein Caravan-Feature, kein Cron mehr vorhanden.
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
  - MEDIUM: Doc-Verify, Rollen-Wechsel (Claims, Termine, Reviews, Auktionen und Kaufchance entfallen mit dem Caravan-Code, 28.09.2026)
  - LOW: Blog-Publish, Commission-Tier-Änderung
- [x] Entfällt (28.09.2026): Bug 2 (motorhomes-RLS) und Bug 4 (appointments-Constraint) betreffen Caravan-Tabellen, die das Frontend nicht mehr nutzt.
- [ ] Bug 7: RESEND_API_KEY in Supabase Edge Function Secrets prüfen/erneuern
- [ ] Blog und Ratgeber: Seiten existieren, 0 Artikel; beide Übersichten stehen auf `noindex`, bis Inhalte da sind (dann in Sitemap und Prerender-Liste aufnehmen).
- [x] Migrations-Edge-Functions stillgelegt bzw. entfernt (28.09.2026)
- [x] Entfällt (28.09.2026): Baujahr-Ranges und Fuzzy-Search gehörten zu den Caravan-Fahrzeugdaten.
- [ ] GA4_API_SECRET erstellen (Google Analytics Admin → Data Streams)
- [ ] Google Ads: LANDING_PAGE_LEAD von Primary auf Secondary umstellen
- [x] Veraltete Unit-Tests entfernt bzw. repariert (28.09.2026): 18 Testdateien, 176 Tests grün; die CI führt alle Tests und ESLint aus.
- [x] Typfehler beseitigt (28.09.2026): Caravan-Altmodule entfernt, `tsc -p tsconfig.app.json` fehlerfrei, strikter Check deckt Admin, Dashboard, Sidebars und zentrale Libs ab.
- [x] Turnstile eingerichtet (27.09.2026), siehe Eintrag „Turnstile aktiv“ oben.
- [ ] Supabase Auth: Leaked-Password-Protection aktivieren (Dashboard)
- [x] `kw-planner-generate` / `kw-planner-submit-lead` und `send-lead-notification` stillgelegt (410, 28.09.2026); endgültiges Löschen siehe Eintrag zu stillgelegten Functions.
- [ ] Planungssoftware: CARAT-Projektimport bzw. CARAT planner als Plattform-Lizenz mit CARAT klären; „DataX“ existiert nicht, Alternativen (K:PLAN, IDM/DCC, Winner Flex) in docs/planning-software-integration.md
