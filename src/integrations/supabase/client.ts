/**
 * Supabase Client Configuration
 * 
 * Usage: import { supabase } from "@/integrations/supabase/client";
 * 
 * Required environment variables:
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY: Your Supabase anonymous/public key
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Public Supabase config — these keys are PUBLISHABLE (safe to expose, already
// visible in the client bundle). Hardcoded as fallback so the app always boots
// even when env vars aren't wired up by the deployment platform.
// Override in dev/staging via .env.local with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://gzqayoalwtmypndrmqes.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_y310eCMmlhSjvXbOKDgY1Q_p2v56GAz';

// Keine unbekannten Auth-Optionen ergänzen (z. B. `lockAcquireTimeout`):
// supabase-js reicht nur typisierte Felder an den Auth-Client durch, und ein
// Excess-Property-Fehler hier lässt den gesamten Client seine Database-Typen
// verlieren.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
