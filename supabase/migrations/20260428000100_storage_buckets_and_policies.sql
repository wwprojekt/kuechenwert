-- Storage: Buckets + RLS-Policies aus Caravanwert uebernehmen
--
-- 7 Buckets: branding, invoices, purchase-contracts, dealer-documents,
--            handover-protocols, kitchen-photos (war: motorhome-photos),
--            public-assets
-- 23 Policies auf storage.objects, davon 4 von motorhome-photos -> kitchen-photos
-- umbenannt/umgebogen.
--
-- Alle DROP..IF EXISTS / CREATE .. Statements sind idempotent.

begin;

-- ----------------------------------------------------------------
-- Buckets (idempotent)
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types, type) values
  ('branding',            'branding',            true,  false, 5242880,  array['image/jpeg','image/png','image/svg+xml','image/webp','image/x-icon'], 'STANDARD'),
  ('invoices',            'invoices',            false, false, 10485760, array['application/pdf'], 'STANDARD'),
  ('purchase-contracts',  'purchase-contracts',  false, false, null,     null, 'STANDARD'),
  ('dealer-documents',    'dealer-documents',    false, false, 26214400, array['application/pdf','image/jpeg','image/png','image/jpg','image/heic','image/heif'], 'STANDARD'),
  ('handover-protocols',  'handover-protocols',  false, false, null,     null, 'STANDARD'),
  ('kitchen-photos',      'kitchen-photos',      true,  false, 15728640, array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif'], 'STANDARD'),
  ('public-assets',       'public-assets',       true,  false, 52428800, array['video/mp4','video/webm','video/ogg','image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml'], 'STANDARD')
on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- RLS-Policies auf storage.objects
-- ----------------------------------------------------------------

-- branding
drop policy if exists "Anyone can view branding assets"   on storage.objects;
drop policy if exists "Admins can upload branding assets" on storage.objects;
drop policy if exists "Admins can update branding assets" on storage.objects;
drop policy if exists "Admins can delete branding assets" on storage.objects;

create policy "Anyone can view branding assets"
  on storage.objects for select to public
  using (bucket_id = 'branding');
create policy "Admins can upload branding assets"
  on storage.objects for insert to public
  with check (bucket_id = 'branding' and has_role(auth.uid(), 'admin'::app_role));
create policy "Admins can update branding assets"
  on storage.objects for update to public
  using (bucket_id = 'branding' and has_role(auth.uid(), 'admin'::app_role));
create policy "Admins can delete branding assets"
  on storage.objects for delete to public
  using (bucket_id = 'branding' and has_role(auth.uid(), 'admin'::app_role));

-- invoices
drop policy if exists "Admins can manage invoice files"         on storage.objects;
drop policy if exists "Dealers can view own invoice files"      on storage.objects;
drop policy if exists "Service role can manage all invoice files" on storage.objects;

create policy "Admins can manage invoice files"
  on storage.objects for all to public
  using (bucket_id = 'invoices' and has_role(auth.uid(), 'admin'::app_role))
  with check (bucket_id = 'invoices' and has_role(auth.uid(), 'admin'::app_role));
create policy "Dealers can view own invoice files"
  on storage.objects for select to public
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Service role can manage all invoice files"
  on storage.objects for all to public
  using (bucket_id = 'invoices' and auth.role() = 'service_role')
  with check (bucket_id = 'invoices' and auth.role() = 'service_role');

-- purchase-contracts
drop policy if exists "Admin full access to purchase-contracts"         on storage.objects;
drop policy if exists "Service role full access to purchase-contracts"  on storage.objects;
drop policy if exists "Users can read own purchase-contracts"           on storage.objects;

create policy "Admin full access to purchase-contracts"
  on storage.objects for all to public
  using (bucket_id = 'purchase-contracts' and exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role))
  with check (bucket_id = 'purchase-contracts' and exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
create policy "Service role full access to purchase-contracts"
  on storage.objects for all to public
  using (bucket_id = 'purchase-contracts')
  with check (bucket_id = 'purchase-contracts');
create policy "Users can read own purchase-contracts"
  on storage.objects for select to public
  using (bucket_id = 'purchase-contracts' and (storage.foldername(name))[1] = auth.uid()::text);

-- dealer-documents
drop policy if exists "Admins can view all dealer documents"   on storage.objects;
drop policy if exists "Users can view own dealer documents"    on storage.objects;
drop policy if exists "Users can upload own dealer documents"  on storage.objects;
drop policy if exists "Users can delete own dealer documents"  on storage.objects;

create policy "Admins can view all dealer documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'dealer-documents' and has_role(auth.uid(), 'admin'::app_role));
create policy "Users can view own dealer documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'dealer-documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can upload own dealer documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'dealer-documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own dealer documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'dealer-documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- handover-protocols
drop policy if exists "Admin full access to handover-protocols"         on storage.objects;
drop policy if exists "Service role full access to handover-protocols"  on storage.objects;
drop policy if exists "Users can read own handover-protocols"           on storage.objects;

create policy "Admin full access to handover-protocols"
  on storage.objects for all to public
  using (bucket_id = 'handover-protocols' and exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role))
  with check (bucket_id = 'handover-protocols' and exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
create policy "Service role full access to handover-protocols"
  on storage.objects for all to public
  using (bucket_id = 'handover-protocols')
  with check (bucket_id = 'handover-protocols');
create policy "Users can read own handover-protocols"
  on storage.objects for select to public
  using (bucket_id = 'handover-protocols' and (storage.foldername(name))[1] = auth.uid()::text);

-- kitchen-photos (war: motorhome-photos in Caravanwert)
drop policy if exists "Anyone can view kitchen photos"                 on storage.objects;
drop policy if exists "Authenticated users can upload kitchen photos"  on storage.objects;
drop policy if exists "Users can delete own kitchen photos"            on storage.objects;
drop policy if exists "Users can update own kitchen photos"            on storage.objects;

create policy "Anyone can view kitchen photos"
  on storage.objects for select to public
  using (bucket_id = 'kitchen-photos');
create policy "Authenticated users can upload kitchen photos"
  on storage.objects for insert to public
  with check (bucket_id = 'kitchen-photos' and auth.role() = 'authenticated');
create policy "Users can delete own kitchen photos"
  on storage.objects for delete to public
  using (bucket_id = 'kitchen-photos' and auth.role() = 'authenticated');
create policy "Users can update own kitchen photos"
  on storage.objects for update to public
  using (bucket_id = 'kitchen-photos' and auth.role() = 'authenticated');

-- public-assets
drop policy if exists "public-assets admin write" on storage.objects;
drop policy if exists "public-assets read"        on storage.objects;

create policy "public-assets admin write"
  on storage.objects for all to authenticated
  using (bucket_id = 'public-assets' and exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role))
  with check (bucket_id = 'public-assets' and exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
create policy "public-assets read"
  on storage.objects for select to public
  using (bucket_id = 'public-assets');

commit;
