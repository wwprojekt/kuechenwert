-- Tracking nur mit KüchenWert-eigenen Konten.
-- GA4-Property, Google-Ads-Conversion-Aktionen und Server-Upload-IDs stammten
-- aus der CaravanWert-Vorlage und liefen in deren Konten. GA4 und Google Ads
-- bleiben aus, bis im Admin unter „Tracking“ die KüchenWert-IDs stehen
-- (Label-Key KUECHEN_LEAD für Küchenanfragen aus Funnel A, B und C).
-- Meta-Pixel, GTM und Microsoft Ads bleiben unverändert.

update public.site_settings
set tracking_config = coalesce(tracking_config, '{}'::jsonb)
  || jsonb_build_object(
    'ga4', jsonb_build_object('enabled', false, 'measurement_id', '', 'send_page_view', true),
    'google_ads', jsonb_build_object(
      'enabled', false,
      'conversion_id', '',
      'allow_enhanced_conversions', true,
      'labels', jsonb_build_object('KUECHEN_LEAD', ''),
      'values', jsonb_build_object('KUECHEN_LEAD', 9)
    ),
    'server_side', jsonb_build_object('gads_offline_conversion_action_id', '', 'gads_login_customer_id', '')
  );
