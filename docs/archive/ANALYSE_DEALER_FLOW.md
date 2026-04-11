# Analyse: Händler-Registrierungs- und Login-Flow

## Datenbank-Zustand (aktuell bestätigt)

### Trigger `handle_new_user()`:
- ALLE neuen User bekommen Rolle `seller` (korrekt)
- Wenn `user_type = 'dealer'` → `dealer_applications` mit `status = 'pending'` wird erstellt
- Rolle wird NICHT auf `dealer` gesetzt

### Funktion `approve_dealer_application()`:
- Löscht `seller`-Rolle
- Fügt `dealer`-Rolle ein
- Setzt `status = 'approved'`

### Aktuelle Daten:
| Status | Rolle | Anzahl |
|--------|-------|--------|
| pending | seller | 4 |
| approved | dealer | 4 |

## Aktueller Flow (Schritt für Schritt)

### Phase 1: Registrierung (`/register/haendler`)
- User füllt Formular aus
- `supabase.auth.signUp()` wird aufgerufen mit `user_metadata`
- DB-Trigger erstellt: profile, user_roles (seller), dealer_applications (pending)
- **E-Mail wird NICHT bestätigt** → User hat KEINE Session
- **Anzeige**: Erfolgsseite "Bestätigungs-E-Mail gesendet"
- **Problem**: Text sagt "Nach der E-Mail-Bestätigung können Sie sich als Händler anmelden" → irreführend, weil nach E-Mail-Bestätigung der User immer noch KEIN Händler ist

### Phase 2: E-Mail-Bestätigung (`/auth/confirm`)
- User klickt Link in E-Mail
- `supabase.auth.verifyOtp()` wird aufgerufen
- **Redirect**: Nach `/login` (Standard für signup)
- **Ergebnis**: E-Mail ist bestätigt, User kann sich jetzt einloggen
- **Datenbank-Zustand**: Rolle = `seller`, dealer_application = `pending`

### Phase 3: Login (`/login`)
- User meldet sich an
- `supabase.auth.signInWithPassword()` → Session wird erstellt
- `useUserRole()` lädt Rolle → `seller`
- `useEffect` in Login.tsx: `primaryRole !== 'admin'` → redirect zu `/dashboard`
- **PROBLEM**: User landet im Seller-Dashboard (UserDashboardWrapper)!

### Phase 4: Dashboard (`/dashboard`)
- `SmartDashboard` prüft `primaryRole`:
  - `seller` → `UserDashboardWrapper` → `DashboardOverview`
- `DashboardOverview` hat eine Query für `pendingDealerApp`
- Zeigt gelbes Banner "Ihr Händlerantrag wird geprüft"
- **ABER**: Darunter ist das komplette Seller-Dashboard mit Stats, CTA "Neues Inserat erstellen" etc.
- **PROBLEM**: Händler-Bewerber sieht Seller-Funktionen die für ihn irrelevant sind

### Phase 5: Admin genehmigt
- Admin klickt "Genehmigen" in `/admin/dealers/:id`
- `approve_dealer_application()` RPC wird aufgerufen
- Rolle ändert sich von `seller` zu `dealer`
- Benachrichtigungs-E-Mail wird gesendet
- **Nächster Login**: User hat Rolle `dealer` → DealerDashboardWrapper

### Phase 6: Admin lehnt ab
- Rolle bleibt `seller`
- Status wird `rejected`
- Benachrichtigungs-E-Mail wird gesendet

## Probleme im aktuellen Flow

1. **Login leitet immer zum Dashboard weiter** - egal ob pending dealer oder normaler seller
2. **Pending Dealer sieht volles Seller-Dashboard** - nur ein Banner als Hinweis
3. **Registrierungs-Erfolgstext ist irreführend** - suggeriert dass nach E-Mail-Bestätigung Händler-Zugang kommt
4. **Kein dedizierter "Wartezustand"** - Pending Dealer hat keine eigene Seite/View

## Gewünschtes Verhalten

Der Händler-Bewerber soll beim Einloggen NICHT das Seller-Dashboard sehen, sondern eine dedizierte "Antrag wird geprüft"-Seite.
