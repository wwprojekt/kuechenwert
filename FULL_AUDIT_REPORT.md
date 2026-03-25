# Kompletter RLS + Edge Functions Audit Report

## A. RLS-Policy-Probleme

### A1. Fehlende DELETE-Policies (BEREITS BEHOBEN)
- error_logs, wizard_sessions, quick_leads, contact_messages, vehicle_questions, auctions, bids, profiles, admin_emails

### A2. Keine weiteren fehlenden Policies gefunden
- Alle Tabellen haben korrekte SELECT, INSERT, UPDATE Policies
- Admin-Checks nutzen konsistent `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')`

---

## B. Edge Function Bugs

### B1. KRITISCH: instant-buy - Doppelte `const supabaseAdmin` Deklaration
- Zeile 40 und 61: `const supabaseAdmin = createClient(...)`
- In Deno/TypeScript ist doppeltes `const` im selben Scope ein Laufzeitfehler
- **Sofortkauf funktioniert möglicherweise gar nicht!**
- FIX: Zweite Deklaration entfernen

### B2. KRITISCH: place-bid - Keine Race Condition Protection
- Liest current_bid, validiert, insertet bid, updated current_bid - alles OHNE Lock/Transaction
- Zwei gleichzeitige Gebote können beide den gleichen current_bid lesen und beide akzeptiert werden
- handle-autobid nutzt korrekt `pg_advisory_xact_lock` via RPC, aber place-bid selbst nicht
- FIX: RPC-Funktion `place_bid_atomic` erstellen mit Advisory Lock

### B3. HOCH: check-expired-auctions - Kein Auth-Check
- Jeder kann diese Function aufrufen und alle aktiven Auktionen schließen
- Wird vom Frontend (AdminAuctions) und vermutlich als Cron aufgerufen
- FIX: Auth-Check hinzufügen (Admin-only oder Service-Key)

### B4. HOCH: generate-ai-description - Kein Auth-Check
- Nur Rate Limiting, kein Auth
- Jeder kann OpenAI API-Kosten verursachen
- FIX: Auth-Check hinzufügen

### B5. MITTEL: inbound-webhook - Webhook Secret optional
- Wenn RESEND_WEBHOOK_SECRET nicht gesetzt ist, wird die Signatur-Verifizierung übersprungen
- `return true; // Allow if secret not configured yet`
- FIX: Prüfen ob Secret gesetzt ist, sonst ablehnen

### B6. MITTEL: generate-handover-pdf - Kein Auth-Check
- Wird nur intern von complete-handover aufgerufen
- Aber theoretisch von außen aufrufbar wenn man die URL kennt
- FIX: Auth-Check oder internes Secret

### B7. NIEDRIG: handle-autobid - Kein Auth-Check
- Wird nur intern von place-bid aufgerufen (fire and forget)
- Nutzt service_role_key intern, aber kein Auth-Check auf dem Endpoint
- FIX: Auth-Check oder internes Secret

### B8. NIEDRIG: verify-appointment-pin - Kein Auth-Check
- Hat eigenes Rate Limiting (5 Versuche, 60 Min Lockout)
- Wird vom Frontend aufgerufen (AdminStationHandover)
- PIN ist 6-stellig = 1M Kombinationen, mit 5 Versuchen pro Stunde sicher genug

### B9. NIEDRIG: Rate Limiter fail-open
- Wenn Redis/KV nicht verfügbar, erlaubt der Rate Limiter alle Anfragen
- Designentscheidung (Availability > Security), aber sollte geloggt werden

---

## C. Prioritäten

1. **B1** (instant-buy doppeltes const) - Sofort fixen, verhindert Sofortkauf
2. **B2** (place-bid Race Condition) - Hoch, kann zu doppelten Geboten führen
3. **B3** (check-expired-auctions Auth) - Hoch, kann Auktionen vorzeitig schließen
4. **B4** (generate-ai-description Auth) - Hoch, Kostenmissbrauch möglich
5. **B5** (inbound-webhook Secret) - Mittel
6. **B6-B9** - Niedrig, interne Functions
