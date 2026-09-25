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
  /** Lädt die öffentlichen Settings neu (z. B. nach einem Save im Admin). */
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const CACHE_KEY = "kw-site-settings-v1";

function readCache(): SiteSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SiteSettings) : null;
  } catch {
    return null;
  }
}

function writeCache(settings: SiteSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    /* privater Modus / Speicher voll – Settings kommen beim nächsten Load neu */
  }
}

// Farben und Dark Mode kommen ausschließlich aus index.css bzw. next-themes:
// Die DB-Werte (z. B. "160 32 30" ohne %) sind kein gültiges CSS-HSL und
// würden Dark-Mode-Farben und Akzent überschreiben.
function applyFavicon(settings: SiteSettings) {
  if (!settings.favicon_url) return;
  let favicon = document.querySelector('link[rel="icon"][type="image/svg+xml"], link[rel="icon"]') as HTMLLinkElement | null;
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  favicon.href = settings.favicon_url;
}

function publish(settings: SiteSettings) {
  applyFavicon(settings);
  // Synchroner Global-Zugriff für Tracking-Services außerhalb von React.
  setTrackingConfig((settings as { tracking_config?: unknown }).tracking_config);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(() => readCache());
  const [loading, setLoading] = useState(() => readCache() === null);

  const loadSettings = useCallback(async () => {
    try {
      // site_settings ist nur für Admins lesbar; get_public_site_settings
      // liefert die öffentlichen Spalten (security definer, keine Secrets).
      const { data, error } = await supabase.rpc("get_public_site_settings");
      if (error) throw error;
      if (data && typeof data === "object") {
        const fresh = data as unknown as SiteSettings;
        setSettings(fresh);
        writeCache(fresh);
        publish(fresh);
      }
    } catch (error) {
      logger.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Settings ändern sich praktisch nie zur Laufzeit (nur Admin im Backend).
  // Früher gab es einen Realtime-Channel auf `site_settings`, aber die Tabelle
  // ist nicht in der `supabase_realtime` Publication, also hat dieser Channel
  // sowieso nie gefeuert — er hat nur einen Websocket-Slot belegt.
  // Stattdessen: Initial laden, fertig. Wer Settings im Admin ändert, sieht das
  // Ergebnis nach Reload (oder ruft `refreshSettings()` manuell auf).
  useEffect(() => {
    const cached = readCache();
    if (cached) publish(cached);
    void loadSettings();
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
