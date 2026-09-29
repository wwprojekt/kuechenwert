-- ============================================================================
-- Google Ads API: Zugangsdaten aus dem Vault für Edge Functions
-- ============================================================================
--
-- `_shared/google-ads.ts` (kw-google-ads, Health-Check in kw-maintenance)
-- nimmt die Edge-Secrets GADS_DEVELOPER_TOKEN, GADS_OAUTH_CLIENT_ID,
-- GADS_OAUTH_CLIENT_SECRET und GADS_OAUTH_REFRESH_TOKEN, sonst den Vault über
-- kw_gads_credentials().
--
-- Voraussetzung außerhalb dieser Datei: Vault-Secrets
--   gads_developer_token      Developer-Token des Verwaltungskontos 974-650-8145
--   gads_oauth_client_id      OAuth-Client (Google Cloud)
--   gads_oauth_client_secret
--   gads_oauth_refresh_token  Refresh-Token (Scope adwords) des Google-Logins
--                             mit Zugriff auf das Konto 760-376-7237
-- Die Werte stehen nie im Repo; ändern über Supabase Dashboard → Vault.
-- ============================================================================

-- SECURITY DEFINER: liest vault.decrypted_secrets; nur service_role.
create or replace function public.kw_gads_credentials()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
    from (
      select distinct on (name)
             substring(name from 6) as key,
             decrypted_secret as value
        from vault.decrypted_secrets
       where name in ('gads_developer_token', 'gads_oauth_client_id',
                      'gads_oauth_client_secret', 'gads_oauth_refresh_token')
       order by name, created_at desc
    ) s;
$$;

revoke execute on function public.kw_gads_credentials() from public, anon, authenticated;
grant execute on function public.kw_gads_credentials() to service_role;
