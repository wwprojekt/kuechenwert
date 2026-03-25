# Analyse: Wo fehlen Löschfunktionen im Admin?

## Priorität 1 (vom User angefragt):
- **AdminLeads.tsx** - Wizard-Sessions + Quick-Leads → Bulk + Einzeln löschen
  - Tabellen: wizard_sessions, quick_leads
  - Aktuell: Nur Trash2 importiert, keine Löschlogik

## Priorität 2 (sinnvoll):
- **AdminMessages.tsx** - Support-Nachrichten → Einzeln löschen
  - Tabelle: support_messages
- **AdminQuestions.tsx** - Fahrzeug-Fragen → Einzeln löschen
  - Tabelle: vehicle_questions

## Nicht sinnvoll zu löschen:
- AdminAuctions - Auktionen sollten nicht gelöscht werden (Geschäftsdaten)
- AdminAuditLog - Audit-Logs dürfen nie gelöscht werden
- AdminDealers - Händler sollten deaktiviert, nicht gelöscht werden
- AdminUserDetail - User-Details, nicht löschen
- AdminAuctionDetail - Einzelne Auktion, nicht löschen
- AdminDealerDetail - Einzelner Händler, nicht löschen

## Wertrechner-Leads:
- value_assessment_leads Tabelle existiert, wird aber NICHT im Admin angezeigt
- Könnte als Tab in AdminLeads hinzugefügt werden
