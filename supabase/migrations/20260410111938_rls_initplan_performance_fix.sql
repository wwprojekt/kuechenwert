
-- Fix RLS performance: Replace auth.uid() with (select auth.uid()) in all policies
-- This prevents re-evaluation per row, using InitPlan instead
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DO $$
DECLARE
  rec RECORD;
  new_qual text;
  new_wc text;
  pol_cmd text;
  pol_permissive text;
  pol_roles text;
  drop_sql text;
  create_sql text;
  fixed_count int := 0;
BEGIN
  FOR rec IN
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      cmd,
      roles,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%')
        OR
        (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%')
      )
  LOOP
    -- Replace auth.uid() with (select auth.uid())
    new_qual := rec.qual;
    new_wc := rec.with_check;
    
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
    END IF;
    IF new_wc IS NOT NULL THEN
      new_wc := replace(new_wc, 'auth.uid()', '(select auth.uid())');
    END IF;
    
    -- Build command type
    pol_cmd := rec.cmd;
    pol_permissive := CASE WHEN rec.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;
    
    -- Build roles string
    pol_roles := array_to_string(rec.roles, ', ');
    
    -- Drop existing policy
    drop_sql := format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    EXECUTE drop_sql;
    
    -- Create new policy
    create_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      rec.policyname, rec.schemaname, rec.tablename, pol_permissive, pol_cmd, pol_roles);
    
    IF new_qual IS NOT NULL THEN
      create_sql := create_sql || ' USING (' || new_qual || ')';
    END IF;
    IF new_wc IS NOT NULL THEN
      create_sql := create_sql || ' WITH CHECK (' || new_wc || ')';
    END IF;
    
    EXECUTE create_sql;
    fixed_count := fixed_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Fixed % RLS policies', fixed_count;
END;
$$;
