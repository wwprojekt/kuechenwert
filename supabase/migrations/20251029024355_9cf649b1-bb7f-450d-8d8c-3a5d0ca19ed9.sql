-- Get the real admin user ID
DO $$ 
DECLARE 
  admin_user_id UUID;
BEGIN
  -- Get the first user from profiles (your admin)
  SELECT id INTO admin_user_id FROM profiles LIMIT 1;

  -- Insert test motorhomes using the real user
  INSERT INTO public.motorhomes (
    id, seller_id, manufacturer, model, year, mileage, condition, body_type,
    sleeping_places, has_bathroom, has_solar, has_awning, description,
    sale_channel, instant_price, reserve_price
  ) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    admin_user_id,
    'Hymer',
    'B-Klasse ModernComfort',
    2020,
    45000,
    'Sehr gut',
    'Teilintegriert',
    4,
    true,
    true,
    true,
    'Top gepflegtes Wohnmobil mit Vollausstattung. Regelmäßig gewartet, keine Unfälle. Inkl. Winterpaket, Solaranlage und Markise. Nichtraucherfahrzeug.',
    'auction',
    NULL,
    48000
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    admin_user_id,
    'Dethleffs',
    'Globebus I7',
    2019,
    62000,
    'Gut',
    'Alkoven',
    6,
    true,
    false,
    true,
    'Familienfreundliches Alkoven-Wohnmobil mit viel Platz. Ideal für große Familien. TÜV neu, technisch einwandfrei.',
    'auction',
    NULL,
    42000
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    admin_user_id,
    'Knaus',
    'BoxStar Street',
    2021,
    28000,
    'Neuwertig',
    'Kastenwagen',
    2,
    true,
    true,
    false,
    'Kompakter Kastenwagen in Top-Zustand. Perfekt für Paare. Sehr wenig gelaufen, wie neu.',
    'auction',
    NULL,
    55000
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    admin_user_id,
    'Mercedes-Benz',
    'Marco Polo',
    2022,
    15000,
    'Neuwertig',
    'Campingbus',
    4,
    false,
    false,
    false,
    'Premium Campingbus, fast neu. Vollausstattung, alle Extras. Garantie noch gültig.',
    'auction',
    NULL,
    68000
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    admin_user_id,
    'Hobby',
    'Optima V65 GE',
    2018,
    85000,
    'Gut',
    'Vollintegriert',
    4,
    true,
    true,
    true,
    'Vollintegriertes Luxus-Wohnmobil. Sehr gepflegt, regelmäßige Wartung. Viele Extras verbaut.',
    'auction',
    NULL,
    45000
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert test motorhome photos
  INSERT INTO public.motorhome_photos (motorhome_id, photo_url, display_order) VALUES
  -- Hymer photos
  ('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1527786356703-4b100091cd2c?w=800', 0),
  ('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?w=800', 1),
  -- Dethleffs photos
  ('10000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800', 0),
  ('10000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1582055593382-c8c3e9ea6e79?w=800', 1),
  -- Knaus photos
  ('10000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800', 0),
  ('10000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800', 1),
  -- Mercedes photos
  ('10000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1533591380348-14193f1d5f34?w=800', 0),
  ('10000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 1),
  -- Hobby photos
  ('10000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800', 0),
  ('10000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1504006833117-8886a355efbf?w=800', 1)
  ON CONFLICT DO NOTHING;

  -- Insert test auctions for the motorhomes with auction sale channel
  INSERT INTO public.auctions (
    id, motorhome_id, starting_bid, reserve_price, current_bid,
    status, start_time, end_time, soft_close_extension_minutes
  ) VALUES
  -- Active auction ending soon
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    45000,
    48000,
    51000,
    'active',
    NOW() - INTERVAL '6 days',
    NOW() + INTERVAL '2 hours',
    5
  ),
  -- Active auction with more time
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    40000,
    42000,
    43500,
    'active',
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '4 days',
    5
  ),
  -- Active auction just started
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    52000,
    55000,
    52000,
    'active',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '6 days 23 hours',
    5
  ),
  -- Active auction with highest bid
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    65000,
    68000,
    72000,
    'active',
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '2 days',
    5
  ),
  -- Active auction for the Hobby
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    42000,
    45000,
    44000,
    'active',
    NOW() - INTERVAL '2 days',
    NOW() + INTERVAL '5 days',
    5
  )
  ON CONFLICT (id) DO NOTHING;

END $$;