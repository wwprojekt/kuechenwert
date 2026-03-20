-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'dealer', 'seller');
CREATE TYPE public.motorhome_body_type AS ENUM ('Teilintegriert', 'Alkoven', 'Vollintegriert', 'Kastenwagen', 'Campingbus');
CREATE TYPE public.motorhome_condition AS ENUM ('Neuwertig', 'Sehr gut', 'Gut', 'Befriedigend', 'Reparaturbedürftig');
CREATE TYPE public.sale_channel AS ENUM ('instant_price', 'auction', 'station');
CREATE TYPE public.auction_status AS ENUM ('draft', 'active', 'ended', 'sold', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create motorhomes table
CREATE TABLE public.motorhomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  condition motorhome_condition NOT NULL,
  body_type motorhome_body_type NOT NULL,
  sleeping_places INTEGER NOT NULL,
  has_bathroom BOOLEAN NOT NULL DEFAULT false,
  has_solar BOOLEAN NOT NULL DEFAULT false,
  has_awning BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  sale_channel sale_channel NOT NULL,
  instant_price DECIMAL(10,2),
  reserve_price DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create motorhome_photos table
CREATE TABLE public.motorhome_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorhome_id UUID REFERENCES public.motorhomes(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create auctions table
CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorhome_id UUID REFERENCES public.motorhomes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  starting_bid DECIMAL(10,2) NOT NULL,
  current_bid DECIMAL(10,2),
  reserve_price DECIMAL(10,2),
  status auction_status NOT NULL DEFAULT 'draft',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  soft_close_extension_minutes INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create bids table
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
  bidder_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  is_autobid BOOLEAN NOT NULL DEFAULT false,
  max_autobid_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create storage bucket for motorhome photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('motorhome-photos', 'motorhome-photos', true);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motorhomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motorhome_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for motorhomes
CREATE POLICY "Anyone can view motorhomes"
  ON public.motorhomes FOR SELECT
  USING (true);

CREATE POLICY "Sellers can create own motorhomes"
  ON public.motorhomes FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own motorhomes"
  ON public.motorhomes FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Admins can manage all motorhomes"
  ON public.motorhomes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for motorhome_photos
CREATE POLICY "Anyone can view motorhome photos"
  ON public.motorhome_photos FOR SELECT
  USING (true);

CREATE POLICY "Motorhome owners can manage photos"
  ON public.motorhome_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.motorhomes
      WHERE motorhomes.id = motorhome_photos.motorhome_id
        AND motorhomes.seller_id = auth.uid()
    )
  );

-- RLS Policies for auctions
CREATE POLICY "Anyone can view active auctions"
  ON public.auctions FOR SELECT
  USING (true);

CREATE POLICY "Motorhome owners can create auctions"
  ON public.auctions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.motorhomes
      WHERE motorhomes.id = motorhome_id
        AND motorhomes.seller_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all auctions"
  ON public.auctions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for bids
CREATE POLICY "Users can view all bids"
  ON public.bids FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can place bids"
  ON public.bids FOR INSERT
  WITH CHECK (auth.uid() = bidder_id);

CREATE POLICY "Users can view own bids"
  ON public.bids FOR SELECT
  USING (auth.uid() = bidder_id);

-- Storage policies for motorhome photos
CREATE POLICY "Anyone can view motorhome photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'motorhome-photos');

CREATE POLICY "Authenticated users can upload motorhome photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'motorhome-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own motorhome photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'motorhome-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own motorhome photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'motorhome-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_motorhomes_updated_at
  BEFORE UPDATE ON public.motorhomes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_auctions_updated_at
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  
  -- Assign default 'seller' role to new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'seller');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_motorhomes_seller_id ON public.motorhomes(seller_id);
CREATE INDEX idx_motorhome_photos_motorhome_id ON public.motorhome_photos(motorhome_id);
CREATE INDEX idx_auctions_motorhome_id ON public.auctions(motorhome_id);
CREATE INDEX idx_auctions_status ON public.auctions(status);
CREATE INDEX idx_bids_auction_id ON public.bids(auction_id);
CREATE INDEX idx_bids_bidder_id ON public.bids(bidder_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);