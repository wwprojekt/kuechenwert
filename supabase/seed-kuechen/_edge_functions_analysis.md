# Edge Functions – Leseanalyse (Caravanwert → KüchenWert)

**Stand:** Projekt `kuechenwert-v2`, Pfad `supabase/functions/`
**Umfang:** **90** deploybare Funktionen (Ordner ohne `_shared`); Haupteintrag jeweils `index.ts`.
**Scope:** TS-Dateien, Kategorisierung, Abhängigkeiten, Caravan-Seed.

---

## Gesamt-Zählungen pro Kategorie

| Kategorie | Anzahl |
|-----------|--------|
| admin | 10 |
| analytics | 1 |
| marketing | 4 |
| business-auctions | 12 |
| business-dealers | 7 |
| business-payments | 11 |
| business-motorhomes | 9 |
| business-appointments | 9 |
| business-claims | 0 |
| comms-email | 22 |
| comms-push | 1 |
| content | 1 |
| cron | 1 |
| utility | 2 |
| unknown | 0 |
| **Summe** | **90** |

**`caravan-seed-count` (enthält hart verdrahtete RV-/Wohnmobil-Logik):** **25** von 90.

**Externe Dependencies (Kürzel in den Tabellen):**

- `R` = Resend
- `DB` = Supabase DB
- `ST` = Supabase Storage
- `OAI` = OpenAI
- `G` = Google Ads API/OAuth
- `B` = Bing Ads
- `GA4` = GA4 Measurement Protocol
- `CR` = Cron/Batch-Aufruf typisch
- `invoke` = ruft weitere Edge Functions auf

**Nicht gefunden:** `stripe`, `anthropic`, geocoding.

---

## Tabellen nach Kategorie

### admin (10)

| Function | Zusammenfassung | Deps | CaravanSeed? |
|----------|-----------------|------|--------------|
| admin-correct-sale | Korrigiert Verkaufs-/Beleg-Artefakte inkl. Storage-Bereinigung | DB, ST | N |
| admin-create-user | Legt Nutzer/Profile an (Admin) | DB | N |
| admin-delete-bid | Löscht Gebot (Admin) | DB | N |
| admin-delete-dealer-application | Löscht Händlerbewerbung, Resend-Mail | DB, R | N |
| admin-delete-user | Löscht Nutzerdaten (Admin) | DB | N |
| admin-migrate-storage-object | Einzelobjekt zwischen Storage-Pfaden migrieren | DB, ST | N |
| admin-repair-sale-artefacts | Reparatur-Skript für Verkaufs-Artefakte | DB | N |
| admin-sell-to-dealer | Admin-Workflow Verkauf an Händler | DB, invoke | N |
| admin-suspend-user | Sperrt Nutzer (Admin) | DB | N |
| get-recipient-count | Zählt Empfänger für Broadcasts (Admin) | DB | N |

### analytics (1)

| Function | Zusammenfassung | Deps | CaravanSeed? |
|----------|-----------------|------|--------------|
| wizard-telemetry | Schreibt Wizard-Funnel-Events in `wizard_step_events` (rate-limited) | DB | N |

### marketing (4)

| Function | Zusammenfassung | Deps | CaravanSeed? |
|----------|-----------------|------|--------------|
| track-conversion | Server-Side GA4 + GCLID/Enhanced Conversions + GAds API | DB, GA4, G | N |
| gads-diagnostic | Diagnose Google Ads API (OAuth, SearchStream) | G | N |
| bing-ads-campaign-fix | Bing/Microsoft Advertising Kampagnen/Negatives/UTM | B | N |
| send-existing-listings-opt-in | Opt-in-Kampagne für bestehende Listings | DB, R, invoke | Y (Listings=Fahrzeug) |

### business-auctions (12)

| Function | Zusammenfassung | Deps | CaravanSeed? |
|----------|-----------------|------|--------------|
| accept-kaufchance-offer | Übernimmt Kaufchance/Nachverhandlung | DB, ST, invoke | N |
| cancel-auction-as-admin | Bricht Auktion adminseitig ab | DB | N |
| check-expired-auctions | Cron: beendet abgelaufene Auktionen | DB, CR, invoke | N |
| close-auction | Kern: Auktion schließen, Verträge/Rechnungen, GAds/Bing Conversions | DB, R, ST, G, B, invoke | N |
| end-kaufchance | Beendet Kaufchance-Fenster inkl. Resend | DB, R | N |
| handle-autobid | Verarbeitet Autogebote | DB | N |
| instant-buy | Sofortkauf-Flow mit Invokes/Benachrichtigungen | DB, invoke | N |
| notify-offer-action | E-Mails für Kaufchance/Nachauktions-Angebote | DB, R | N |
| notify-auction-winner | Benachrichtigt Gewinner nach Auktion | DB, R | N |
| notify-admin-missing-reserve | Admin-Hinweis wenn Reserve nicht erreicht | DB, R | N |
| place-bid | Platziert Gebot; Push/E-Mail; `motorhomes` für Text | DB, R, invoke | N |
| request-price-change | Preisänderungs-Workflow | DB | N |

### business-dealers (7)

| Function | Zusammenfassung | Deps | CaravanSeed? |
|----------|-----------------|------|--------------|
| register-dealer | Händler-Registrierung | DB | N |
| request-dealer-documents | Fordert Dokumente vom Händler an | DB, R | N |
| dealer-document-upload | Upload-Flow für Händlerdokumente | DB | N |
| get-dealer-auth-status | Auth/Onboarding-Status für Händlerportal | DB | N |
| send-dealer-notification | Bewerbung/Einladung; Joins auf `motorhomes`/Auktionen | DB, R | Y |
| send-dealer-auction-digest | Digest-Mail für Händler zu Auktionen | DB, R | N |
| send-inactivity-email | Reaktivierung Händler (Auktionen/Fahrzeugcopy) | DB, R | Y |

### business-payments (11)

Stripe ist **nicht** im Einsatz — reine SEPA/Rechnungs-Logik.

| Function | Zusammenfassung | Deps | CaravanSeed? |
|----------|-----------------|------|--------------|
| generate-invoice-pdf | Rechnungs-PDF | DB, ST | N |
| send-invoice-email | Rechnungs-Mail | DB, R | N |
| process-dunning | Mahnwesen (Cron) | DB, R, CR | N |
| send-payment-reminder | Zahlungserinnerung | DB, R | N |
| process-sepa-mandate | SEPA-Mandatsverarbeitung | DB | N |
| generate-sepa-mandate-pdf | SEPA-PDF | DB, ST | N |
| send-sepa-mandate-email | SEPA-Mandat-Mail | DB, R | N |
| recalculate-commission | Provisionsrechner | DB | N |
| apply-commission-tier-change | Provisionsstufen-Änderungen | DB | N |
| send-commission-statement | Provisions-Abrechnungs-Mail | DB, R | N |
| send-payment-confirmation | Zahlungs-Bestätigung | DB, R | N |

### business-motorhomes (9) — **komplett caravan-specific**

| Function | Zusammenfassung | Deps | CaravanSeed? |
|----------|-----------------|------|--------------|
| ai-valuation | KI-Wohnmobil-/Wohnwagen-Bewertung; Body-Type-Map; Markt-Comps; Turnstile | DB, OAI | **Y** |
| generate-ai-description | GPT-Verkaufstext (RV-Features, Solar etc.) | DB, OAI | **Y** |
| auto-convert-wizard | Wizard → `motorhomes`-Spalten inkl. PS/Verbrauch/Stellplatz | DB, ST | **Y** |
| process-photo | WebP-Varianten für `motorhome_photos` | DB, ST | **Y** |
| resize-photo-variants | JPEG-Varianten (Legacy; Cron) | DB, ST, CR | **Y** |
| fix-heic-photos | HEIC→JPEG Reparatur im motorhome-Bucket | DB, ST | **Y** |
| upload-wizard-photos | Upload aus Wizard in Storage | DB, ST | **Y** |
| send-expert-valuation | E-Mail Expertenbewertung | DB, R | **Y** |
| send-lead-notification | Lead-Mail inkl. Body-Type-Label-Map | DB, R | **Y** |

### business-appointments (9)

| Function | Zusammenfassung | Deps | CaravanSeed? |
|----------|-----------------|------|--------------|
| generate-appointment-pin | PIN für Ankaufstation/Termin | DB | N |
| verify-appointment-pin | PIN prüfen | DB | N |
| send-appointment-confirmation | Terminbestätigung | DB, R | N |
| send-appointment-reminder | Terminerinnerung | DB, R | N |
| send-purchase-inquiry-notification | Anfrage Kaufstation + Fahrzeugtyp-Felder | DB, R | **Y** |
| complete-handover | schließt Übergabe ab, `motorhomes` verkauft | DB, R | **Y** |
| generate-handover-pdf | PDF Übergabe | DB, ST | N |
| generate-blank-handover-protocol | Blanko-Übergabeprotokoll-PDF (Wohnmobil-Text) | DB, ST | **Y** |
| resend-blank-handover-protocol | erneuter Versand Blanko-Protokoll | DB, R | N |

### business-claims (0)

Keine Functions in dieser Kategorie.

### comms-email (22)

Inkl. `send-registration-invite`, inbound-webhook, broadcast-mails, wizard-resume, auction-mailer, disposition, welcome, wrong-number, admin-generic, notify-vehicle-question, etc. Die meisten sind dünne Template-Runners mit Resend, oft mit DB-Joins auf Caravan-Entitäten — nach dem Rename oft `rename-only`.

### comms-push (1)

| send-push-notification | Web-Push (VAPID) an Subscriptions | DB | N |

### content (1)

| sitemap | XML-Sitemap inkl. fester `/wohnmobil-*`-URLs und Marken-Pfade (Hymer/Knaus/…) | DB | **Y** |

### cron (1)

| process-abandoned-wizards | Cron: 2 Recovery-Mails für abgebrochene Wizard-Sessions | DB, R, CR | **Y** (Copy ist Caravan) |

### utility (2)

| log-error | Frontend-Fehler in `error_logs` | DB | N |
| fetch-attachment-url | Signierte Attachment-URLs | DB, ST | N |

---

## Handlungsempfehlungen

1. **`keep-as-is` (technisch generisch):**
   `log-error`, `fetch-attachment-url`, `inbound-webhook`, `check-email-delivery`, `get-recipient-count`, `send-push-notification`, `track-conversion`, `gads-diagnostic`, `bing-ads-campaign-fix`, fast das gesamte `admin-*`-Cluster, die **business-payments**-Functions (SEPA/Rechnung sind generisch).
   → Nur Secrets, URLs und Marketing-IDs für die Küchen-Marke anpassen.

2. **`rename-only` (Schemas/URLs, wenig Logik):**
   Fast alle `comms-email`-Functions, wenn die DB-Rename-Migration `motorhomes` → `kitchens` etc. erledigt ist. **`place-bid`**, **`notify-offer-action`**, **`close-auction`**, **`instant-buy`**, **`check-expired-auctions`** — das Auktionsmodell wird 1:1 übernommen.

3. **`rewrite` (Domäne muss neu):**
   `ai-valuation`, `generate-ai-description`, `auto-convert-wizard`, `send-lead-notification`, `send-expert-valuation`, `send-purchase-inquiry-notification`, `complete-handover`, `generate-blank-handover-protocol`.
   Inhaltlich ist das an Fahrzeug-Body-Types, PS/Gewicht/Länge, Solar/Aufbau etc. gebunden — Küchen haben komplett andere Attribute (Marke, Front, Arbeitsplatte, Geräte, Maße).

4. **`delete` / ersetzen:**
   `sitemap` (hardcoded `/wohnmobil-*`-URLs & Marken-Pfade → neu mit Küchen-SEO schreiben). Foto-Pipeline-Functions (`process-photo`, `resize-photo-variants`, `fix-heic-photos`, `upload-wizard-photos`) lassen sich generalisieren, wenn der Bucket von `motorhome_photos` auf `kitchen_photos` umbenannt wird — dann ist es eher `rename-only` als Delete.

5. **`process-abandoned-wizards`:** Copy neu schreiben (Betreffzeile/Body erwähnt "Wohnmobil"), technisch unverändert.

---

## Rename-Priorität (nach Aufwand)

| Aufwand | Funktionen-Gruppen |
|---------|--------------------|
| **Niedrig** | admin (10), analytics (1), comms-email (22), comms-push (1), utility (2), marketing (3) → **~39 Functions** nur Text/URL |
| **Mittel** | business-auctions (12), business-dealers (7), business-payments (11), business-appointments (5 von 9) → **~35 Functions** brauchen rename-Migration-Referenzen |
| **Hoch (rewrite)** | business-motorhomes (9), business-appointments (4: purchase-inquiry, handover), sitemap, process-abandoned-wizards → **~15 Functions** |

---

*Erstellt rein lesend; keine Repo-Änderungen.*
