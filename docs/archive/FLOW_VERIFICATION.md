# Flow-Verifizierung: Händler-Registrierung bis Freischaltung

## Phase 1: Registrierung (RegisterHaendler.tsx)
- User füllt Formular aus
- `supabase.auth.signUp()` mit `user_type: 'dealer'` in Metadaten
- **DB-Trigger `handle_new_user()`:**
  - Erstellt Profil in `profiles`
  - Setzt Rolle auf `'seller'` (NICHT dealer!)
  - Erstellt `dealer_application` mit `status: 'pending'`
- **Erfolgsseite:** "Bitte bestätigen Sie Ihre E-Mail-Adresse"
- **Status:** Rolle=seller, Application=pending, E-Mail=unbestätigt

## Phase 2: E-Mail-Bestätigung (AuthConfirm.tsx)
- User klickt Bestätigungslink
- Redirect zu `/auth/confirm` → dann zu `/login`
- **Status:** Rolle=seller, Application=pending, E-Mail=bestätigt

## Phase 3: Login (Login.tsx)
- User meldet sich an
- `signIn()` → Redirect zu `/dashboard`
- **Status:** Rolle=seller, Application=pending

## Phase 4: Dashboard (SmartDashboard.tsx)
- `useUserRole()` → `primaryRole = 'seller'`
- `useDealerPending()` → `hasDealerApplication = true`
- **Routing-Entscheidung (Zeile 156):**
  - `primaryRole === 'seller' && hasDealerApplication` → `DealerDashboardWrapper`
- **DealerDashboardWrapper:**
  - `useDealerPending()` → `isPendingDealer = true` → `isLocked = true`
  - Nur Dashboard, Profil, Einstellungen sind als Routen verfügbar
  - Alle anderen Routen fallen auf `<Route path="*" element={<DealerDashboard />} />`
- **DealerDashboard.tsx:**
  - `useDealerPending()` → `isLocked = true`
  - PendingDealerBanner wird angezeigt
  - Alle Buttons/Links deaktiviert (pointer-events-none, disabled)
- **DealerSidebar.tsx:**
  - `useDealerPending()` → `isLocked = true`
  - Menüpunkte ausgegraut mit Lock-Icon
  - Nur Dashboard, Profil, Einstellungen klickbar
- **Status:** Sieht Dealer Dashboard, aber alles gesperrt

## Phase 5: Admin genehmigt (Admin Dashboard)
- Admin ruft `approve_dealer_application(application_id)` RPC auf
- **DB-Funktion:**
  - Setzt `dealer_applications.status = 'approved'`
  - LÖSCHT 'seller' Rolle aus `user_roles`
  - FÜGT 'dealer' Rolle ein (ON CONFLICT (user_id) DO UPDATE)
- **Status:** Rolle=dealer, Application=approved

## Phase 6: Händler nach Genehmigung
- `useUserRole()` → `primaryRole = 'dealer'`
- `useDealerPending()` → `isPendingDealer = false` (status != 'pending')
- **SmartDashboard:** `primaryRole === 'dealer'` → `DealerDashboardWrapper`
- **DealerDashboardWrapper:** `isLocked = false` → alle Routen verfügbar
- **DealerDashboard:** `isLocked = false` → kein Banner, alles aktiv
- **DealerSidebar:** `isLocked = false` → alle Menüpunkte aktiv
- **Status:** Volles Dealer Dashboard freigeschaltet

## Edge Cases geprüft

### Edge Case 1: Direkter URL-Zugriff auf /dashboard/auctions (pending)
- SmartDashboard → DealerDashboardWrapper
- `isLocked = true` → Route "auctions" existiert nicht
- Fällt auf `<Route path="*" element={<DealerDashboard />} />`
- **Ergebnis:** Zeigt DealerDashboard mit Banner ✅

### Edge Case 2: Normaler Seller (kein Dealer-Antrag)
- `primaryRole = 'seller'`, `hasDealerApplication = false`
- SmartDashboard → `UserDashboardWrapper`
- **Ergebnis:** Normales Seller Dashboard ✅

### Edge Case 3: Abgelehnter Dealer
- `primaryRole = 'seller'`, `hasDealerApplication = true`, `isRejectedDealer = true`
- SmartDashboard → `DealerDashboardWrapper` (weil hasDealerApplication)
- `isLocked = true` → gleiche Sperre wie pending
- Banner zeigt "Abgelehnt" mit Begründung
- **Ergebnis:** Gesperrtes Dashboard mit Ablehnungs-Info ✅

### Edge Case 4: useDealerPending Hook - Wann wird er aktiv?
- `enabled: !!user && primaryRole === 'seller'`
- Bei Rolle 'dealer' (nach Genehmigung): Hook ist DEAKTIVIERT → isPendingDealer = false ✅
- Bei Rolle 'seller' mit Antrag: Hook ist AKTIV → prüft dealer_applications ✅
- Bei Rolle 'seller' ohne Antrag: Hook ist AKTIV → findet nichts → hasDealerApplication = false ✅

### Edge Case 5: DealerDashboardWrapper ruft useDealerPending nochmal auf
- SmartDashboard ruft useDealerPending auf (für Routing-Entscheidung)
- DealerDashboardWrapper ruft useDealerPending nochmal auf (für isLocked)
- DealerDashboard ruft useDealerPending nochmal auf (für Banner + UI)
- DealerSidebar ruft useDealerPending nochmal auf (für Menü)
- **Problem?** Nein - React Query cached die Ergebnisse, gleicher queryKey
- **Ergebnis:** Kein Performance-Problem ✅

## Verbleibende Risiken

### Risiko 1: Race Condition bei Genehmigung
- Wenn Admin genehmigt während Händler eingeloggt ist
- React Query hat staleTime, User sieht möglicherweise noch "pending"
- **Lösung:** Refresh-Button im Banner + refetchOnWindowFocus
- **Bewertung:** Akzeptabel ✅

### Risiko 2: Browser-Cache
- User könnte gecachte Version sehen nach Genehmigung
- **Lösung:** React Query refetcht bei Window Focus
- **Bewertung:** Akzeptabel ✅
