// Tracking-Loader (gtag, Meta Pixel, Microsoft UET) — lädt erst nach Einwilligung.
// Wird am Ende von <body> synchron geladen und läuft damit vor dem App-Bundle
// (type="module" ist deferred): Die Listener stehen, bevor React Events feuert.
//
// Tracking-IDs kommen ausschließlich aus site_settings.tracking_config:
// Die React-App lädt die Zeile und feuert 'tracking-config-updated', der
// Listener unten lädt gtag/fbq nach. Der localStorage-Cache sorgt dafür,
// dass der nächste Seitenaufruf die IDs sofort kennt. Ohne Eintrag in der
// DB wird bewusst nichts geladen.
(function () {
  window.__TRACKING_BOOT__ = {
    ga4: '',
    gads: '',
    gtm: '',
    fb:  '',
    // Microsoft Advertising (Bing) UET — leer bis im Admin-Backend gesetzt.
    // Wenn leer wird KEIN UET-Pixel geladen (siehe loadUet()).
    uet: '',
    loaded: { ga4: '', gads: '', gtm: '', fb: '', uet: '' }
  };

  // Build-Zeit-Prerendering (scripts/prerender.mjs): keine Dienste laden.
  if (window.__KW_PRERENDER__ === true || navigator.userAgent.indexOf('KWPrerender') !== -1) return;

  try {
    var cached = JSON.parse(localStorage.getItem('tracking-config-cache') || 'null');
    if (cached && typeof cached === 'object') {
      if (cached.ga4)  window.__TRACKING_BOOT__.ga4  = String(cached.ga4);
      if (cached.gads) window.__TRACKING_BOOT__.gads = String(cached.gads);
      if (cached.gtm)  window.__TRACKING_BOOT__.gtm  = String(cached.gtm);
      if (cached.fb)   window.__TRACKING_BOOT__.fb   = String(cached.fb);
      if (cached.uet)  window.__TRACKING_BOOT__.uet  = String(cached.uet);
    }
  } catch (e) {}

  function configureGtag(ga4Id, gadsId, sendPageView, allowEnhanced) {
    if (typeof gtag !== 'function') return;
    if (ga4Id && window.__TRACKING_BOOT__.loaded.ga4 !== ga4Id) {
      gtag('config', ga4Id, {
        send_page_view: sendPageView !== false,
        cookie_domain: 'kuechenwert24.de',
        cookie_flags: 'SameSite=Lax;Secure',
      });
      window.__TRACKING_BOOT__.loaded.ga4 = ga4Id;
    }
    if (gadsId && window.__TRACKING_BOOT__.loaded.gads !== gadsId) {
      gtag('config', gadsId, {
        send_page_view: false,
        allow_enhanced_conversions: allowEnhanced !== false,
      });
      window.__TRACKING_BOOT__.loaded.gads = gadsId;
    }
  }

  function loadGtagJs(ga4Id, gadsId, gtmId) {
    // We only need ONE gtag.js script tag – it accepts events for any
    // configured GA4/AW/GTM ID. Load with the GA4 ID (or GTM if no GA4).
    var primary = ga4Id || gtmId || gadsId;
    if (!primary) return;
    var existing = document.querySelector('script[data-tracking-loader="1"]');
    if (existing && existing.getAttribute('data-id') === primary) return;
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var g = document.createElement('script');
    g.async = true;
    g.setAttribute('data-tracking-loader', '1');
    g.setAttribute('data-id', primary);
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(primary);
    g.onload = function() {
      gtag('js', new Date());
      configureGtag(ga4Id, gadsId, true, true);
      if (gtmId && /^GTM-[A-Z0-9]+$/.test(gtmId)) {
        // GTM container – loaded via gtag.js syntax (works for both GA4 + GTM)
        gtag('config', gtmId);
      }
    };
    document.head.appendChild(g);
  }

  function loadFbq(pixelId) {
    if (!pixelId) return;
    if (window.__TRACKING_BOOT__.loaded.fb === pixelId) return;
    try {
      if (typeof fbq !== 'function') {
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      }
      if (typeof fbq === 'function') {
        fbq('consent','revoke');
        fbq('init', pixelId);
        window.__TRACKING_BOOT__.loaded.fb = pixelId;
      }
    } catch (e) {}
  }

  // Microsoft Advertising (Bing) UET — analog zu Meta Pixel.
  // - Wird nur geladen wenn `tagId` gesetzt UND Marketing-Consent gegeben.
  // - Idempotent: gleiche tagId zweimal aufrufen lädt das Pixel nicht doppelt.
  // - DSGVO: nur mit Marketing-Einwilligung (hasMarketingConsent()).
  function loadUet(tagId) {
    if (!tagId) return;
    if (window.__TRACKING_BOOT__.loaded.uet === tagId) return;
    if (!hasMarketingConsent()) return;
    try {
      // UET-Pixel-Loader (Microsoft Standard-Snippet, nur Tag-ID dynamisch).
      // Initialisiert window.uetq als Push-Queue und lädt bat.js asynchron.
      (function(w,d,t,r,u){
        var f,n,i;
        w[u]=w[u]||[];
        f=function(){
          var o={ti: tagId, enableAutoSpaTracking: true};
          o.q=w[u];
          w[u]=new w.UET(o);
          w[u].push("pageLoad");
        };
        n=d.createElement(t);
        n.src=r;
        n.async=1;
        n.onload=n.onreadystatechange=function(){
          var s=this.readyState;
          if(s && s!=="loaded" && s!=="complete") return;
          f();
          n.onload=n.onreadystatechange=null;
        };
        i=d.getElementsByTagName(t)[0];
        i.parentNode.insertBefore(n,i);
      })(window,document,"script","//bat.bing.com/bat.js","uetq");
      window.__TRACKING_BOOT__.loaded.uet = tagId;
    } catch (e) {}
  }

  function hasMarketingConsent() {
    try {
      var c = JSON.parse(localStorage.getItem('cookie-consent') || 'null');
      return !!(c && c.marketing);
    } catch (e) { return false; }
  }

  function hasAnalyticsConsent() {
    try {
      var c = JSON.parse(localStorage.getItem('cookie-consent') || 'null');
      return !!(c && c.analytics);
    } catch (e) { return false; }
  }

  // Google-Tag und Meta-Pixel werden erst nach Einwilligung geladen
  // (Basic Consent Mode): vorher geht keine Anfrage an Google oder Meta.
  function applyTracking() {
    var b = window.__TRACKING_BOOT__;
    var marketing = hasMarketingConsent();
    if (marketing || hasAnalyticsConsent()) {
      var gtagLoaded = !!document.querySelector('script[data-tracking-loader="1"]');
      if (!gtagLoaded || (b.ga4 && b.loaded.ga4 !== b.ga4)) {
        loadGtagJs(b.ga4, b.gads, b.gtm);
      } else {
        configureGtag(b.ga4, b.gads, true, true);
      }
    }
    if (marketing) loadFbq(b.fb);
    loadUet(b.uet);
  }

  function loadDeferredScripts() {
    applyTracking();
  }

  // Einwilligung im Cookie-Banner oder in den Cookie-Einstellungen
  // (CookieBanner.tsx, CookieSettingsModal.tsx) lädt die Dienste nach.
  window.addEventListener('consent-updated', function () {
    try { applyTracking(); } catch (e) {}
  });

  // Die React-App meldet die Tracking-IDs aus site_settings.tracking_config.
  // Sie werden für den nächsten Seitenaufruf gecacht; geladen wird nur mit
  // Einwilligung (applyTracking).
  window.addEventListener('tracking-config-updated', function (e) {
    try {
      var cfg = (e && e.detail) || null;
      if (!cfg) return;
      // Abgeschaltete Dienste zählen wie fehlende IDs.
      var on = cfg.enabled !== false;
      var newIds = {
        ga4:  on && cfg.ga4 && cfg.ga4.enabled !== false && cfg.ga4.measurement_id ? String(cfg.ga4.measurement_id) : '',
        gads: on && cfg.google_ads && cfg.google_ads.enabled !== false && cfg.google_ads.conversion_id
                ? String(cfg.google_ads.conversion_id) : '',
        gtm:  on && cfg.gtm && cfg.gtm.enabled && cfg.gtm.container_id ? String(cfg.gtm.container_id) : '',
        fb:   on && cfg.meta_pixel && cfg.meta_pixel.enabled !== false && cfg.meta_pixel.pixel_id
                ? String(cfg.meta_pixel.pixel_id) : '',
        uet:  on && cfg.microsoft_ads && cfg.microsoft_ads.enabled && cfg.microsoft_ads.uet_tag_id
                ? String(cfg.microsoft_ads.uet_tag_id) : ''
      };
      try { localStorage.setItem('tracking-config-cache', JSON.stringify(newIds)); } catch (err) {}
      var b = window.__TRACKING_BOOT__;
      b.ga4 = newIds.ga4;
      b.gads = newIds.gads;
      b.gtm = newIds.gtm;
      b.fb = newIds.fb;
      b.uet = newIds.uet;
      applyTracking();
    } catch (err) {}
  });

  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadDeferredScripts, { timeout: 3000 });
  } else {
    setTimeout(loadDeferredScripts, 1500);
  }
})();
