-- ============================================================================
-- Funnel C: Ausweichkette statt eines einzelnen Ausweichmodells (28.09.2026)
--
-- Live-Vergleich auf demselben Raumfoto: Nano Banana 2 erhält Tür, Fenster und
-- Perspektive deutlich besser als FLUX.2 Pro Edit, läuft aber wie das
-- Hauptmodell bei Google. Deshalb zwei Stufen: zuerst das Schwestermodell
-- (Kapazitätsproblem eines Modells), dann ein anderer Anbieter (Google-Ausfall,
-- Ablehnung eines Fotos).
--
-- kw_ai_settings.fallback_edit_model_2: zweites Ausweichmodell mit Foto.
-- planner_renders.attempt: Versuch 1–3; der Wechsel ist ein bedingter Update
-- auf (model_slug, attempt), damit parallele Status-Abfragen nie doppelt
-- einreichen.
-- ============================================================================

alter table public.kw_ai_settings
  add column if not exists fallback_edit_model_2 text default 'fal-ai/flux-2-pro/edit';

alter table public.kw_ai_settings alter column fallback_edit_model set default 'fal-ai/nano-banana-2/edit';

alter table public.kw_ai_settings drop constraint if exists kw_ai_settings_model_ids;
alter table public.kw_ai_settings add constraint kw_ai_settings_model_ids check (
  edit_model ~ '^fal-ai/[a-z0-9./-]+$'
  and text_model ~ '^fal-ai/[a-z0-9./-]+$'
  and coalesce(variant_model, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
  and coalesce(fallback_edit_model, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
  and coalesce(fallback_edit_model_2, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
  and coalesce(fallback_text_model, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
  and coalesce(challenger_edit_model, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
);

comment on column public.kw_ai_settings.fallback_edit_model is 'Erstes Ausweichmodell mit Foto (Standard: Schwestermodell des Hauptmodells).';
comment on column public.kw_ai_settings.fallback_edit_model_2 is 'Zweites Ausweichmodell mit Foto (Standard: anderer Anbieter als das Hauptmodell).';

-- Nur umstellen, wenn noch der bisherige Standard eingetragen ist.
update public.kw_ai_settings
   set fallback_edit_model = 'fal-ai/nano-banana-2/edit',
       fallback_edit_model_2 = 'fal-ai/flux-2-pro/edit'
 where id and fallback_edit_model = 'fal-ai/flux-2-pro/edit';

alter table public.planner_renders
  add column if not exists attempt smallint not null default 1;

alter table public.planner_renders drop constraint if exists planner_renders_attempt_check;
alter table public.planner_renders
  add constraint planner_renders_attempt_check check (attempt between 1 and 3);

comment on column public.planner_renders.attempt is 'Versuch 1 = erstes Modell, 2–3 = Ausweichmodelle; fallback_from nennt das erste Modell.';
