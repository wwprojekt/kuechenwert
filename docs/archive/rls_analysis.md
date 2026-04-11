# RLS-Fehler Analyse

## Fehler
- `API_NEW_ROW_VIOLATES_ROW_LEVEL_SECURITY` auf `motorhomes` Tabelle
- Nutzer: Anonym (nicht eingeloggt)
- Seite: VerkaufenWizard
- URL enthält Query-Parameter: manufacturer=Benimar, model=KAVASLIER, bodyType=Alkoven, saleChannel=station, customerName=harun, customerEmail=r.daban@icloud.com, customerPhone=01725742974

## Analyse des Wizard-Flows (useWizardForm.ts)

### Flow für anonyme Nutzer:
1. `submitForm()` wird aufgerufen
2. Zeile 330: `supabase.auth.getUser()` → user = null (anonym)
3. Zeile 333: Prüft ob `!user && registerPassword && formData.customerEmail`
4. Wenn kein Passwort angegeben → user bleibt null
5. Zeile 357: `if (!user)` → Gast-Submission: sendet nur Lead-Notification, KEIN motorhomes Insert
6. Zeile 378: Redirect zu /verkaufen/danke

### Flow für registrierte Nutzer:
1. Zeile 338: signUp mit Email/Passwort
2. user wird gesetzt
3. Zeile 477: `supabase.from('motorhomes').insert(...)` mit `seller_id: user.id`

## Problem-Ursache
Der Code in useWizardForm.ts ist KORREKT - anonyme Nutzer sollten NICHT in motorhomes inserieren.
Der Fehler tritt auf, wenn:
- Der Nutzer die URL mit saleChannel=station aufruft
- Der Nutzer KEIN Passwort eingibt (oder die Registrierung fehlschlägt)
- Aber trotzdem versucht wird, ein Motorhome zu erstellen

ODER: Es gibt einen anderen Code-Pfad (z.B. saleChannel=station) der direkt inseriert.

Prüfe: Gibt es einen separaten Flow für "station" (Ankaufstation)?
