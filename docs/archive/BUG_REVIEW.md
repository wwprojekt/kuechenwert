# Bug Review - Pending Dealer Flow

## KRITISCHER BUG 1: Migration setzt Rolle auf 'dealer' statt 'seller'

**Problem:** Die Migration `20260322200000_one_role_per_user.sql` setzt bei `user_type = 'dealer'` 
die Rolle direkt auf `'dealer'`. Aber der `useDealerPending` Hook prüft nur bei `primaryRole === 'seller'`.

**Auswirkung:** Wenn ein neuer Händler sich registriert:
- `RegisterHaendler.tsx` sendet `user_type: 'dealer'` in den Metadaten
- Der Trigger setzt die Rolle auf `'dealer'` (NICHT 'seller')
- `useDealerPending` hat `enabled: !!user && primaryRole === 'seller'` → wird NIEMALS aktiv
- Der Händler bekommt sofort das volle Dealer Dashboard ohne Sperre!

**Lösung:** Entweder:
a) Migration ändern: Dealer-Registrierung soll Rolle 'seller' vergeben (und erst nach Admin-Genehmigung zu 'dealer' promoten)
b) ODER: useDealerPending Hook auch bei primaryRole === 'dealer' aktivieren

Option A ist konsistenter mit dem Design.

## KRITISCHER BUG 2: Dealer-Subrouten nicht gesperrt

**Problem:** DealerAuctions.tsx und DealerInventory.tsx haben KEINE Pending-Prüfung.
Wenn ein pending Dealer direkt `/dashboard/auctions` oder `/dashboard/inventory` aufruft (z.B. über URL-Eingabe),
sieht er die volle Seite mit funktionierenden Buttons.

Die Sidebar ist zwar ausgegraut, aber die Routen selbst sind nicht geschützt.

**Lösung:** Entweder:
a) In SmartDashboard: Wenn isLocked, alle Sub-Routen auf DealerDashboard (Hauptseite) umleiten
b) ODER: In jeder Dealer-Subseite den useDealerPending Hook einbauen

Option A ist einfacher und sicherer.

## BUG 3: DealerDashboard hasBid Variable-Shadowing

**Problem:** In DealerDashboard.tsx wird `hasBid` sowohl als lokale Variable in der Auction-Map-Funktion
als auch als Eigenschaft von `useDealerPending` (`hasDealerApplication`) verwendet. 
`hasBid` in der Map-Funktion ist OK (lokaler Scope), aber `hasDealerApplication` wird im JSX 
als Bedingung für den Banner genutzt. Kein echter Bug, aber verwirrend.

## BUG 4: Lock-Icon doppelt importiert

**Problem:** In DealerDashboard.tsx wird `Lock` zweimal importiert - einmal aus dem Haupt-lucide-import 
und einmal separat. Kein Runtime-Bug, aber unnötiger Code.

## BUG 5: DealerApplicationStatus.tsx unbenutzt

**Problem:** Die Datei `src/components/dashboard/DealerApplicationStatus.tsx` wurde erstellt aber 
wird nirgends importiert. Dead Code.
