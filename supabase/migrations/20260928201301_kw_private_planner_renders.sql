-- ============================================================================
-- planner-renders privat (28.09.2026)
--
-- KI-Bilder aus dem Planer entstehen seit dem Marktplatz-Umbau im privaten
-- Bucket planner-media und werden nur signiert ausgeliefert (kw-planner,
-- kw-project, Admin). Der Alt-Bucket planner-renders war öffentlich lesbar
-- und ist leer; er wird privat, damit dort nie wieder Raumbilder
-- öffentlich abrufbar werden. Admins behalten Vollzugriff.
-- ============================================================================

update storage.buckets set public = false where id = 'planner-renders';

drop policy if exists "PlannerRenders Storage: public read" on storage.objects;
