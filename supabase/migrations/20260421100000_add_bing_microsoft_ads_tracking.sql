-- Bing / Microsoft Ads Tracking Support (additive)
--
-- Erweitert das bestehende Google-Ads-Tracking um Microsoft Ads (Bing).
-- Diese Migration ist STRENG ADDITIV — kein bestehender Pfad wird verändert.
--
-- Ergänzungen:
-- 1. msclkid-Spalte in wizard_sessions + motorhomes (analog zu gclid/gbraid/wbraid)
-- 2. update_wizard_session_by_anonymous_id RPC um msclkid erweitert
-- 3. tracking_config JSONB erhält neuen Block 'microsoft_ads' (default: disabled)
--
-- Hintergrund: Wir geben in Microsoft Ads ab ~500 EUR/Tag aus. Ohne msclkid-
-- Capture und ohne UET-Conversion-Events kann Bing seine Smart-Bidding-
-- Algorithmen nicht trainieren -> verbranntes Budget. Diese Migration legt
-- die Schema-Grundlage. Frontend + Edge Function liefern Capture/Send.

-- =====================================================================
-- 1) Click-ID Spalten — additiv neben gclid/gbraid/wbraid
-- =====================================================================

ALTER TABLE wizard_sessions
  ADD COLUMN IF NOT EXISTS msclkid TEXT;

ALTER TABLE motorhomes
  ADD COLUMN IF NOT EXISTS msclkid TEXT;

COMMENT ON COLUMN wizard_sessions.msclkid IS 'Microsoft Click ID (Bing Ads) captured at wizard start for offline conversion attribution';
COMMENT ON COLUMN motorhomes.msclkid       IS 'Microsoft Click ID (Bing Ads) from original lead for sale-back conversion tracking';

-- =====================================================================
-- 2) RPC erweitern — msclkid in das whitelist-basierte Update aufnehmen
-- =====================================================================
-- Ohne diesen Schritt würde der RPC den msclkid-Wert silently verwerfen
-- (analog zur gclid-Migration 20260415110000).

CREATE OR REPLACE FUNCTION update_wizard_session_by_anonymous_id(
  p_anonymous_id TEXT,
  p_session_id UUID,
  p_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE wizard_sessions SET
    current_step      = COALESCE((p_updates->>'current_step')::int,         current_step),
    max_step_reached  = COALESCE((p_updates->>'max_step_reached')::int,     max_step_reached),
    total_steps       = COALESCE((p_updates->>'total_steps')::int,          total_steps),
    step_name         = COALESCE(p_updates->>'step_name',                   step_name),
    form_data         = COALESCE((p_updates->>'form_data')::jsonb,          form_data),
    status            = COALESCE(p_updates->>'status',                      status),
    customer_name     = COALESCE(p_updates->>'customer_name',               customer_name),
    customer_email    = COALESCE(p_updates->>'customer_email',              customer_email),
    customer_phone    = COALESCE(p_updates->>'customer_phone',              customer_phone),
    vehicle_summary   = COALESCE(p_updates->>'vehicle_summary',             vehicle_summary),
    user_id           = COALESCE((p_updates->>'user_id')::uuid,             user_id),
    gclid             = COALESCE(p_updates->>'gclid',                       gclid),
    gbraid            = COALESCE(p_updates->>'gbraid',                      gbraid),
    wbraid            = COALESCE(p_updates->>'wbraid',                      wbraid),
    msclkid           = COALESCE(p_updates->>'msclkid',                     msclkid),
    updated_at        = now(),
    last_activity_at  = now()
  WHERE id = p_session_id AND anonymous_id = p_anonymous_id;
END;
$func$;

COMMENT ON FUNCTION update_wizard_session_by_anonymous_id IS
  'Whitelist-basierter Update für anonyme Wizard-Sessions. Erweitert um msclkid (Bing) am 2026-04-21.';

-- =====================================================================
-- 3) tracking_config JSONB — neuer Block 'microsoft_ads'
-- =====================================================================
-- Default ist enabled=false, damit OHNE jede weitere Konfiguration genau
-- das passiert was vorher passierte (kein Bing-Tracking). Sobald der
-- Admin im Backend die UET-Tag-ID einträgt UND enabled=true setzt,
-- wird das UET-Pixel im Frontend geladen + Conversion-Events gefeuert.
--
-- jsonb_set ist idempotent: existierende Schlüssel werden nicht überschrieben.

UPDATE public.site_settings
SET tracking_config = jsonb_set(
      COALESCE(tracking_config, '{}'::jsonb),
      '{microsoft_ads}',
      '{
        "enabled":            false,
        "uet_tag_id":         "",
        "allow_enhanced_conversions": true,
        "conversion_goals": {
          "WIZARD_ABGESCHLOSSEN":     "wizard_completed",
          "KONTAKTFORMULAR_GESENDET": "kontakt_lead",
          "WERTERMITTLUNG_LEAD":      "wertermittlung_lead",
          "WERTRECHNER_LEAD":         "wertrechner_lead",
          "TERMINBUCHUNG":            "terminbuchung",
          "LANDING_PAGE_LEAD":        "landing_funnel_start",
          "WIZARD_GESTARTET":         "wizard_started",
          "WIZARD_FAHRZEUGDATEN":     "wizard_vehicle_data"
        },
        "values": {
          "WIZARD_ABGESCHLOSSEN":     9.0,
          "TERMINBUCHUNG":            9.0,
          "KONTAKTFORMULAR_GESENDET": 1.0,
          "WERTERMITTLUNG_LEAD":      2.5,
          "WERTRECHNER_LEAD":         2.5,
          "LANDING_PAGE_LEAD":        1.0,
          "WIZARD_GESTARTET":         1.0,
          "WIZARD_FAHRZEUGDATEN":     1.0,
          "INSTANT_BUY":              0
        }
      }'::jsonb,
      true     -- create_missing: ja, wenn noch nicht vorhanden
    )
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND NOT (tracking_config ? 'microsoft_ads');

-- Hinweis: public_site_settings VIEW gibt tracking_config bereits durch
-- (siehe Migration 20260417120000_add_tracking_config_to_site_settings.sql),
-- daher ist KEIN VIEW-Recreate nötig. Frontend liest den neuen Block
-- automatisch sobald die Config-Spalte aktualisiert wird.
