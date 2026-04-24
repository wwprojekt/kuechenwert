-- Insert RPC for value_assessment_leads
--
-- Kontext (Bug 2026-04-24):
-- Die Wertrechner-Seite (Public, unauth/anon) macht ein
--   supabase.from("value_assessment_leads").insert({...}).select("id").single()
-- um die neue Lead-ID zu bekommen (wird spaeter von ai-valuation benoetigt,
-- damit update_ai_valuation die KI-Bewertung auf genau dieses Lead schreibt).
--
-- PostgREST fuehrt bei .select() ein INSERT ... RETURNING * aus. Die RETURNING-
-- Clause triggert im Postgres einen impliziten SELECT-RLS-Check auf die gerade
-- eingefuegte Zeile. value_assessment_leads hat KEINE SELECT-Policy fuer anon
-- (nur "Admins can manage leads"). Daher scheitert die Transaktion mit
--   42501: new row violates row-level security policy for table
--   "value_assessment_leads"
-- obwohl der INSERT selber durch "Anyone can insert leads" (WITH CHECK true)
-- erlaubt waere.
--
-- Die sauberste Loesung ist eine SECURITY DEFINER RPC: sie bypassed RLS fuer den
-- definierten Insert-Pfad und gibt nur die neue id zurueck (keine weiteren
-- sensitiven Lead-Daten). Die public-Rollen bekommen kein breiteres SELECT-
-- Recht auf der Tabelle.
--
-- Sicherheit:
--   - Pflichtfelder werden geprueft (name, email, source).
--   - source wird gegen eine Allow-List validiert.
--   - Free-text wird bei 500 Zeichen hart abgeschnitten (belt + suspenders gegen
--     absurde Payloads; die Frontend-Zod-Schemas sind bereits strenger).
--   - Numerische Wertfelder werden auf realistische Obergrenzen gecheckt.
--   - Keine Ueberschreibung existenter Leads moeglich (reine INSERT-Semantik).

CREATE OR REPLACE FUNCTION public.insert_value_assessment_lead(
  p_name TEXT,
  p_email TEXT,
  p_source TEXT,
  p_phone TEXT DEFAULT NULL,
  p_manufacturer TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_mileage INTEGER DEFAULT NULL,
  p_condition TEXT DEFAULT NULL,
  p_body_type TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_estimated_value_min INTEGER DEFAULT NULL,
  p_estimated_value_max INTEGER DEFAULT NULL,
  p_algorithm_value_min NUMERIC DEFAULT NULL,
  p_algorithm_value_max NUMERIC DEFAULT NULL,
  p_brand_tier TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id UUID;
  v_name TEXT;
  v_email TEXT;
  v_source TEXT;
BEGIN
  -- Trim + Pflichtfeld-Check
  v_name := btrim(COALESCE(p_name, ''));
  v_email := btrim(COALESCE(p_email, ''));
  v_source := btrim(COALESCE(p_source, ''));

  IF v_name = '' THEN
    RAISE EXCEPTION 'name is required' USING ERRCODE = '22023';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'email is required' USING ERRCODE = '22023';
  END IF;
  IF v_source = '' THEN
    RAISE EXCEPTION 'source is required' USING ERRCODE = '22023';
  END IF;

  -- Source allow-list (entspricht den historisch genutzten Werten).
  IF v_source NOT IN ('wertrechner', 'wertermittlung', 'manual') THEN
    RAISE EXCEPTION 'invalid source: %', v_source USING ERRCODE = '22023';
  END IF;

  -- Realistische Obergrenzen fuer numerische Felder (Guard gegen absurde Payloads).
  IF p_year IS NOT NULL AND (p_year < 1950 OR p_year > 2100) THEN
    RAISE EXCEPTION 'invalid year' USING ERRCODE = '22023';
  END IF;
  IF p_mileage IS NOT NULL AND (p_mileage < 0 OR p_mileage > 2000000) THEN
    RAISE EXCEPTION 'invalid mileage' USING ERRCODE = '22023';
  END IF;
  IF p_estimated_value_min IS NOT NULL AND (p_estimated_value_min < 0 OR p_estimated_value_min > 10000000) THEN
    RAISE EXCEPTION 'invalid estimated_value_min' USING ERRCODE = '22023';
  END IF;
  IF p_estimated_value_max IS NOT NULL AND (p_estimated_value_max < 0 OR p_estimated_value_max > 10000000) THEN
    RAISE EXCEPTION 'invalid estimated_value_max' USING ERRCODE = '22023';
  END IF;
  IF p_algorithm_value_min IS NOT NULL AND (p_algorithm_value_min < 0 OR p_algorithm_value_min > 10000000) THEN
    RAISE EXCEPTION 'invalid algorithm_value_min' USING ERRCODE = '22023';
  END IF;
  IF p_algorithm_value_max IS NOT NULL AND (p_algorithm_value_max < 0 OR p_algorithm_value_max > 10000000) THEN
    RAISE EXCEPTION 'invalid algorithm_value_max' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.value_assessment_leads (
    name,
    email,
    phone,
    manufacturer,
    model,
    year,
    mileage,
    condition,
    body_type,
    message,
    source,
    estimated_value_min,
    estimated_value_max,
    algorithm_value_min,
    algorithm_value_max,
    brand_tier,
    vehicle_type
  ) VALUES (
    left(v_name, 500),
    left(v_email, 500),
    CASE WHEN p_phone IS NULL THEN NULL ELSE left(btrim(p_phone), 100) END,
    CASE WHEN p_manufacturer IS NULL THEN NULL ELSE left(btrim(p_manufacturer), 200) END,
    CASE WHEN p_model IS NULL THEN NULL ELSE left(btrim(p_model), 200) END,
    p_year,
    p_mileage,
    CASE WHEN p_condition IS NULL THEN NULL ELSE left(btrim(p_condition), 100) END,
    CASE WHEN p_body_type IS NULL THEN NULL ELSE left(btrim(p_body_type), 100) END,
    CASE WHEN p_message IS NULL THEN NULL ELSE left(btrim(p_message), 2000) END,
    v_source,
    p_estimated_value_min,
    p_estimated_value_max,
    p_algorithm_value_min,
    p_algorithm_value_max,
    CASE WHEN p_brand_tier IS NULL THEN NULL ELSE left(btrim(p_brand_tier), 50) END,
    CASE WHEN p_vehicle_type IS NULL THEN NULL ELSE left(btrim(p_vehicle_type), 50) END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_value_assessment_lead IS
  'Wertrechner/Wertermittlung: sicher Insert in value_assessment_leads fuer anon+authenticated. SECURITY DEFINER umgeht den RLS-RETURNING-Konflikt (anon hat keine SELECT-Policy), gibt nur die neue id zurueck. Eingabe-Validierung via source-Allow-List und numerische Guardrails.';

-- Bestehende anon INSERT-Policy bleibt unberuehrt (Wertermittlung.tsx nutzt noch
-- den direkten .insert() ohne .select() und funktioniert damit weiterhin).
REVOKE ALL ON FUNCTION public.insert_value_assessment_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT,
  INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_value_assessment_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT,
  INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT
) TO anon, authenticated, service_role;
