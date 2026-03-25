# RLS Full Audit - CaravanWert

## Zusammenfassung

- **128 Policies** analysiert über **57 Tabellen**
- **15 HIGH**, **103 MEDIUM**, **10 LOW** Probleme gefunden

## Hauptproblem: {public} statt {authenticated}

Das größte systematische Problem ist, dass **viele Policies** die Rolle `{public}` verwenden, obwohl sie `{authenticated}` verwenden sollten. Diese Policies nutzen `auth.uid()` in ihren USING/WITH CHECK Clauses, was für nicht-eingeloggte User `null` zurückgibt und somit effektiv keine Zeilen matcht.

**Warum ist das trotzdem ein Problem?**
1. Semantisch falsch - die Policy suggeriert, dass nicht-eingeloggte User Zugriff haben
2. Performance - Supabase muss die Policy trotzdem evaluieren für anon-Requests
3. Sicherheitsrisiko bei zukünftigen Änderungen - wenn jemand die USING-Clause ändert, könnte es offen werden

## WIRKLICH KRITISCH (0 Policies ohne jeglichen Check)

Keine Policy ist komplett offen ohne auth.uid() Check - alle UPDATE/DELETE Policies für {public} haben mindestens einen auth.uid() Check.

## Zu fixende Policies

### Priorität 1: UPDATE Policies mit {public} statt {authenticated} (10)
- analytics_sessions: Service can update sessions
- appointments: Users can update own appointments
- contact_messages: Admins can update contact messages
- cookie_consent: Users can update own consent
- motorhomes: Sellers can update own motorhomes
- post_auction_offers: Sellers and admins can update offers
- profiles: Users can update own profile
- site_settings: Admins can update site settings
- support_messages: Admins can update messages
- vehicle_questions: Admins can update questions
- wizard_sessions: wizard_sessions_user_update

### Priorität 2: INSERT Policies mit {public} statt {authenticated} (für nicht-public Tabellen)
- sepa_mandates: Users can create own SEPA mandates

### Priorität 3: SELECT Policies mit {public} + auth.uid() (34 Policies)
Alle Policies die "Users can view own..." oder "Admins can view..." heißen aber {public} statt {authenticated} nutzen.

### Priorität 4: ALL Policies mit {public} statt {authenticated} (viele)
Alle Policies die admin/user-spezifisch sind aber für {public} gelten.

## LOW - Bewusst offen (kein Fix nötig)
- auctions: Anyone can view active auctions (SELECT) - OK, öffentliche Daten
- motorhomes: Anyone can view available motorhomes (SELECT) - OK
- site_settings: Anyone can view site settings (SELECT) - OK
- station_availability/blocked_dates: Anyone can view (SELECT) - OK
- motorhome_photos: Anyone can view (SELECT) - OK
- dealer_rating_summary: Anyone can view (SELECT) - OK
- review_responses: Anyone can view (SELECT) - OK
- bids: Users can view all bids (SELECT) - Fragwürdig aber gewollt
- wizard_sessions: wizard_sessions_user_select (SELECT) - Fragwürdig
