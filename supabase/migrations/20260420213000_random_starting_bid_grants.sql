-- Grants + Documentation für compute_random_starting_bid (siehe 20260420212000)
-- In separate Migration ausgelagert weil supabase CLI Parser bei
-- CREATE FUNCTION + GRANT/COMMENT in einer Datei "cannot insert multiple
-- commands into a prepared statement" wirft.

REVOKE ALL ON FUNCTION public.compute_random_starting_bid(numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.compute_random_starting_bid(numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.compute_random_starting_bid(numeric) IS
  'Berechnet ein zufaelliges Startgebot zwischen 40-60 Prozent der Reserve, abgerundet auf 50er-Vielfaches. Schuetzt den Reserve-Preis vor Reverse-Engineering durch Haendler.';
