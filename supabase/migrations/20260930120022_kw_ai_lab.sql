-- ============================================================================
-- Modell-Testlauf für /admin/ki (30.09.2026)
--
-- kw_ai_lab_renders: je Testlauf (run_id) ein Bild pro Modell auf demselben
-- Testfoto mit dem aktuellen Prompt (Edge Function kw-ai-lab). So lassen sich
-- neue Modelle und Prompts an echten Räumen vergleichen, bevor Kund:innen sie
-- im A/B-Vergleich sehen. Dateien privat unter planner-media/ai-lab/,
-- Löschung nach 90 Tagen (kw-maintenance, Task retention). Admins lesen und
-- bewerten (Spaltenrecht nur auf rating); alles andere schreibt die Function.
-- ============================================================================

create table if not exists public.kw_ai_lab_renders (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  model_slug text not null,
  photo_path text not null constraint kw_ai_lab_renders_photo_path check (photo_path like 'ai-lab/photos/%'),
  prompt text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'pending' constraint kw_ai_lab_renders_status check (status in ('pending', 'success', 'failed')),
  fal_status_url text,
  fal_response_url text,
  image_path text,
  error_message text,
  cost_cents integer,
  generation_ms integer,
  rating smallint constraint kw_ai_lab_renders_rating check (rating in (-1, 1)),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.kw_ai_lab_renders is
  'Modell-Testlauf (kw-ai-lab): dasselbe Testfoto mit mehreren Bildmodellen; nur eigene, lizenzfreie oder eingewilligte Fotos. Löschung nach 90 Tagen.';

create index if not exists idx_kw_ai_lab_renders_run on public.kw_ai_lab_renders (run_id);
create index if not exists idx_kw_ai_lab_renders_created on public.kw_ai_lab_renders (created_at desc);

alter table public.kw_ai_lab_renders enable row level security;

drop policy if exists "AiLab: admin read" on public.kw_ai_lab_renders;
create policy "AiLab: admin read" on public.kw_ai_lab_renders
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "AiLab: admin rate" on public.kw_ai_lab_renders;
create policy "AiLab: admin rate" on public.kw_ai_lab_renders
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.kw_ai_lab_renders from anon, authenticated;
grant select on public.kw_ai_lab_renders to authenticated;
grant update (rating) on public.kw_ai_lab_renders to authenticated;
grant all on public.kw_ai_lab_renders to service_role;
