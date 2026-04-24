-- =============================================================================
-- Public assets bucket for marketing media (videos, hero images, etc.)
-- =============================================================================
--
-- Problem: The 12.5 MB explainer video previously lived in `public/videos/` and
-- was shipped inside the production Docker image. This bloated the Dokploy
-- Docker build context and appears to have caused the build to stall after
-- commit f838669 (live chunk hash stayed on index-pE0YpeCT.js, never advanced
-- to the new one). The video never reached /usr/share/nginx/html/videos/ on
-- the origin, so every request to /videos/erklaervideo.mp4 returned HTTP 404.
--
-- Fix: move heavy marketing assets out of the repo and into a dedicated public
-- Supabase Storage bucket. Frontend loads via the Supabase public URL — served
-- from Supabase's Cloudflare CDN at no extra runtime cost to our origin.
--
-- Bucket constraints:
--   - public: true   → anyone can GET (no auth needed for marketing pages)
--   - 50 MB limit    → comfortable headroom above the current 12.5 MB video;
--                      large enough for future explainers but small enough to
--                      prevent accidental misuse (full-length videos belong
--                      elsewhere)
--   - MIME allowlist → only explicit video/image mime types, no arbitrary
--                      uploads
--   - RLS: writes are admin-only; reads are world-readable
-- =============================================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'public-assets',
  'public-assets',
  true,
  52428800,
  array[
    'video/mp4',
    'video/webm',
    'video/ogg',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/svg+xml'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read policy: everyone can read objects in this bucket (it's a public marketing asset).
drop policy if exists "public-assets read" on storage.objects;
create policy "public-assets read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'public-assets');

-- Write policy: only admins may upload / update / delete marketing media.
drop policy if exists "public-assets admin write" on storage.objects;
create policy "public-assets admin write"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'public-assets'
    and exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
    )
  )
  with check (
    bucket_id = 'public-assets'
    and exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
    )
  );
