# Konzept: Optimierter Händler-Flow

## Ziel
Händler-Bewerber (Status: pending) sollen beim Einloggen oder Navigieren zum Dashboard nicht das Seller-Dashboard sehen, sondern eine dedizierte "Antrag wird geprüft"-Seite.

## Analyse der Optionen

### Option 1: Login.tsx anpassen (Nicht empfohlen)
Man könnte in `Login.tsx` nach dem Login prüfen, ob der User eine pending dealer application hat und ihn dann auf eine spezielle Route (z.B. `/dealer-pending`) weiterleiten.
*Nachteil*: Wenn der User später manuell `/dashboard` aufruft, landet er trotzdem wieder im Seller-Dashboard.

### Option 2: SmartDashboard.tsx anpassen (Empfohlen)
`SmartDashboard` ist bereits der zentrale Router für alle `/dashboard/*` Routen. Hier können wir die Prüfung einbauen. Wenn der User die Rolle `seller` hat, aber eine `pending` oder `rejected` Dealer Application, zeigen wir statt dem `UserDashboardWrapper` eine dedizierte Status-Seite.
*Vorteil*: Egal wie der User zum Dashboard navigiert, er sieht immer die richtige Status-Seite. Es erfordert keine neuen Routen auf Top-Level.

### Option 3: useUserRole.ts anpassen (Alternativ)
Man könnte den Hook so erweitern, dass er auch den Status der Dealer Application lädt und eine neue "Pseudo-Rolle" `pending_dealer` zurückgibt.
*Nachteil*: Vermischt echte DB-Rollen mit Applikationsstatus. Kann an anderen Stellen zu unerwartetem Verhalten führen.

## Gewählte Lösung: Option 2 (SmartDashboard Anpassung)

### Schritt 1: Neue Komponente `DealerApplicationStatus` erstellen
Wir extrahieren die Status-UI aus `DealerRegister.tsx` (die bereits exzellent aussieht mit "Antrag wird geprüft" und "Antrag abgelehnt") in eine eigene Komponente `src/components/dashboard/DealerApplicationStatus.tsx`.

### Schritt 2: SmartDashboard.tsx anpassen
Wir fügen eine React Query in `SmartDashboard.tsx` hinzu, die prüft, ob der User (wenn Rolle = seller) eine Dealer Application hat.
Wenn `status === 'pending'` oder `status === 'rejected'`, wird statt `UserDashboardWrapper` die neue Komponente `DealerApplicationStatus` gerendert.

### Schritt 3: DashboardOverview.tsx bereinigen
Das gelbe Banner "Ihr Händlerantrag wird geprüft" und die Query für `pendingDealerApp` können aus `DashboardOverview.tsx` entfernt werden, da diese User das Dashboard gar nicht mehr erreichen.

### Schritt 4: Texte in RegisterHaendler.tsx anpassen
Den irreführenden Text "Nach der E-Mail-Bestätigung können Sie sich als Händler anmelden" in "Nach der E-Mail-Bestätigung können Sie den Status Ihres Antrags einsehen" ändern.

## Umsetzungsschritte

1. **Erstellen**: `src/components/dashboard/DealerApplicationStatus.tsx`
2. **Ändern**: `src/components/SmartDashboard.tsx` (Query hinzufügen, Logik anpassen)
3. **Ändern**: `src/pages/dashboard/DashboardOverview.tsx` (Banner entfernen)
4. **Ändern**: `src/pages/RegisterHaendler.tsx` (Erfolgstext anpassen)
5. **Ändern**: `src/pages/DealerOnboarding.tsx` (Erfolgstext anpassen, falls nötig)
