import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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
}

interface SettingsContextType {
  settings: SiteSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', SETTINGS_ID)
        .single();

      if (error) throw error;
      
      if (data) {
        setSettings(data as SiteSettings);
        applyBranding(data as SiteSettings);
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

  useEffect(() => {
    let isSubscribed = true; // Track mount state for stale update prevention
    
    loadSettings();

    // Subscribe to settings changes
    const channel = supabase
      .channel('site_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'site_settings',
          filter: `id=eq.${SETTINGS_ID}`
        },
        (payload) => {
          // Guard: Only update if component is still mounted
          if (!isSubscribed) return;
          
          const newSettings = payload.new as SiteSettings;
          setSettings(newSettings);
          applyBranding(newSettings);
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false; // Mark as unmounted
      supabase.removeChannel(channel);
    };
  }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: loadSettings }}>
      {children}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
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
