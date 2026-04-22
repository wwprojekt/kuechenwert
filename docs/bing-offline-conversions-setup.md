# Bing Ads Offline Conversions API – Setup-Anleitung (Phase 2)

## Worum geht's?

Wir laden ab sofort **bestätigte Verkäufe serverseitig** an Microsoft Advertising
hoch — analog zur Google Ads Offline Conversion API, die wir seit Wochen live
haben. Damit lernt Microsoft Smart Bidding nicht nur aus Lead-Pixel-Events
("Wizard abgeschlossen", siehe Phase 1), sondern aus dem echten Sale-Outcome
mit echtem Commission-Wert in Euro.

**Status:** ✅ **LIVE seit 2026-04-22.** Alle 7 Secrets gesetzt, OAuth-Token-Rotation
in DB persistent, End-to-End Smoke-Test bestanden (HTTP 200 von Bing API). Die
Pipeline ist scharf — der erste Verkauf nach Ablauf der Microsoft-2-Stunden-
Goal-Maturity (siehe Smoke-Test-Output) wird automatisch hochgeladen.

## Refresh-Token-Rotation (KRITISCH)

Microsoft rotiert den OAuth-Refresh-Token **bei jedem einzelnen Refresh**. Wenn
wir den Token nur in Env-Vars hielten, würde die Edge Function exakt **einmal**
funktionieren und danach 401 für alle Ewigkeit liefern.

**Lösung:** Tabelle `public.bing_oauth_state` (1 Zeile, RLS auf `service_role`)
als persistenter Token-Store. Helper `_shared/bing-oauth-token.ts`:
1. Lädt aktuellen Refresh-Token aus DB (Fallback: env-var beim allerersten Call).
2. Wenn der gecachte Access-Token noch >5 min gültig ist → Cache-Hit, kein API-Call.
3. Sonst: ruft `/token` auf, persistiert den **neuen** Refresh-Token + Access-Token
   atomar zurück in `bing_oauth_state` BEVOR die eigentliche Bing-API-Call läuft.

So skaliert die Function auf 1000+ Aufrufe/Tag ohne menschlichen Eingriff.

## Race-Safety bei parallelen Sales (KRITISCH)

Bei `check-expired-auctions` (cron jede Minute) oder einem dichten Verkaufsmoment
können zwei `close-auction`-Calls fast gleichzeitig laufen. Wenn beide den
Cache-Miss treffen und parallel den `/token`-Endpoint hitten, würde der erste
einen neuen Refresh-Token bekommen und den alten invalidieren — der zweite
würde mit dem inzwischen invalidierten Token einen 400 bekommen UND (im
ursprünglichen Code) den frisch rotierten Token in der DB überschreiben. Damit
wäre die Pipeline nach EINEM verlorenen Race permanent tot.

**Lösung — zwei Layer:**

1. **Lease-Lock (`lock_holder_until` + RPC `bing_oauth_try_acquire_lock`):**
   Atomarer CAS-Update. Wer den Lock holt, refresht. Wer ihn nicht bekommt,
   pollt 12s lang die DB (250 ms Intervall), bis der Winner den frischen
   Access-Token reingeschrieben hat — und gibt dann diesen Cache zurück.
   Lock-TTL: 30s. Falls die Function crasht, bevor sie released, läuft der
   Lock automatisch ab und der nächste Worker übernimmt.
2. **Niemals den Refresh-Token im Error-Path überschreiben.** Falls ein
   Race trotzdem entsteht (z. B. weil `bing_oauth_try_acquire_lock` aus
   irgendeinem Grund failed), schreibt der Loser nur seine `last_error`-Felder
   — der gerotierte Refresh-Token des Winners bleibt unangetastet.

Verifizierte Lock-Semantik (siehe SQL-Smoketest):
- `try_acquire(...)` 1× → `true`, lock_holder_until = now() + 30s
- `try_acquire(...)` 2× direkt danach → `false` (Lock noch gehalten)
- `release_lock(...)` → lock_holder_until = NULL
- Nach 30s: lock_holder_until liegt in der Vergangenheit, nächster `try_acquire` → `true`

## Architektur

```
SOLD-Event in Edge Function (close-auction / instant-buy /
                              accept-kaufchance-offer / admin-sell-to-dealer)
        │
        ├──→ uploadSaleConversionToGoogleAds()    [LIVE seit Wochen]
        │
        └──→ uploadSaleConversionToBingAds()      [NEU, no-op bis Setup]
              │
              ├─ Pre-Flight: msclkid? secrets? alter Click? schon hochgeladen?
              ├─ OAuth-Token-Refresh
              ├─ POST → Bing ApplyOfflineConversions REST v13
              └─ Log Erfolg/Fehler in `bing_offline_conversions_log`
```

## Setup-Schritte

### 1. Developer Token (5 min)

Microsoft Advertising vergibt jedem Konto kostenlos einen
"Universal Developer Token", mit dem du sofort gegen die Production-API
arbeiten kannst.

1. Gehe zu https://developers.ads.microsoft.com/Account
2. Logge dich mit deinem Microsoft-Advertising-Konto ein.
3. Klicke "Get a developer token" → der Token wird sofort angezeigt.
4. Notiere dir den Token. Das ist dein **`BING_DEVELOPER_TOKEN`**.

### 2. Microsoft Entra (Azure AD) App-Registrierung (10 min)

Du brauchst eine OAuth-App, damit unser Server sich im Namen deines Bing-Kontos
authentifizieren kann.

1. Gehe zu https://portal.azure.com → "Microsoft Entra ID" → "App registrations"
2. "New registration":
   - **Name:** `caravanwert-bing-conversions`
   - **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI:** Web → `https://login.microsoftonline.com/common/oauth2/nativeclient`
   - "Register"
3. Auf der App-Übersicht:
   - **Application (client) ID** → das ist dein **`BING_OAUTH_CLIENT_ID`**
4. "Certificates & secrets" → "New client secret":
   - **Description:** `caravanwert-server`
   - **Expires:** 24 months (Maximum)
   - "Add"
   - Kopiere den **Wert** (nicht die ID!) → das ist dein **`BING_OAUTH_CLIENT_SECRET`**
   - ⚠️ Wert wird nur einmal angezeigt!
5. "API permissions" → "Add a permission":
   - "APIs my organization uses" → suche `Microsoft Advertising`
   - "Delegated permissions" → wähle `ads.manage`
   - "Add permissions"

### 3. Refresh Token via Browser-Flow (5 min)

Wir brauchen einen einmaligen Authorization-Code-Flow, um einen Refresh Token
zu bekommen, mit dem unser Server dauerhaft Access Tokens generieren kann.

**Schritt 3a: Authorization Code holen**

Öffne diese URL im Browser (`{CLIENT_ID}` durch deinen Wert aus Schritt 2.3
ersetzen):

```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?
  client_id={CLIENT_ID}&
  response_type=code&
  redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient&
  scope=https://ads.microsoft.com/msads.manage%20offline_access&
  state=caravanwert
```

(URL muss in einer Zeile sein, hier nur lesbar gemacht.)

→ Login → Berechtigungen erteilen.
→ Du landest auf einer leeren Seite mit einer URL wie
   `https://login.microsoftonline.com/.../oauth2/nativeclient?code=M.C5...&state=caravanwert`
→ Kopiere den `code`-Parameter aus der URL.

**Schritt 3b: Code gegen Refresh Token tauschen**

In PowerShell (oder Terminal):

```powershell
$body = @{
  client_id     = "DEIN_CLIENT_ID"
  client_secret = "DEIN_CLIENT_SECRET"
  code          = "DER_CODE_AUS_3a"
  redirect_uri  = "https://login.microsoftonline.com/common/oauth2/nativeclient"
  grant_type    = "authorization_code"
  scope         = "https://ads.microsoft.com/msads.manage offline_access"
}
Invoke-RestMethod -Method POST `
  -Uri "https://login.microsoftonline.com/common/oauth2/v2.0/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body $body
```

→ Response enthält `refresh_token`. Notieren als **`BING_OAUTH_REFRESH_TOKEN`**.

⚠️ Code aus 3a ist nur **5 Minuten** gültig — also 3a und 3b zügig hintereinander
machen. Falls Code abgelaufen, einfach 3a wiederholen.

### 4. Customer ID + Customer Account ID (2 min)

1. Logge dich ein in https://ads.microsoft.com
2. Klicke oben rechts auf das Profil-Icon.
3. **Customer ID** = "Konto-Nummer" (zwischen 8 und 10 Ziffern)
   → das ist dein **`BING_CUSTOMER_ID`**
4. Klicke auf den Konto-Namen → URL enthält `accountId=` → das ist dein
   **`BING_CUSTOMER_ACCOUNT_ID`**

### 5. Offline Conversion Goal in Microsoft Advertising anlegen (5 min)

Das ist das Goal, an das die Server-API meldet. **Nicht** mit den 9 UET-Pixel-
Goals aus Phase 1 verwechseln — das hier ist ein **separater** Goal-Typ.

1. https://ads.microsoft.com → "Tools" (oben) → "Conversion-Tracking" → "Conversionziele"
2. "Conversionziel erstellen" → **"Offline-Conversion"** auswählen (NICHT
   "Webseite" und NICHT "App").
3. Konfiguration:
   - **Name:** `Sale_Sold_Vehicle` (genau so, exakter Match nötig!)
   - **Kategorie:** "Kaufen"
   - **Conversion-Wert:** "Andere und gleiche Werte für jede Conversion verwenden"
     → Wert leer lassen (wir senden den echten Commission-Betrag pro Conversion)
   - **Anzahl:** "Eindeutig" (eine Conversion pro Klick)
   - **Conversion-Fenster:** 90 Tage (Maximum)
   - **In Conversions einschließen:** ✅ JA (das ist das wichtige Sale-Goal!)
4. "Speichern"
5. **2 Stunden warten** — Microsoft braucht das, sonst verwirft die API alle
   Uploads mit Fehler `OfflineConversionGoalNotFound`.

### 6. Edge Function Secrets in Supabase setzen

Sobald alles aus 1–5 erledigt ist, gehe in das Supabase-Dashboard:

`Project Settings → Edge Functions → Secrets`

Füge diese 7 Secrets hinzu:

| Secret-Name | Wert | Quelle |
|---|---|---|
| `BING_DEVELOPER_TOKEN` | Token aus Schritt 1 | developers.ads.microsoft.com |
| `BING_OAUTH_CLIENT_ID` | Application (client) ID | Schritt 2.3 |
| `BING_OAUTH_CLIENT_SECRET` | Secret-**Wert** | Schritt 2.4 |
| `BING_OAUTH_REFRESH_TOKEN` | refresh_token | Schritt 3b |
| `BING_CUSTOMER_ID` | Konto-Nummer | Schritt 4.3 |
| `BING_CUSTOMER_ACCOUNT_ID` | accountId aus URL | Schritt 4.4 |
| `BING_OFFLINE_CONVERSION_GOAL_NAME` | `Sale_Sold_Vehicle` | Schritt 5.3 |

**Sobald gespeichert → Phase 2 ist live.** Kein Re-Deploy der Edge Functions
nötig — die lesen die Secrets bei jedem Aufruf neu.

## Verifikation

### Sofort nach Setup

Trigger eine Test-Conversion über `admin-sell-to-dealer` mit einem Motorhome,
das eine `msclkid` hat (du kannst eine künstlich in der DB setzen für Test):

```sql
-- Test-msclkid auf einem Test-Motorhome setzen
UPDATE motorhomes
SET msclkid = 'test_' || gen_random_uuid()::text
WHERE id = '<test-motorhome-id>';
```

Dann den Verkauf auslösen. Im Edge-Function-Log siehst du eine Zeile:
```
[bing-sale][admin-sell-to-dealer] Bing sale upload: HTTP 200 (commission €X.XX of sale €Y, motorhome ZZZ)
```

Und die Log-Tabelle füllt sich:
```sql
SELECT motorhome_id, status, http_status, conversion_value, error_message, uploaded_at
FROM bing_offline_conversions_log
ORDER BY uploaded_at DESC
LIMIT 10;
```

### 6 Stunden nach Setup

In Microsoft Advertising → "Conversions" siehst du die ersten echten
Conversions unter dem Goal `Sale_Sold_Vehicle`. Vorher sind sie zwar
hochgeladen, aber noch nicht in der UI sichtbar (MS-Doku: "It can take up to
six hours to view conversion data").

### Monitoring

```sql
-- Letzten 24h: was haben wir hochgeladen?
SELECT status, COUNT(*) AS n, SUM(conversion_value) AS total_eur
FROM bing_offline_conversions_log
WHERE uploaded_at > now() - interval '24 hours'
GROUP BY status
ORDER BY n DESC;
```

```sql
-- Aktuelle Fehler anschauen
SELECT source, http_status, error_message, uploaded_at
FROM bing_offline_conversions_log
WHERE status IN ('http_error', 'partial_failure', 'exception')
  AND uploaded_at > now() - interval '7 days'
ORDER BY uploaded_at DESC;
```

## Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| Log-Tabelle leer trotz Verkäufen | `BING_*` Secrets fehlen → Code skipt | Schritt 6 prüfen |
| `status = 'exception', error_message LIKE 'oauth_refresh%'` | Refresh Token expired oder Client Secret falsch | Schritt 2.4 + 3 wiederholen |
| `status = 'partial_failure', error_message LIKE '%OfflineConversionGoalNotFound%'` | Goal-Name in Secrets weicht vom UI-Goal-Namen ab, oder 2-Stunden-Wartefrist nicht eingehalten | Schritt 5 prüfen, exakten Match sicherstellen |
| `status = 'partial_failure', error_message LIKE '%MicrosoftClickIdInvalid%'` | msclkid auf motorhome wurde fehlerhaft erfasst | clickIdService.ts Logik prüfen |
| `status = 'skipped', skipped = 'click_too_old'` | Motorhome > 90 Tage alt → erwartetes Verhalten | Kein Fehler, kein Fix nötig |
| `status = 'success' aber Conversion erscheint nicht in MS-Ads-UI` | < 6h Wartezeit, oder MS-seitiges Click-Match-Failure (msclkid nicht in MS-Datenbank) | 6h warten; danach in MS-Ads "Diagnose-Berichte" prüfen |

## Bug-Schutz im Code (was wir bereits abgedeckt haben)

| Risiko | Maßnahme |
|---|---|
| Doppel-Upload bei Retry | DB-UNIQUE-Constraint (motorhome_id, conversion_name); Pre-Flight Lookup |
| Doppel-Zählung mit Phase-1-Pixel | Verschiedene Goals: Pixel = Lead-Goals (9 Stk.), API = Sale-Goal (`Sale_Sold_Vehicle`) |
| Sale-Flow crasht durch Bing-Down | Voller try/catch, Bing-Fehler nur in `errors[]` für Admin-Mail |
| OAuth Token expired | Standard Refresh-Token-Pattern wie bei Google |
| MSCLKID > 90 Tage alt | Pre-Flight via `motorhomes.created_at` als Proxy |
| Wrong currency | Hardcoded `EUR` |
| Sandbox vs. Production verwechselt | Hardcoded Production-URL |
| Credentials in Logs | Nur Status-Strings geloggt, niemals Werte |

## Was Phase 2 NICHT macht (bewusst out-of-scope)

- **Conversion Adjustments** (Restate/Retract): Wenn ein Verkauf rückabgewickelt
  wird, müssten wir die Conversion auch korrigieren. API gibt es
  (`ApplyOfflineConversionAdjustments`), aber Caravanwert-seitig ist
  Rückabwicklung extrem selten und manuell — kein automatisches Adjustment nötig.
- **Bulk Upload**: Wir uploaden Sale-by-Sale, nicht im Batch. Bei < 50 Sales/Tag
  ist Batching unnötig und macht Idempotenz komplexer.
- **Customer Match**: Eigene Audience-Listen sind ein anderer Use-Case
  (Remarketing-Listen). Kein Sale-Tracking.
