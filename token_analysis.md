# Token/Session Analyse - Alle kritischen Stellen

## Supabase Token-Ablauf
- **Access Token (JWT):** Standard 1 Stunde (3600s), konfigurierbar im Supabase Dashboard
- **Refresh Token:** Standard 1 Woche (604800s), konfigurierbar
- **autoRefreshToken: true** ist aktiviert → Client versucht automatisch zu refreshen
- **Aber:** Wenn der Browser-Tab lange inaktiv war oder der Refresh-Token abgelaufen ist, schlägt der Refresh fehl

## Kritische Stellen (Nicht-Admin, schreibende Operationen)

### 1. useWizardForm.ts - submitForm() [HÖCHSTES RISIKO]
- Zeile 330: getUser() → kann abgelaufenen User zurückgeben
- Zeile 477: motorhomes.insert() → RLS: auth.uid() = seller_id → FEHLER bei ungültigem Token
- Zeile 495: motorhome_photos.insert() → RLS: Motorhome-Owner-Check → FEHLER
- Zeile 504: auctions.insert() → RLS: Motorhome-Owner-Check → FEHLER
- **FIX NÖTIG:** Fallback auf Lead-Only-Pfad bei RLS-Fehler

### 2. useWizardSession.ts [MITTLERES RISIKO]
- Zeile 156: wizard_sessions.update() → RLS: USING(true) → KEIN PROBLEM (jeder darf)
- Zeile 163: wizard_sessions.insert() → RLS: WITH CHECK(true) → KEIN PROBLEM
- Zeile 263: wizard_sessions.update() → KEIN PROBLEM
- Zeile 316: wizard_sessions.update() → KEIN PROBLEM
- **KEIN FIX NÖTIG** - wizard_sessions hat offene RLS

### 3. leadTrackingService.ts [MITTLERES RISIKO]
- Zeile 106: quick_leads.update() → Nur Admin-Policy → FEHLER wenn nicht-Admin
- Zeile 123: quick_leads.insert() → RLS: WITH CHECK(true) → KEIN PROBLEM
- Zeile 179: quick_leads.update() → Nur Admin-Policy → FEHLER wenn nicht-Admin
- **PRÜFEN:** Wird update von nicht-Admins aufgerufen?

### 4. AuctionDetail.tsx - Gebote [MITTLERES RISIKO]
- bids.insert() → RLS: auth.uid() = bidder_id → FEHLER bei ungültigem Token
- **FIX NÖTIG:** Bessere Fehlerbehandlung

### 5. PostAuctionOfferDialog.tsx [MITTLERES RISIKO]
- post_auction_offers.insert() → RLS: auth.uid() Check → FEHLER bei ungültigem Token
- **FIX NÖTIG:** Bessere Fehlerbehandlung

### 6. VehicleQuestionForm.tsx [NIEDRIGES RISIKO]
- vehicle_questions.insert() → RLS: WITH CHECK(true) → KEIN PROBLEM

### 7. Kontakt.tsx [NIEDRIGES RISIKO]
- contact_messages.insert() → Unklar ob RLS offen → PRÜFEN

### 8. Wertermittlung.tsx / Wertrechner.tsx [NIEDRIGES RISIKO]
- value_assessment_leads.insert() → RLS: WITH CHECK(true) → KEIN PROBLEM

### 9. DealerRegister.tsx [MITTLERES RISIKO]
- dealer_applications.insert() → RLS: auth.uid() = user_id → FEHLER bei ungültigem Token
- **FIX NÖTIG:** Bessere Fehlerbehandlung

### 10. dashboard/ListingEdit.tsx [MITTLERES RISIKO]
- motorhomes.update() → RLS: auth.uid() = seller_id → FEHLER bei ungültigem Token
- motorhome_photos.delete/insert → RLS: Owner-Check → FEHLER
- **FIX NÖTIG:** Bessere Fehlerbehandlung

### 11. useFavorites.ts [NIEDRIGES RISIKO]
- user_favorites.insert() → RLS: User-Check → FEHLER bei ungültigem Token

### 12. usePushNotifications.ts [NIEDRIGES RISIKO]
- push_subscriptions.upsert() → FEHLER bei ungültigem Token

### 13. analyticsService.ts [KEIN RISIKO]
- analytics_*.insert() → RLS: WITH CHECK(true) → KEIN PROBLEM

### 14. dashboard/MyMessages.tsx [MITTLERES RISIKO]
- support_messages.insert() → RLS: User-Check → FEHLER bei ungültigem Token

## Zusammenfassung der nötigen Fixes

### Priorität 1 (Sofort):
- useWizardForm.ts: Fallback auf Lead-Only bei RLS-Fehler

### Priorität 2 (Wichtig):
- Globaler Auth-Guard: Bei RLS-Fehler automatisch Session refreshen und Nutzer informieren
- AuctionDetail.tsx: Gebote-Fehlerbehandlung
- ListingEdit.tsx: Fehlerbehandlung

### Priorität 3 (Nice-to-have):
- Alle anderen authentifizierten Operationen mit besserem Error-Handling
