-- Härtet das `motorhome-photos` Storage-Bucket gegen Spam / DoS.
--
-- Vorher: file_size_limit = 100 MB. Das ist *deutlich* großzügiger als
--         nötig (selbst unkomprimierte Smartphone-Originale liegen unter
--         15 MB) und stellt einen Vektor für absichtlich riesige Uploads
--         dar — die zwar die /kaufen-Seite NICHT bremsen (dort werden nur
--         480px-card_url's geladen), aber:
--           • den `process-photo`-Worker mit HTTP 546 (WORKER_RESOURCE_LIMIT)
--             killen können (siehe Incident 2026-04-22)
--           • Storage-Speicher und Egress-Bandwidth aufblähen
--
-- Nachher: 15 MB. Reicht großzügig für Hochauflösung-DSLR-JPEGs und
--          unkomprimierte iPhone-HEIC. Die clientseitige Compression in
--          `src/lib/imageCompress.ts` bringt normale Uploads auf ~1-2 MB,
--          15 MB wirken nur als hartes Server-Limit gegen Missbrauch.
--
-- Wichtig: `allowed_mime_types` bleibt unverändert (jpeg, png, webp, gif,
--          heic, heif, avif). Wir wollen iPhone-HEIC weiter erlauben, weil
--          sich Browser-Compress sonst nicht auf alle Geräte aktivieren
--          lässt.

update storage.buckets
set file_size_limit = 15 * 1024 * 1024
where id = 'motorhome-photos';
