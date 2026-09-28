// Google Consent Mode v2: Standardwerte setzen, bevor irgendein Google-Tag lädt.
// Wird in index.html als erstes Skript synchron (ohne defer/async) geladen.
// Ausgelagert statt inline, damit die CSP ohne 'unsafe-inline' auskommt.
(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'functionality_storage': 'denied',
    'personalization_storage': 'denied',
    'security_storage': 'granted',
    'wait_for_update': 1500
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);
  try {
    var c = JSON.parse(localStorage.getItem('cookie-consent') || 'null');
    if (c && c.marketing) {
      gtag('set', 'ads_data_redaction', false);
      gtag('consent', 'update', {
        'analytics_storage': c.analytics ? 'granted' : 'denied',
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'functionality_storage': 'granted',
        'personalization_storage': 'granted'
      });
    } else if (c && c.analytics) {
      gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'functionality_storage': 'granted',
        'personalization_storage': 'granted'
      });
    }
  } catch (e) {}
})();
