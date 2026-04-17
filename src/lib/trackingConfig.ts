/**
 * Tracking Configuration Service
 *
 * Single source of truth for runtime tracking IDs (GA4, Google Ads,
 * GTM, Meta Pixel, server-side IDs). Backed by `site_settings.tracking_config`
 * (JSONB) and editable via Admin Backend → Einstellungen → Tracking.
 *
 * - SettingsContext writes the loaded config to `window.__TRACKING_CONFIG__`
 *   on app boot AND on every realtime update. Service files (which are not
 *   React) can therefore read fresh values synchronously via `getTrackingConfig()`.
 * - All accessors fall back to `DEFAULT_TRACKING_CONFIG` (mirrors the values
 *   that are still hardcoded in `index.html`) so tracking continues to work
 *   even if the DB call fails or the column is missing.
 *
 * IMPORTANT: Changes to `ga4.measurement_id`, `google_ads.conversion_id`,
 * `gtm.container_id` and `meta_pixel.pixel_id` only take effect for events
 * fired AFTER the config is reloaded. The deferred loader in `index.html`
 * picks the new IDs up on the next full page load (or via a manual
 * `reloadTrackingScripts()` call from the admin UI).
 */

export type ConversionLabelKey =
  | 'BEWERTUNG_ABGESCHLOSSEN'
  | 'KONTAKTFORMULAR_GESENDET'
  | 'WERTERMITTLUNG_LEAD'
  | 'WERTRECHNER_LEAD'
  | 'WIZARD_ABGESCHLOSSEN'
  | 'TERMINBUCHUNG'
  | 'LANDING_PAGE_LEAD'
  | 'WIZARD_GESTARTET'
  | 'WIZARD_FAHRZEUGDATEN';

export type ConversionValueKey = ConversionLabelKey | 'INSTANT_BUY';

export interface TrackingConfig {
  enabled: boolean;
  ga4: {
    enabled: boolean;
    measurement_id: string;
    send_page_view: boolean;
  };
  google_ads: {
    enabled: boolean;
    conversion_id: string;
    allow_enhanced_conversions: boolean;
    labels: Record<ConversionLabelKey, string>;
    values: Record<ConversionValueKey, number>;
  };
  gtm: {
    enabled: boolean;
    container_id: string;
  };
  meta_pixel: {
    enabled: boolean;
    pixel_id: string;
  };
  server_side: {
    gads_offline_conversion_action_id: string;
    gads_login_customer_id: string;
  };
}

/**
 * Hardcoded fallback. Mirrors the IDs/labels that have been deployed
 * to production – kept in sync with `supabase/migrations/20260417120000_*.sql`.
 */
export const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  enabled: true,
  ga4: {
    enabled: true,
    measurement_id: 'G-H4BCV8DS0B',
    send_page_view: true,
  },
  google_ads: {
    enabled: true,
    conversion_id: 'AW-18033517246',
    allow_enhanced_conversions: true,
    labels: {
      BEWERTUNG_ABGESCHLOSSEN: 'GAI_CI-zrI0cEL7FhpdD',
      KONTAKTFORMULAR_GESENDET: 'pXp5CPKNkY4cEL7FhpdD',
      WERTERMITTLUNG_LEAD: 'AHaxCPWNkY4cEL7FhpdD',
      WERTRECHNER_LEAD: 'JBEqCPiNkY4cEL7FhpdD',
      WIZARD_ABGESCHLOSSEN: 'JO7oCPuNkY4cEL7FhpdD',
      TERMINBUCHUNG: '3_bOCP6NkY4cEL7FhpdD',
      LANDING_PAGE_LEAD: 'IfQvCO-NkY4cEL7FhpdD',
      WIZARD_GESTARTET: '-m3-CIGOkY4cEL7FhpdD',
      WIZARD_FAHRZEUGDATEN: '5BvzCISOkY4cEL7FhpdD',
    },
    values: {
      WIZARD_ABGESCHLOSSEN: 9.0,
      TERMINBUCHUNG: 9.0,
      KONTAKTFORMULAR_GESENDET: 1.0,
      WERTERMITTLUNG_LEAD: 2.5,
      WERTRECHNER_LEAD: 2.5,
      LANDING_PAGE_LEAD: 1.0,
      WIZARD_GESTARTET: 1.0,
      WIZARD_FAHRZEUGDATEN: 1.0,
      BEWERTUNG_ABGESCHLOSSEN: 0,
      INSTANT_BUY: 0,
    },
  },
  gtm: {
    enabled: false,
    container_id: '',
  },
  meta_pixel: {
    enabled: true,
    pixel_id: '1846623132710484',
  },
  server_side: {
    gads_offline_conversion_action_id: '7576040066',
    gads_login_customer_id: '9746508145',
  },
};

declare global {
  interface Window {
    __TRACKING_CONFIG__?: TrackingConfig;
  }
}

const TRACKING_CONFIG_UPDATED_EVENT = 'tracking-config-updated';

/**
 * Deep-merges a partial config from the DB onto the defaults so that
 * missing keys (e.g. when a future field is added) never crash callers.
 */
export function mergeTrackingConfig(partial: unknown): TrackingConfig {
  if (!partial || typeof partial !== 'object') return DEFAULT_TRACKING_CONFIG;
  const p = partial as Partial<TrackingConfig>;
  const d = DEFAULT_TRACKING_CONFIG;

  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : d.enabled,
    ga4: {
      enabled: typeof p.ga4?.enabled === 'boolean' ? p.ga4.enabled : d.ga4.enabled,
      measurement_id: typeof p.ga4?.measurement_id === 'string' && p.ga4.measurement_id.trim()
        ? p.ga4.measurement_id.trim()
        : d.ga4.measurement_id,
      send_page_view: typeof p.ga4?.send_page_view === 'boolean'
        ? p.ga4.send_page_view
        : d.ga4.send_page_view,
    },
    google_ads: {
      enabled: typeof p.google_ads?.enabled === 'boolean' ? p.google_ads.enabled : d.google_ads.enabled,
      conversion_id: typeof p.google_ads?.conversion_id === 'string' && p.google_ads.conversion_id.trim()
        ? p.google_ads.conversion_id.trim()
        : d.google_ads.conversion_id,
      allow_enhanced_conversions: typeof p.google_ads?.allow_enhanced_conversions === 'boolean'
        ? p.google_ads.allow_enhanced_conversions
        : d.google_ads.allow_enhanced_conversions,
      labels: { ...d.google_ads.labels, ...(p.google_ads?.labels ?? {}) } as Record<ConversionLabelKey, string>,
      values: { ...d.google_ads.values, ...(p.google_ads?.values ?? {}) } as Record<ConversionValueKey, number>,
    },
    gtm: {
      enabled: typeof p.gtm?.enabled === 'boolean' ? p.gtm.enabled : d.gtm.enabled,
      container_id: typeof p.gtm?.container_id === 'string' ? p.gtm.container_id.trim() : d.gtm.container_id,
    },
    meta_pixel: {
      enabled: typeof p.meta_pixel?.enabled === 'boolean' ? p.meta_pixel.enabled : d.meta_pixel.enabled,
      pixel_id: typeof p.meta_pixel?.pixel_id === 'string' && p.meta_pixel.pixel_id.trim()
        ? p.meta_pixel.pixel_id.trim()
        : d.meta_pixel.pixel_id,
    },
    server_side: {
      gads_offline_conversion_action_id: typeof p.server_side?.gads_offline_conversion_action_id === 'string'
        ? p.server_side.gads_offline_conversion_action_id.trim()
        : d.server_side.gads_offline_conversion_action_id,
      gads_login_customer_id: typeof p.server_side?.gads_login_customer_id === 'string'
        ? p.server_side.gads_login_customer_id.trim()
        : d.server_side.gads_login_customer_id,
    },
  };
}

/**
 * Returns the currently-active tracking config. Reads from
 * `window.__TRACKING_CONFIG__` (populated by SettingsContext) and falls back
 * to defaults so callers can run before the context has finished loading.
 */
export function getTrackingConfig(): TrackingConfig {
  if (typeof window === 'undefined') return DEFAULT_TRACKING_CONFIG;
  return window.__TRACKING_CONFIG__ ?? DEFAULT_TRACKING_CONFIG;
}

/**
 * Called by SettingsContext when the row is loaded or updated via realtime.
 * Dispatches a `tracking-config-updated` window event so that listeners
 * (e.g. dynamic gtag re-init) can react.
 */
export function setTrackingConfig(partial: unknown): TrackingConfig {
  const merged = mergeTrackingConfig(partial);
  if (typeof window !== 'undefined') {
    window.__TRACKING_CONFIG__ = merged;
    try {
      window.dispatchEvent(new CustomEvent<TrackingConfig>(TRACKING_CONFIG_UPDATED_EVENT, { detail: merged }));
    } catch {
      // CustomEvent unsupported in very old browsers - safe to ignore
    }
  }
  return merged;
}

export function onTrackingConfigUpdated(handler: (cfg: TrackingConfig) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (e: Event) => {
    const ce = e as CustomEvent<TrackingConfig>;
    if (ce.detail) handler(ce.detail);
  };
  window.addEventListener(TRACKING_CONFIG_UPDATED_EVENT, listener);
  return () => window.removeEventListener(TRACKING_CONFIG_UPDATED_EVENT, listener);
}

/**
 * Convenience accessors for the most common values.
 */
export function getGoogleAdsId(): string {
  return getTrackingConfig().google_ads.conversion_id;
}

export function getGa4MeasurementId(): string {
  return getTrackingConfig().ga4.measurement_id;
}

export function getMetaPixelId(): string {
  return getTrackingConfig().meta_pixel.pixel_id;
}

export function getConversionLabel(key: ConversionLabelKey): string {
  const cfg = getTrackingConfig();
  return cfg.google_ads.labels[key] ?? DEFAULT_TRACKING_CONFIG.google_ads.labels[key];
}

export function getConversionValue(key: ConversionValueKey): number {
  const cfg = getTrackingConfig();
  const v = cfg.google_ads.values[key];
  return typeof v === 'number' ? v : DEFAULT_TRACKING_CONFIG.google_ads.values[key];
}

export function isGoogleAdsEnabled(): boolean {
  const cfg = getTrackingConfig();
  return cfg.enabled && cfg.google_ads.enabled;
}

export function isGa4Enabled(): boolean {
  const cfg = getTrackingConfig();
  return cfg.enabled && cfg.ga4.enabled;
}

export function isMetaPixelEnabled(): boolean {
  const cfg = getTrackingConfig();
  return cfg.enabled && cfg.meta_pixel.enabled;
}

export function isGtmEnabled(): boolean {
  const cfg = getTrackingConfig();
  return cfg.enabled && cfg.gtm.enabled && /^GTM-[A-Z0-9]+$/.test(cfg.gtm.container_id);
}
