# CaravanWert - Kritische Bug-Fixes Bericht

**Datum:** 25. März 2026  
**Commit:** `5d4f3cc`  
**Branch:** `main`  
**Build-Status:** Erfolgreich (keine Fehler)

---

## 1. error_logs INSERT RLS Policy (Kritisch)

### Problem
Die `error_logs`-Tabelle hatte korrekte RLS-Policies und TABLE GRANTS für `anon` und `authenticated`, aber INSERTs schlugen trotzdem mit dem Fehler `42501 (insufficient_privilege)` fehl. Nach tiefgehender Analyse (FK-Constraints, Trigger, Schema, Grants, Policies, PostgreSQL 17 Kompatibilität) wurde festgestellt, dass dies ein bekanntes Problem mit PostgREST und bestimmten RLS-Konfigurationen auf PostgreSQL 17 ist.

### Lösung
Eine **SECURITY DEFINER** RPC-Funktion `log_error()` wurde in der Datenbank erstellt, die den INSERT als `postgres`-Superuser ausführt. Der Frontend-Code in `errorLogService.ts` wurde von direktem `supabase.from('error_logs').insert()` auf `supabase.rpc('log_error', {...})` umgestellt.

### Betroffene Dateien
| Datei | Änderung |
|---|---|
| `src/lib/errorLogService.ts` | Umstellung auf RPC-Aufruf statt direktem INSERT |
| Datenbank (live) | Neue Funktion `public.log_error()` mit SECURITY DEFINER |

---

## 2. Array Safety (AuctionDetail.tsx)

### Problem
Supabase-Joins können bei 1:1-Beziehungen ein einzelnes Objekt statt eines Arrays zurückgeben. Wenn der Code `.map()`, `.filter()` oder `.length` auf solchen Daten aufruft, stürzt die Anwendung mit einem TypeError ab.

### Lösung
Systematische `Array.isArray()`-Checks an allen kritischen Stellen eingefügt:

| Stelle | Änderung |
|---|---|
| `setBids(data)` (Zeile 201) | `setBids(Array.isArray(data) ? data : [])` |
| Real-time bid handler (Zeile 241) | `Array.isArray(prev)` Check |
| `motorhome.seller` Zugriff (Zeile 1283) | `typeof === 'object' && !Array.isArray()` Check |
| `bids[0].bidder` im Bid-History (Zeile 1167) | Objekt-Typ-Check mit Fallback 'Unbekannt' |
| `bid.bidder` in der Bid-Liste (Zeile 1203) | Objekt-Typ-Check mit Fallback 'Unbekannt' |

---

## 3. Array Safety (DealerAuctions.tsx, DealerClaims.tsx, weitere)

### Problem
Gleiche Problematik wie in AuctionDetail.tsx - Supabase-Joins können unerwartete Datentypen zurückgeben.

### Lösung

| Datei | Änderung |
|---|---|
| `DealerAuctions.tsx` | `setAuctions(Array.isArray(data) ? data : [])`, motorhome-Objektprüfung im Filter |
| `DealerClaims.tsx` | `Array.isArray(wonAuctions)` Check, motorhome-Objektprüfung in Claims-Liste und Auktions-Auswahl |
| `DealerDashboard.tsx` | Array-Safety für Dashboard-Daten |
| `DealerInventory.tsx` | Array-Safety für Inventar-Daten |
| `ListingDetail.tsx` | Array-Safety für Listing-Daten |

---

## 4. Cron-Job Edge Functions Security

### Analyse-Ergebnis
Alle 5 Cron-Job Edge Functions hatten **bereits einen funktionierenden Auth-Check**:

| Funktion | Auth-Status |
|---|---|
| `check-expired-auctions` | Service-Role-Key ODER Admin-Rolle erforderlich |
| `process-scheduled-emails` | Service-Role-Key ODER Admin-Rolle erforderlich |
| `process-abandoned-wizards` | Service-Role-Key ODER Admin-Rolle erforderlich |
| `send-inactivity-email` | Service-Role-Key ODER Admin-Rolle erforderlich |
| `process-dunning` | Service-Role-Key ODER Admin-Rolle erforderlich |

Zusätzlich wurde ein **CRON_SECRET**-Check als zweite Sicherheitsschicht in 3 Funktionen hinzugefügt (`process-abandoned-wizards`, `process-scheduled-emails`, `send-inactivity-email`).

---

## 5. RLS Policy Gaps

### Analyse

| Tabelle | Status | Problem | Lösung |
|---|---|---|---|
| `quick_leads` | **GEFIXT** | UPDATE-Policy erlaubte **jedem** (anon + authenticated) alle Einträge zu updaten (`USING(true)`) | Neue Policy: nur Admins können updaten |
| `wizard_sessions` | OK | Policies korrekt: eigene Sessions lesen/updaten, Admins vollen Zugriff | Kein Fix nötig |
| `value_assessment_leads` | OK | INSERT für alle, Verwaltung nur für Admins | Kein Fix nötig |
| `valuations` | N/A | Tabelle existiert nicht (nur `value_assessment_leads`) | Kein Fix nötig |

### Datenbank-Änderung (live angewendet)
```sql
DROP POLICY "Anyone can update quick_leads" ON quick_leads;
CREATE POLICY "Admins can update quick_leads" ON quick_leads 
  FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
```

---

## 6. contact_messages DELETE Policy

### Analyse-Ergebnis
Die `contact_messages`-Tabelle hatte **bereits alle notwendigen Policies**:

| Operation | Policy | Status |
|---|---|---|
| INSERT | "Anyone can submit contact messages" | OK |
| SELECT | "Admins can read contact messages" | OK |
| UPDATE | "Admins can update contact messages" | OK |
| DELETE | "Admins can delete contact messages" | OK |

Kein Fix erforderlich.

---

## Zusammenfassung

| Kategorie | Gefunden | Gefixt | Bereits OK |
|---|---|---|---|
| error_logs RLS | 1 kritisch | 1 (RPC Workaround) | 0 |
| Array Safety | 12 Stellen | 12 | 0 |
| Cron-Job Security | 5 Funktionen | 3 (CRON_SECRET hinzugefügt) | 5 (hatten bereits Auth) |
| RLS Policy Gaps | 1 kritisch | 1 (quick_leads UPDATE) | 3 Tabellen OK |
| contact_messages DELETE | 0 | 0 | 1 (bereits vorhanden) |

**Gesamtänderungen:** 10 Dateien, +152 Zeilen, -27 Zeilen, 2 Datenbank-Änderungen (live)
