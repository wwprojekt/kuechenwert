# Bug-Analyse AdminLeads.tsx

## Prüfpunkte und Ergebnisse

### 1. ConvertToMotorhomeDialog Props-Kompatibilität
- **Props erwartet:** `session: WizardSessionData | null`, `open`, `onOpenChange`, `sourceType?: LeadSourceType`
- **WizardSessionData Interface:** `{ id, user_id, customer_name, customer_email, customer_phone, form_data, status }`
- **quickLeadToSessionData gibt zurück:** `{ id, user_id: null, customer_name, customer_email, customer_phone, form_data, status }` - PASST
- **valuationLeadToSessionData gibt zurück:** `{ id, user_id: null, customer_name, customer_email, customer_phone, form_data, status }` - PASST
- **sourceType wird korrekt übergeben:** "wizard" | "quick" | "valuation" - PASST

### 2. Quick-Lead Konvertierungs-Erkennung
- **ConvertToMotorhomeDialog** setzt bei Quick-Leads: `lead_quality: "converted"` (NICHT `status: "converted"`)
- **AdminLeads QuickLeadStatusBadge** prüft: `status === "converted" || leadQuality === "converted"` - KORREKT
- **AdminLeads Tabelle "Als Wohnmobil anlegen" Button**: `lead.status !== "converted" && lead.lead_quality !== "converted"` - KORREKT
- **AdminLeads Registrierungslink**: `(lead.status === "converted" || lead.lead_quality === "converted") && lead.email` - KORREKT

### 3. Quick-Lead "Als kontaktiert markieren"
- **Mutation schreibt:** `{ contacted_at: new Date().toISOString(), status: "contacted" }` 
- **PROBLEM:** Quick-Leads haben `status` Feld in der DB, aber `lead_quality` wird nicht aktualisiert
- **KEIN BUG:** Status und lead_quality sind getrennte Felder. Status = Admin-Aktion, lead_quality = automatisch

### 4. Valuation-Lead Felder die nicht in DB-Typen sind
- `algorithm_value_min`, `algorithm_value_max`, `brand_tier`, `admin_estimated_value`, `admin_valued_at`, `ai_estimated_value`, `ai_confidence`
- Diese werden über `as any` Casts geschrieben - funktioniert wenn die Spalten in der DB existieren
- **POTENTIELLES PROBLEM:** Wenn diese Spalten nicht in der DB existieren, werden die Werte still ignoriert
- **ABER:** Diese Felder waren schon vorher im Code und funktionieren offenbar

### 5. Unused Import Check
- `CardContent` wird importiert aber nicht verwendet - WARNUNG (kein Bug)
- `ArrowUpDown` wird im Detail-Dialog verwendet - OK
- `AlertTriangle` wird im Wizard-Progress verwendet - OK
- `FileText` wird im Quick-Lead Detail verwendet - OK
- `Globe` wird im Quick-Lead Detail verwendet - OK

### 6. Quick-Lead `wizard_completed` Typ
- Interface sagt `wizard_completed: boolean` (nicht nullable)
- DB-Typ sagt `wizard_completed: boolean | null`
- **POTENTIELLES PROBLEM:** Wenn DB null zurückgibt, wird es als falsy behandelt - kein Crash, aber Typ-Mismatch

### 7. Quick-Lead `markQuickLeadContacted` - Status-Update
- Setzt `status: "contacted"` via `as any`
- Quick-Leads haben `status` Feld in DB - OK
- **ABER:** ConvertToMotorhomeDialog setzt `lead_quality: "converted"`, NICHT `status: "converted"`
- Wenn ein Quick-Lead kontaktiert wird (status="contacted") und dann konvertiert wird (lead_quality="converted"),
  ist status immer noch "contacted" - das ist OK, QuickLeadStatusBadge prüft beides

### 8. sendRegistrationInvite Funktion
- Ruft `send-registration-invite` Edge Function auf mit `{ email, customerName, sessionId }`
- AuctionEditDialog ruft dieselbe Funktion mit `{ email, customerName, motorhomeId }` auf
- **POTENTIELLES PROBLEM:** Für Quick-Leads und Valuation-Leads wird `sessionId` übergeben, aber das ist die Lead-ID, nicht eine Wizard-Session-ID
- **KEIN CRASH:** Die Edge Function nutzt sessionId wahrscheinlich nur für Logging/Tracking

### 9. Quick-Lead Detail Dialog - form_data_snapshot Null-Check
- `selectedQuickLead.form_data_snapshot && Object.keys(selectedQuickLead.form_data_snapshot).length > 0`
- Korrekte Null-Prüfung - OK

### 10. Valuation-Lead Detail Dialog - Admin-Notizen vs Experten-Notizen
- `expertNotes` wird in `saveExpertValue` als `admin_notes` gespeichert
- `valuationAdminNotes` wird in `updateValuationAdminNotes` als `admin_notes` gespeichert
- **BUG GEFUNDEN:** Beide schreiben in dasselbe `admin_notes` Feld! 
  - Wenn man Experten-Notizen speichert, überschreibt es die Admin-Notizen und umgekehrt
  - `expertNotes` wird initialisiert mit `lead.admin_notes || ""`
  - `valuationAdminNotes` wird AUCH initialisiert mit `lead.admin_notes || ""`
  - Lösung: Entweder ein Feld verwenden oder die Logik trennen

### 11. Quick-Lead `wizard_completed` boolean vs null
- Interface: `wizard_completed: boolean` 
- DB: `wizard_completed: boolean | null`
- Kein Crash, aber TypeScript könnte warnen
