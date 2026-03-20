-- Create site_settings table (singleton pattern)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- General Settings
  site_name text NOT NULL DEFAULT 'CamperAnker24',
  site_tagline text NOT NULL DEFAULT 'Deutschlands führende Wohnmobil-Handelsplattform',
  site_description text NOT NULL DEFAULT 'Verkaufen Sie Ihr Wohnmobil schnell und sicher über unsere innovative Auktions- und Direktverkaufsplattform.',
  contact_email text NOT NULL DEFAULT 'kontakt@camperanker24.de',
  support_phone text NOT NULL DEFAULT '+49 123 456789',
  maintenance_mode boolean NOT NULL DEFAULT false,
  
  -- Branding
  logo_url text,
  favicon_url text,
  primary_color text NOT NULL DEFAULT '25 93 62',
  secondary_color text NOT NULL DEFAULT '210 40 28',
  dark_mode_enabled boolean NOT NULL DEFAULT false,
  
  -- Email Settings
  smtp_host text,
  smtp_port integer DEFAULT 587,
  smtp_user text,
  smtp_password text,
  from_email text NOT NULL DEFAULT 'noreply@camperanker24.de',
  notify_new_registration boolean NOT NULL DEFAULT true,
  notify_new_auction boolean NOT NULL DEFAULT true,
  notify_new_bid boolean NOT NULL DEFAULT true,
  
  -- SEO Settings
  meta_title text NOT NULL DEFAULT 'CamperAnker24 - Wohnmobile kaufen & verkaufen',
  meta_description text NOT NULL DEFAULT 'Verkaufen Sie Ihr Wohnmobil schnell und sicher oder finden Sie Ihr Traumfahrzeug auf Deutschlands führender Handelsplattform. Auktionen & Direktverkauf.',
  meta_keywords text NOT NULL DEFAULT 'wohnmobil verkaufen, wohnmobil kaufen, wohnmobil auktion, camper verkaufen',
  google_analytics_id text,
  google_tag_manager_id text,
  sitemap_enabled boolean NOT NULL DEFAULT true,
  
  -- Auction Settings
  default_auction_duration_days integer NOT NULL DEFAULT 7,
  soft_close_extension_minutes integer NOT NULL DEFAULT 5,
  min_bid_increment_percent numeric NOT NULL DEFAULT 2,
  commission_rate_percent numeric NOT NULL DEFAULT 5,
  reserve_price_required boolean NOT NULL DEFAULT true,
  autobid_enabled boolean NOT NULL DEFAULT true,
  buy_now_enabled boolean NOT NULL DEFAULT true,
  
  -- Ensure only one row exists
  CONSTRAINT single_row CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Insert default settings
INSERT INTO public.site_settings (id)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for branding)
CREATE POLICY "Anyone can view site settings"
  ON public.site_settings
  FOR SELECT
  USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update site settings"
  ON public.site_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for branding bucket
CREATE POLICY "Anyone can view branding assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'branding');

CREATE POLICY "Admins can upload branding assets"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update branding assets"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete branding assets"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));