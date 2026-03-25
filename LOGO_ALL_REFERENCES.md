# Alle Logo-Referenzen im Projekt

## 1. email-builder.ts (KRITISCH - altes Logo hardcoded)
- Zeile 55: `logoUrl: 'https://caravanwert.de/logo.png'`
- Wird von 23 Edge Functions importiert
- MUSS aktualisiert werden

## 2. email-components.tsx (OK - nutzt settings.logo_url dynamisch)
- Zeile 46-50: Nutzt `settings.logo_url` aus der DB
- Wird von 6 Email-Templates importiert
- Kein Fix nötig (nutzt bereits die DB-Einstellung)

## 3. DB email_templates (OK - kein Logo in body_html)
- 6 Templates, keines enthält Logo-Referenzen
- Logo kommt über email-builder.ts Layout

## 4. AdminEmailCenter.tsx (BEREITS GEFIXT)
- 3 Stellen aktualisiert

## 5. Supabase Auth Templates (BEREITS GEFIXT)
- 8 Templates aktualisiert

## 6. send-push-notification/index.ts (MINOR)
- Zeile 82: `icon: icon || "/logo.png"`
- Nutzt relative URL, wird nach Deploy korrekt sein

## 7. generate-handover-pdf/index.ts (TEXT ONLY)
- Zeile 162: `<div class="logo">CaravanWert</div>`
- Kein Bild, nur Text - kein Fix nötig

## ZUSAMMENFASSUNG: Nur email-builder.ts muss noch gefixt werden
