import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { setTrackingConfig, type TrackingConfig } from "@/lib/trackingConfig";

interface SiteSettings {
  id: string;
  site_name: string;
  site_tagline: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
  maintenance_mode: boolean;
  logo_url: string | null;
  favicon_url: string | null;
  tuv_badge_url: string | null;
  primary_color: string;
  secondary_color: string;
  dark_mode_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_password: string | null;
  from_email: string;
  notify_new_registration: boolean;
  notify_new_auction: boolean;
  notify_new_bid: boolean;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  google_analytics_id: string | null;
  google_tag_manager_id: string | null;
  sitemap_enabled: boolean;
  default_auction_duration_days: number;
  soft_close_extension_minutes: number;
  min_bid_increment_percent: number;
  commission_rate_percent: number;
  reserve_price_required: boolean;
  autobid_enabled: boolean;
  buy_now_enabled: boolean;
  whatsapp_number: string | null;
  company_address: string | null;
  company_city: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  // Rechnungseinstellungen
  bank_iban: string | null;
  bank_bic: string | null;
  bank_name: string | null;
  ust_id: string | null;
  tax_number: string | null;
  managing_director: string | null;
  hrb_number: string | null;
  invoice_footer_text: string | null;
  invoice_payment_terms_days: number | null;
  // Mahnwesen-Konfiguration
  dunning_level1_days: number | null;
  dunning_level1_fee: number | null;
  dunning_level2_days: number | null;
  dunning_level2_fee: number | null;
  dunning_level3_days: number | null;
  dunning_level3_fee: number | null;
  dunning_restrict_at_level: number | null;
  dunning_auto_enabled: boolean | null;
  // Centralized tracking configuration (GA4, Google Ads, GTM, Meta Pixel,
  // server-side IDs). Editable via Admin Backend → Einstellungen → Tracking.
  tracking_config: TrackingConfig | null;
}

interface SettingsContextType {
  settings: SiteSettings | null;
  loading: boolean;
  /**
   * Lädt Settings neu. Standard-Aufruf nutzt den Edge-Worker-Cache (5 min FRESH).
   * Wenn der Admin gerade Settings im Backend gespeichert hat und das Ergebnis
   * sofort sehen will, mit `{ forceFresh: true }` aufrufen — das umgeht den
   * Worker und holt direkt aus Supabase, sodass die Änderung 0-Latenz sichtbar ist.
   */
  refreshSettings: (opts?: { forceFresh?: boolean }) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async (opts?: { forceFresh?: boolean }) => {
    const forceFresh = opts?.forceFresh === true;
    try {
      // ─── Hauptpfad: Edge-Cached Worker-Bundle ───────────────────────
      // /api/site-settings liefert die gleichen Spalten wie public_site_settings,
      // aber aus dem CF-KV-Edge-Cache (5 min FRESH / 30 min STALE). Bei
      // ~2.4k Page-Loads/24h spart das ~99% der Supabase-Calls auf diese View.
      // Localhost umgeht den Worker (sonst CORS gegen prod-Worker).
      // forceFresh überspringt den Worker komplett — gedacht für den Admin
      // direkt nach einem Settings-Save, damit die Änderung sofort sichtbar ist.
      let workerData: SiteSettings | null = null;
      if (
        !forceFresh &&
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost"
      ) {
        try {
          const res = await fetch("/api/site-settings", {
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(4000),
          });
          if (res.ok) {
            workerData = (await res.json()) as SiteSettings;
          }
        } catch (e) {
          // Worker timeout / network error → silently fall back to Supabase.
          logger.debug?.("site-settings worker fetch failed, using fallback", e);
        }
      }

      if (workerData) {
        setSettings(workerData);
        applyBranding(workerData);
        setTrackingConfig(
          (workerData as { tracking_config?: unknown }).tracking_config,
        );
        return;
      }

      // ─── Fallback / Force-Fresh: Direkter Supabase-Call ─────────────
      const { data, error } = await supabase
        .from('public_site_settings')
        .select('*')
        .eq('id', SETTINGS_ID)
        .single();

      if (error) throw error;
      
      if (data) {
        setSettings(data as SiteSettings);
        applyBranding(data as SiteSettings);
        // Publish tracking config to a synchronous global so non-React
        // service files (gadsConversionService, etc.) can read it without
        // round-tripping through React state.
        setTrackingConfig((data as { tracking_config?: unknown }).tracking_config);
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyBranding = (settings: SiteSettings) => {
    const root = document.documentElement;
    
    // Apply primary color and create gradient variations
    root.style.setProperty('--primary', settings.primary_color);
    root.style.setProperty('--secondary', settings.secondary_color);
    
    // Parse the HSL values to create gradient variations
    const [h, s, l] = settings.primary_color.split(' ').map(v => parseFloat(v));
    const lightL = Math.min(l + 5, 100);
    const darkL = Math.max(l - 6, 0); // Reduced from -12 to -6 for less contrast
    
    // Create gradient CSS variables using the primary color
    root.style.setProperty('--primary-light', `${h} ${s} ${lightL}`);
    root.style.setProperty('--primary-dark', `${h} ${s} ${darkL}`);
    root.style.setProperty('--gradient-hero', `linear-gradient(135deg, hsl(${h} ${s}% ${lightL}%) 0%, hsl(${h} ${s}% ${darkL}%) 100%)`);
    root.style.setProperty('--gradient-hero-hover', `linear-gradient(135deg, hsl(${h} ${s}% ${lightL + 3}%) 0%, hsl(${h} ${s}% ${darkL + 3}%) 100%)`);
    root.style.setProperty('--shadow-glow', `0 0 32px hsl(${h} ${s}% ${l}% / 0.35)`);
    root.style.setProperty('--shadow-glow-sm', `0 0 16px hsl(${h} ${s}% ${l}% / 0.25)`);
    root.style.setProperty('--ring', settings.primary_color);
    root.style.setProperty('--accent', settings.primary_color);
    
    // Apply dark mode class
    if (settings.dark_mode_enabled) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Note: document.title and meta description are managed per-page by PageLayout's <Helmet>.
    // Do NOT set them here — it would override page-specific SEO tags.
    
    // Update favicon if set
    if (settings.favicon_url) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = settings.favicon_url;
    }
  };

  // Settings ändern sich praktisch nie zur Laufzeit (nur Admin im Backend).
  // Früher gab es einen Realtime-Channel auf `site_settings`, aber die Tabelle
  // ist nicht in der `supabase_realtime` Publication, also hat dieser Channel
  // sowieso nie gefeuert — er hat nur einen Websocket-Slot belegt.
  // Stattdessen: Initial laden, fertig. Wer Settings im Admin ändert, sieht das
  // Ergebnis nach Reload (oder ruft `refreshSettings()` manuell auf).
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: loadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
