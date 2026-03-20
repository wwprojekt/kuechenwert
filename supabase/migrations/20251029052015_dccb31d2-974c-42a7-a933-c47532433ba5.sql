-- Create purchase_stations table for Ankaufstationen
CREATE TABLE IF NOT EXISTS public.purchase_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  manager_name TEXT,
  accepts_cash_payment BOOLEAN DEFAULT true,
  accepts_sepa_instant BOOLEAN DEFAULT true,
  opening_hours JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorhome_id UUID NOT NULL REFERENCES public.motorhomes(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES public.purchase_stations(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'sepa_instant')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_amount NUMERIC(10, 2),
  release_pin TEXT,
  pin_generated_at TIMESTAMP WITH TIME ZONE,
  handover_protocol_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create station_availability table for calendar management
CREATE TABLE IF NOT EXISTS public.station_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.purchase_stations(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(station_id, day_of_week, start_time)
);

-- Create station_blocked_dates for holidays/closures
CREATE TABLE IF NOT EXISTS public.station_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.purchase_stations(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(station_id, blocked_date)
);

-- Enable RLS
ALTER TABLE public.purchase_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_blocked_dates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_stations
CREATE POLICY "Anyone can view active stations"
  ON public.purchase_stations FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage stations"
  ON public.purchase_stations FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for appointments
CREATE POLICY "Users can view own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Users can create own appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update own appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Admins can manage all appointments"
  ON public.appointments FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for station_availability
CREATE POLICY "Anyone can view availability"
  ON public.station_availability FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage availability"
  ON public.station_availability FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for station_blocked_dates
CREATE POLICY "Anyone can view blocked dates"
  ON public.station_blocked_dates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage blocked dates"
  ON public.station_blocked_dates FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create function to generate release PIN
CREATE OR REPLACE FUNCTION public.generate_release_pin()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  pin TEXT;
BEGIN
  pin := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN pin;
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_purchase_stations_updated_at
  BEFORE UPDATE ON public.purchase_stations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_station_availability_updated_at
  BEFORE UPDATE ON public.station_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();