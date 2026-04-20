-- ─────────────────────────────────────────────────────────────────────────
-- Photo-Variants für Performance-Optimierung von /kaufen + Detail-Seiten
-- ─────────────────────────────────────────────────────────────────────────
-- Hintergrund:
--   Originale JPEGs sind im Schnitt 150–300 KB groß (3–6 MP iPhone-Fotos).
--   Auf der /kaufen-Seite werden 85 Cover-Fotos auf ~480×320 Pixel angezeigt
--   — dafür reichen ~30 KB. Wir liefern aktuell aber das Original aus.
--   Resultat: 13 MB Bilder-Payload pro Page-Load statt 2–3 MB.
--
--   Die naheliegende Lösung "Supabase Image Transformation" (URL-Param
--   ?width=...) hat im April 2026 die kostenpflichtige Quota überschritten
--   (124% von 100/Monat). Dauerlösung kostet pro 1000 Origin-Bilder $5
--   — bei wachsendem Traffic steigt das exponentiell.
--
-- Architektur dieser Migration:
--   • Wir lagern Bild-Verkleinerung in eine eigene Edge Function aus
--     (`resize-photo-variants`) und persistieren die Ergebnisse.
--   • Pro Foto entstehen 2 zusätzliche Storage-Objekte:
--       - card_url   →  ~480×320, JPEG q80, ~25–40 KB  (Listings/Cards)
--       - medium_url →  ~1024×768, JPEG q82, ~120–180 KB (Detail-Seite)
--   • Die Originale bleiben unangetastet (Backup, hochauflösender Lightbox-View).
--   • Ein Cron-Job (Phase 2) verarbeitet kontinuierlich alle Photos mit
--     processed_at IS NULL — sowohl bestehende ~3000 Fotos als auch
--     zukünftige Uploads.
--
-- Warum NICHT pro Insert-Pfad pre-resizen?
--   Es gibt 4 Stellen, die `motorhome_photos` befüllen (Wizard, Admin,
--   Seller, auto-convert). Jede mit eigenen Auth-/Race-Conditions.
--   Async-Verarbeitung über Cron ist:
--     ✓ idempotent (re-runnable bei Fehlern)
--     ✓ einheitlich (1 Stelle, 4 Anrufer)
--     ✓ macht Originale sofort verfügbar (Fallback `card_url ?? url`)
--
-- Frontend-Verhalten:
--   Während die Variants noch generiert werden, fällt der Helper
--   `getCardPhotoUrl(photo)` auf das Original zurück. Sobald der Cron
--   die Variant produziert hat, wird beim nächsten Page-Load die kleine
--   Variant ausgespielt. Kein UX-Bruch.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.motorhome_photos
  ADD COLUMN IF NOT EXISTS card_url        TEXT,
  ADD COLUMN IF NOT EXISTS medium_url      TEXT,
  ADD COLUMN IF NOT EXISTS processed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Partial-Index: nur die unprozessierten Photos. Cron-Job kann via
-- WHERE processed_at IS NULL AND processing_attempts < 5 effizient picken,
-- ohne über die 3000+ bereits-prozessierten Photos zu scannen.
-- Sortierung nach created_at = älteste zuerst (FIFO-Backfill).
CREATE INDEX IF NOT EXISTS idx_motorhome_photos_unprocessed
  ON public.motorhome_photos (created_at)
  WHERE processed_at IS NULL AND processing_attempts < 5;

COMMENT ON COLUMN public.motorhome_photos.card_url IS
  'Optional. Vorgenertierte ~480x320 JPEG-Variant für Card-Listings (z. B. /kaufen). '
  'NULL = noch nicht prozessiert oder Fehler beim Encoden. Frontend fällt auf url zurück.';

COMMENT ON COLUMN public.motorhome_photos.medium_url IS
  'Optional. Vorgenertierte ~1024x768 JPEG-Variant für Detail-Seite. '
  'NULL = noch nicht prozessiert. Frontend fällt auf url zurück.';

COMMENT ON COLUMN public.motorhome_photos.processed_at IS
  'Zeitstempel der erfolgreichen Variant-Generierung. NULL = noch ausstehend. '
  'Cron-Job processed regelmäßig alle Rows mit processed_at IS NULL.';

COMMENT ON COLUMN public.motorhome_photos.processing_attempts IS
  'Anzahl fehlgeschlagener Versuche. Nach 5 Attempts gibt der Cron-Job auf, '
  'damit ein einzelnes kaputtes Bild nicht den ganzen Worker blockiert.';
