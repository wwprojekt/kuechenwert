# Workflow-Verifikation: Seller → Dealer Upgrade

## Schritt 1: Admin öffnet UserEditDialog für einen Seller
- `user.roles` aus DB = `[{role: 'seller'}]`
- `originalRoles = ['seller']`
- `userRoles = ['seller']`
- `AVAILABLE_ROLES` zeigt: admin, dealer, seller (mit Switch)
- Seller Switch ist AN (`checked=true` weil `userRoles.includes('seller')`)
- **OK**

## Schritt 2: Admin schaltet Seller aus, Dealer ein
- `toggleRole('seller')` → `userRoles = []`
- `toggleRole('dealer')` → `userRoles = ['dealer']`
- `isSellerToDealerUpgrade`:
  - `originalRoles.includes('seller')` = TRUE
  - `!originalRoles.includes('dealer')` = TRUE
  - `userRoles.includes('dealer')` = TRUE
  - `!userRoles.includes('seller')` = TRUE
  - → `isSellerToDealerUpgrade = TRUE`
- Gelber Alert wird angezeigt
- **OK**

## Schritt 3: Admin klickt "Händlerantrag erstellen"
- `updateProfileMutation.mutate()`
- Profil wird aktualisiert (name, phone, etc.)
- `isSellerToDealerUpgrade = true` → Upgrade-Pfad
- Prüft ob `dealer_application` existiert (`maybeSingle`)
- Erstellt neue `dealer_application` mit `status='pending'`
- Sendet Email via `send-dealer-notification` (`type='role_upgrade'`)
- `return;` (überspringt normalen Rollen-Update)
- **OK**

## Schritt 4: Benutzer loggt sich ein
- `useUserRole`: role = 'seller' (unverändert)
- `useDealerPending`: prüft `dealer_applications` wo `user_id=auth.uid()` und `status='pending'`
- `SmartDashboard`: `primaryRole='seller'` && `hasDealerApplication=true`
- → Zeigt DealerDashboard mit PendingDealerBanner
- **OK**

## Schritt 5: Admin genehmigt unter Händler
- AdminDealers zeigt pending Application
- Admin klickt "Genehmigen"
- `approve_dealer_application` RPC:
  1. Setzt `dealer_application.status = 'approved'`
  2. Ändert `user_roles` von 'seller' zu 'dealer'
- Benutzer hat jetzt `role='dealer'`
- **OK**

## Gefundener und behobener Fehler
- `AVAILABLE_ROLES` hatte `value: "private"` statt `value: "seller"`
- `isSellerToDealerUpgrade` prüfte auf `"private"` statt `"seller"`
- AdminUsers Filter hatte `value="private"` statt `value="seller"`
- DB enum `app_role` hat nur `{admin, dealer, seller}` - kein `"private"`
