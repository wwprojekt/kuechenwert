-- ==========================================================================
-- Funnel B: erlaube anon + authenticated in lead_files + lead-files bucket
-- ==========================================================================

-- lead_files: anon/auth INSERT (Lead hat gerade submitted)
drop policy if exists "LeadFiles: anon/auth insert" on public.lead_files;
create policy "LeadFiles: anon/auth insert"
  on public.lead_files
  for insert
  to anon, authenticated
  with check (lead_id is not null);

-- storage.objects: anon upload in lead-files bucket
drop policy if exists "LeadFiles Storage: anon upload" on storage.objects;
create policy "LeadFiles Storage: anon upload"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'lead-files');
