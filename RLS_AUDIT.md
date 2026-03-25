# RLS Audit - Fehlende Policies

## Tabellen mit fehlenden Policies:

### 1. admin_emails - MISSING: INSERT, UPDATE, DELETE
- Hat nur SELECT für Admins
- Braucht: INSERT, UPDATE, DELETE für Admins (E-Mail-Center)

### 2. analytics_daily_summary - MISSING: INSERT, UPDATE, DELETE
- Hat nur SELECT für Admins
- INSERT/UPDATE werden vermutlich von Edge Functions mit service_role gemacht → OK

### 3. analytics_events - MISSING: UPDATE, DELETE
- Hat SELECT + INSERT
- UPDATE/DELETE nicht nötig für Events → OK (append-only)

### 4. analytics_page_performance - MISSING: INSERT, UPDATE, DELETE
- Hat nur SELECT
- Wird von Edge Functions befüllt → OK

### 5. analytics_page_views - MISSING: UPDATE, DELETE
- Hat SELECT + INSERT
- Append-only → OK

### 6. analytics_sessions - MISSING: UPDATE, DELETE
- Hat SELECT + INSERT + UPDATE
- DELETE nicht nötig → OK

### 7. appointments - MISSING: DELETE
- Hat SELECT, INSERT, UPDATE
- Admin sollte Termine löschen können → BRAUCHT FIX

### 8. audit_logs - MISSING: INSERT, UPDATE, DELETE
- Hat nur SELECT für Admins
- Audit Logs sollen NICHT gelöscht werden → OK (by design)

### 9. blog_posts - MISSING: nichts (hat ALL)
- OK

### 10. claim_photos - MISSING: INSERT, UPDATE, DELETE
- Hat nur SELECT
- Wird von Edge Functions verwaltet → OK

### 11. claim_status_history - MISSING: INSERT, UPDATE, DELETE
- Hat nur SELECT
- Wird von Edge Functions verwaltet → OK

### 12. claims - MISSING: DELETE
- Hat SELECT, INSERT, UPDATE
- Admin sollte Claims löschen können → OPTIONAL

### 13. commission_calculations - MISSING: nichts (hat ALL)
- OK

### 14. cookie_consent - MISSING: UPDATE, DELETE
- Hat SELECT + INSERT
- Consent-Einträge werden nicht gelöscht → OK

### 15. damage_photos - MISSING: INSERT, UPDATE, DELETE
- Hat nur SELECT
- Wird von Edge Functions verwaltet → OK

### 16. dealer_applications - MISSING: DELETE
- Hat SELECT, INSERT, UPDATE
- Admin könnte abgelehnte Applications löschen wollen → OPTIONAL

### 17. post_auction_offers - MISSING: DELETE
- Hat SELECT, INSERT, UPDATE
- Admin sollte Angebote löschen können → BRAUCHT FIX

### 18. profiles - MISSING: DELETE
- Hat SELECT, INSERT, UPDATE
- Profile sollten NICHT gelöscht werden (referenzielle Integrität) → OK

### 19. review_responses - MISSING: UPDATE, DELETE
- Hat SELECT + INSERT
- Admin sollte Antworten bearbeiten/löschen können → OPTIONAL

### 20. search_alert_matches - MISSING: INSERT, UPDATE, DELETE
- Hat nur SELECT
- Wird von Edge Functions verwaltet → OK

### 21. site_settings - MISSING: INSERT, DELETE
- Hat SELECT + UPDATE
- Settings werden nicht gelöscht → OK

### 22. support_messages - MISSING: DELETE
- Hat SELECT, INSERT, UPDATE
- Admin sollte Nachrichten löschen können → BRAUCHT FIX

## Zusammenfassung - BRAUCHT FIX:
1. admin_emails - DELETE für Admins
2. appointments - DELETE für Admins
3. post_auction_offers - DELETE für Admins
4. support_messages - DELETE für Admins
