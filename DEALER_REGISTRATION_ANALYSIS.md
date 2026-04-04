# Händler-Registrierungsfluss – Vollständige Analyse

## Übersicht: Zwei Registrierungswege

### 1. `/register/haendler` (RegisterHaendler.tsx) – HAUPTWEG
- Verlinkt von: Header → /haendler Landingpage → CTA Button, Login-Seite, Register-Choice, AuctionDetail
- Formular: E-Mail, Passwort, Firma, Adresse, PLZ, Stadt, Land (EU-Dropdown), Rechtsform, Gründungsjahr, Kontaktperson, Telefon, Website, Dokument-Upload (optional), AGB
- **Sprache wechselt dynamisch** je nach gewähltem Land (8 Sprachen: DE, EN, NL, FR, IT, ES, PT, PL)
- **Rechtsformen wechseln** je nach Land (28 EU-Länder + CH)
- Submit: `supabase.auth.signUp()` mit `user_type: 'dealer'` in Metadata
- DB-Trigger `handle_new_user()` erstellt: profiles, user_roles (seller!), dealer_applications (pending)
- Supabase sendet automatisch eine **Bestätigungs-E-Mail** (Standard-Supabase-Template)
- **KEINE** `application_received` E-Mail wird gesendet
- **KEINE** `send-dealer-notification` wird aufgerufen
- Erfolgsseite zeigt: "Bestätigen Sie Ihre E-Mail" + Login-Button

### 2. `/dealer-onboarding` (DealerOnboarding.tsx) – ALTERNATIVER WEG
- 4-Schritt-Wizard: Account → Unternehmen → Bestätigung → Dokumente
- **NUR auf Deutsch** (keine Übersetzungen)
- Nicht von Header/Footer/Landingpage verlinkt (nur direkt erreichbar)
- Gleicher signUp-Flow, aber versucht danach sofort `dealer_applications` zu fetchen
- Dokument-Upload in Schritt 4 (LegalDocumentUpload Komponente)
- Fragil: Wenn DB-Trigger langsam ist, kann Schritt 4 fehlschlagen

## E-Mail-Fluss

### Bei Self-Service-Registrierung:
1. **Supabase Bestätigungs-E-Mail** → automatisch nach signUp (Standard-Template)
2. **KEINE** "Bewerbung erhalten" E-Mail → FEHLT!
3. **KEINE** Willkommens-E-Mail → send-welcome-email existiert, wird aber nirgends aufgerufen

### Bei Admin-Genehmigung:
1. `approveDealerApplication()` → `send-dealer-notification` mit type `approved` → E-Mail mit Dashboard-Link
2. `rejectDealerApplication()` → `send-dealer-notification` mit type `rejected` → E-Mail mit Begründung

### Bei Admin-Erstellung (DealerCreateDialog):
1. `admin-create-user` Edge Function → Konto erstellen
2. `send-registration-invite` mit `inviteType: 'dealer'` → Magic Link E-Mail

## Dashboard nach Registrierung (Pending State)

- SmartDashboard erkennt: `primaryRole === 'seller' && hasDealerApplication` → DealerDashboardWrapper
- DealerSidebar: Zeigt "Händler Portal (Antrag in Prüfung)", meiste Menüpunkte gesperrt
- PendingDealerBanner: Amber-Banner mit Status, Details, Refresh-Button
- PendingDealerDocumentUpload: 3 Dokument-Slots (Gewerbenachweis, Ausweis vorne/hinten)

## IDENTIFIZIERTE PROBLEME

### KRITISCH:
1. **Keine "Bewerbung erhalten" E-Mail** – Händler erhält nach Registrierung nur die Standard-Supabase-Bestätigungs-E-Mail, aber keine Bestätigung dass die Bewerbung eingegangen ist
2. **PendingDealerDocumentUpload ist nur auf Deutsch** – Dokument-Labels "Gewerbenachweis", "Ausweis Vorderseite/Rückseite" sind deutsch-spezifisch und nicht übersetzt
3. **PendingDealerBanner ist nur auf Deutsch** – Alle Texte hardcoded deutsch
4. **Dokument-Anforderungen sind deutsch-spezifisch** – "Gewerbenachweis" existiert so nur in DE/AT, andere Länder haben andere Nachweise (z.B. Kbis in FR, KvK in NL)
5. **DealerOnboarding-Seite ist nur auf Deutsch** – Kein Übersetzungssystem

### WICHTIG:
6. **Erfolgsseite nach Registrierung ist nur auf Deutsch** – PageLayout title/description hardcoded
7. **Datum-Formatierung** in PendingDealerBanner: `toLocaleDateString('de-DE')` hardcoded
8. **send-dealer-notification E-Mails sind nur auf Deutsch** – Approved/Rejected E-Mails
9. **send-registration-invite E-Mails sind nur auf Deutsch** – Dealer-Invite E-Mail
10. **Hardcoded URLs** in E-Mails: `https://caravanwert.de/dashboard` statt dynamisch

### NICE-TO-HAVE:
11. **Kein Fortschrittsindikator** auf RegisterHaendler (im Gegensatz zu DealerOnboarding)
12. **DealerOnboarding nicht verlinkt** – Toter Code oder Feature-Flag?
