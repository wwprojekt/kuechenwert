# CaravanWert Plattform - Umfassender Bug-Audit Report
Datum: 07. April 2026
Erstellt von: Manus AI

## 1. Kritische Bugs (Live-System Beeinträchtigungen)

### 1.1 Edge Functions mit alten/falschen Spaltenreferenzen
Zwei kritische Edge Functions in der **Live-Umgebung (Deployed)** verursachen aktuell `500 Internal Server Error`, da sie auf nicht mehr existierende Datenbankspalten zugreifen. Im Git-Repository sind diese Fehler bereits behoben, aber die korrekten Versionen wurden noch nicht zu Supabase deployed.

*   **`send-auction-summary`**: Referenziert `auctions.current_price` statt `auctions.current_bid`.
*   **`send-payment-reminder`**: Referenziert `invoices.amount` statt `invoices.gross_amount`.

**Handlungsempfehlung:** Diese beiden Edge Functions müssen dringend über die Supabase CLI in die Produktionsumgebung deployed werden. Ein Deployment über das Supabase Dashboard ist aufgrund eines UI-Fehlers (Token-Generierung reagiert nicht) aktuell nicht möglich.

### 1.2 Fehlerhafte Cron-Job Authentifizierung
Der Cron-Job `check-expired-auctions` (definiert in Migration `20260325000001`) verwendet fälschlicherweise den `ANON_KEY` anstelle des `SERVICE_ROLE_KEY`. Da die Edge Function `check-expired-auctions` explizit Admin- oder Service-Role-Rechte erfordert, schlägt der Cron-Job konsequent mit einem `401 Unauthorized` Fehler fehl.

**Handlungsempfehlung:** Die bereits erstellte Migration `20260407100000_fix_cron_jobs_auth.sql` (welche die Authentifizierung auf den Vault-basierten Service-Role-Key umstellt) muss auf die Produktionsdatenbank angewendet werden.

---

## 2. Potentielle Bugs & Architektur-Probleme

### 2.1 Veraltete TypeScript-Typen (`types.ts`)
Die Datei `src/integrations/supabase/types.ts` ist nicht synchron mit dem tatsächlichen Datenbankschema. Mehrere kritische Tabellen, die in Edge Functions und Migrationen referenziert werden, fehlen in den Typdefinitionen:
*   `admin_emails`
*   `audit_logs`
*   `branding`
*   `email_templates`
*   `purchase_contracts`

**Risiko:** Dies führt zu fehlender Typ-Sicherheit im Frontend und kann Runtime-Fehler verursachen, wenn auf diese Tabellen zugegriffen wird.
**Handlungsempfehlung:** Die Supabase-Typen müssen mit dem Befehl `supabase gen types typescript --project-id zcrwqxsyptjwkuxfacvq > src/integrations/supabase/types.ts` neu generiert werden.

### 2.2 Unsichere Cron-Job Konfigurationen
Mehrere E-Mail-Automatisierungs-Cron-Jobs (definiert in `20260322000004_email_automation_crons.sql`) verwenden die Funktion `current_setting('app.settings.service_role_key', true)` zur Authentifizierung.
**Risiko:** Supabase setzt diese Einstellung *nicht* automatisch. Wenn diese Variable nicht manuell im Supabase Dashboard unter den Datenbank-Einstellungen konfiguriert wurde, schlagen alle diese Cron-Jobs (z.B. `send-inactivity-emails`, `send-payment-reminders`) fehl.
**Handlungsempfehlung:** Alle Cron-Jobs sollten auf die sicherere Vault-basierte Methode umgestellt werden, wie sie in der neuesten Migration `20260407100000` für `check-expired-auctions` implementiert wurde: `(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)`.

### 2.3 Fehlende Frontend-Routen
Die Route `/auktionen` wird zwar nicht direkt im Frontend verlinkt (dort wird `/kaufen` verwendet), existiert aber als 404-Seite, falls Benutzer sie direkt aufrufen.
**Handlungsempfehlung:** Eine Weiterleitung (Redirect) von `/auktionen` zu `/kaufen` sollte in der `App.tsx` eingerichtet werden, um 404-Fehler für Lesezeichen oder alte Links zu vermeiden.

### 2.4 Potentielle Runtime-Fehler im Frontend
Es gibt 157 Instanzen, in denen Arrays ohne Optional Chaining (`?.`) verarbeitet werden (z.B. `.map()`, `.filter()`).
**Risiko:** Wenn API-Antworten verzögert sind oder `null` zurückgeben, kann dies zu "Cannot read properties of undefined" Abstürzen führen.
**Handlungsempfehlung:** Ein systematisches Refactoring sollte durchgeführt werden, um Optional Chaining bei allen Array-Operationen auf API-Daten einzuführen (z.B. `data?.map(...)`).

---

## 3. Zusammenfassung der durchgeführten Prüfungen

*   **Edge Functions:** Alle 40+ Edge Functions wurden auf falsche Spaltenreferenzen (`current_price`, `starting_price`, `amount`, `buyer_id`) geprüft.
*   **Datenbankschema:** Abgleich der Migrationen mit den generierten Typen (`types.ts`).
*   **RLS Policies:** Prüfung auf unsichere Policies (Die gefundenen `USING (true)` Policies beschränken sich auf unkritische `SELECT` Operationen für öffentliche Daten).
*   **Frontend:** Analyse der Routen, Sitemap und potenzieller Runtime-Fehler.
*   **Live-Tests:** API-Aufrufe an die deployed Edge Functions zur Verifizierung der Fehler.

## 4. Nächste Schritte

1.  Lokales Deployment der Edge Functions `send-auction-summary` und `send-payment-reminder` via Supabase CLI.
2.  Anwenden der ausstehenden Migrationen (`20260407000000_fix_invoice_commission_bugs.sql` und `20260407100000_fix_cron_jobs_auth.sql`).
3.  Neu-Generierung der `types.ts`.
4.  Überarbeitung der restlichen Cron-Jobs auf die Vault-basierte Authentifizierung.
