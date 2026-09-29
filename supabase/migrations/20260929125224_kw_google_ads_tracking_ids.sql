-- ============================================================================
-- Google Ads: KüchenWert-Konto im Tracking eintragen
-- ============================================================================
--
-- Konto „Küchenwert24.de“ (760-376-7237), Google-Tag AW-18482504226.
-- Die Conversion „Küchenanfrage“ (ID 7806704630: Webseite, Lead-Formular,
-- eine pro Klick, primär) hat kw-google-ads (action "setup") angelegt; ihr
-- Label gehört an KUECHEN_LEAD. Das Google-Tag lädt nur mit
-- Marketing-Einwilligung (public/js/tracking-loader.js). Kontrolle:
-- Admin → Einstellungen → Tracking → Google Ads API – Live-Diagnose.
-- Werte und übrige Labels in tracking_config bleiben unverändert.
-- ============================================================================

update public.site_settings
   set tracking_config = coalesce(tracking_config, '{}'::jsonb)
         || jsonb_build_object(
              'google_ads',
              coalesce(tracking_config -> 'google_ads', '{}'::jsonb)
                || jsonb_build_object(
                     'enabled', true,
                     'conversion_id', 'AW-18482504226',
                     'labels', coalesce(tracking_config #> '{google_ads,labels}', '{}'::jsonb)
                                 || jsonb_build_object('KUECHEN_LEAD', 'PJ2PCPa3w4odEKLEku1E')
                   )
            ),
       updated_at = now()
 where id = '00000000-0000-0000-0000-000000000000';
