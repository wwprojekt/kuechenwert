-- Add JSONB tracking_config to site_settings for centralized admin-managed tracking IDs.
-- Stores Google Analytics 4, Google Ads (incl. all conversion labels & values),
-- Google Tag Manager, Meta Pixel, and server-side Google Ads API configuration.
--
-- Defaults match the values currently hardcoded in index.html and src/lib/gadsConversionService.ts
-- so behaviour is unchanged immediately after this migration runs.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS tracking_config jsonb NOT NULL DEFAULT jsonb_build_object(
    'enabled', true,
    'ga4', jsonb_build_object(
      'enabled', true,
      'measurement_id', 'G-H4BCV8DS0B',
      'send_page_view', true
    ),
    'google_ads', jsonb_build_object(
      'enabled', true,
      'conversion_id', 'AW-18033517246',
      'allow_enhanced_conversions', true,
      'labels', jsonb_build_object(
        'BEWERTUNG_ABGESCHLOSSEN', 'GAI_CI-zrI0cEL7FhpdD',
        'KONTAKTFORMULAR_GESENDET', 'pXp5CPKNkY4cEL7FhpdD',
        'WERTERMITTLUNG_LEAD',      'AHaxCPWNkY4cEL7FhpdD',
        'WERTRECHNER_LEAD',         'JBEqCPiNkY4cEL7FhpdD',
        'WIZARD_ABGESCHLOSSEN',     'JO7oCPuNkY4cEL7FhpdD',
        'TERMINBUCHUNG',            '3_bOCP6NkY4cEL7FhpdD',
        'LANDING_PAGE_LEAD',        'IfQvCO-NkY4cEL7FhpdD',
        'WIZARD_GESTARTET',         '-m3-CIGOkY4cEL7FhpdD',
        'WIZARD_FAHRZEUGDATEN',     '5BvzCISOkY4cEL7FhpdD'
      ),
      'values', jsonb_build_object(
        'WIZARD_ABGESCHLOSSEN',     9.0,
        'TERMINBUCHUNG',            9.0,
        'KONTAKTFORMULAR_GESENDET', 1.0,
        'WERTERMITTLUNG_LEAD',      2.5,
        'WERTRECHNER_LEAD',         2.5,
        'LANDING_PAGE_LEAD',        1.0,
        'WIZARD_GESTARTET',         1.0,
        'WIZARD_FAHRZEUGDATEN',     1.0,
        'INSTANT_BUY',              0
      )
    ),
    'gtm', jsonb_build_object(
      'enabled', false,
      'container_id', ''
    ),
    'meta_pixel', jsonb_build_object(
      'enabled', true,
      'pixel_id', '1846623132710484'
    ),
    'server_side', jsonb_build_object(
      'gads_offline_conversion_action_id', '7576040066',
      'gads_login_customer_id', '9746508145'
    )
  );

COMMENT ON COLUMN public.site_settings.tracking_config IS
  'Centralized tracking configuration (GA4, Google Ads, GTM, Meta Pixel, server-side IDs). Editable via Admin Backend → Einstellungen → Tracking.';

-- Make sure the singleton row has the default applied (column NOT NULL DEFAULT handles new rows;
-- this UPDATE only fills tracking_config when it is JSON null/empty so we never overwrite admin edits).
UPDATE public.site_settings
SET tracking_config = jsonb_build_object(
    'enabled', true,
    'ga4', jsonb_build_object(
      'enabled', true,
      'measurement_id', 'G-H4BCV8DS0B',
      'send_page_view', true
    ),
    'google_ads', jsonb_build_object(
      'enabled', true,
      'conversion_id', 'AW-18033517246',
      'allow_enhanced_conversions', true,
      'labels', jsonb_build_object(
        'BEWERTUNG_ABGESCHLOSSEN', 'GAI_CI-zrI0cEL7FhpdD',
        'KONTAKTFORMULAR_GESENDET', 'pXp5CPKNkY4cEL7FhpdD',
        'WERTERMITTLUNG_LEAD',      'AHaxCPWNkY4cEL7FhpdD',
        'WERTRECHNER_LEAD',         'JBEqCPiNkY4cEL7FhpdD',
        'WIZARD_ABGESCHLOSSEN',     'JO7oCPuNkY4cEL7FhpdD',
        'TERMINBUCHUNG',            '3_bOCP6NkY4cEL7FhpdD',
        'LANDING_PAGE_LEAD',        'IfQvCO-NkY4cEL7FhpdD',
        'WIZARD_GESTARTET',         '-m3-CIGOkY4cEL7FhpdD',
        'WIZARD_FAHRZEUGDATEN',     '5BvzCISOkY4cEL7FhpdD'
      ),
      'values', jsonb_build_object(
        'WIZARD_ABGESCHLOSSEN',     9.0,
        'TERMINBUCHUNG',            9.0,
        'KONTAKTFORMULAR_GESENDET', 1.0,
        'WERTERMITTLUNG_LEAD',      2.5,
        'WERTRECHNER_LEAD',         2.5,
        'LANDING_PAGE_LEAD',        1.0,
        'WIZARD_GESTARTET',         1.0,
        'WIZARD_FAHRZEUGDATEN',     1.0,
        'INSTANT_BUY',              0
      )
    ),
    'gtm', jsonb_build_object(
      'enabled', false,
      'container_id', ''
    ),
    'meta_pixel', jsonb_build_object(
      'enabled', true,
      'pixel_id', '1846623132710484'
    ),
    'server_side', jsonb_build_object(
      'gads_offline_conversion_action_id', '7576040066',
      'gads_login_customer_id', '9746508145'
    )
  )
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND (tracking_config IS NULL OR tracking_config = '{}'::jsonb);

-- Recreate public_site_settings view to include tracking_config so the
-- frontend (anon + authenticated) can read it without elevated privileges.
DROP VIEW IF EXISTS public.public_site_settings;
CREATE VIEW public.public_site_settings
WITH (security_invoker = true)
AS SELECT
  id, created_at, updated_at,
  site_name, site_tagline, site_description,
  contact_email, support_phone,
  maintenance_mode, logo_url, favicon_url,
  primary_color, secondary_color, dark_mode_enabled,
  meta_title, meta_description, meta_keywords,
  google_analytics_id, google_tag_manager_id, sitemap_enabled,
  default_auction_duration_days, soft_close_extension_minutes,
  min_bid_increment_percent, commission_rate_percent,
  reserve_price_required, autobid_enabled, buy_now_enabled,
  whatsapp_number, tuv_badge_url,
  company_address, company_city, company_postal_code, company_country,
  ust_id, tax_number, managing_director, hrb_number,
  invoice_footer_text, invoice_payment_terms_days,
  tracking_config
FROM public.site_settings;

GRANT SELECT ON public.public_site_settings TO anon;
GRANT SELECT ON public.public_site_settings TO authenticated;
