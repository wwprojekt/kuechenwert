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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// Support both ANON_KEY and PUBLISHABLE_KEY (they are the same thing)
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your .env file.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Timeout für Lock-Erwerb auf 10 Sekunden setzen.
    // Erhöht von 5s auf 10s um Lock-Steal-Konflikte zu reduzieren,
    // die bei parallelen Auth-Operationen (z.B. getSession + onAuthStateChange)
    // auftreten können. Bei Timeout wird vom SDK (v2.100+) ein sauberer
    // Steal-Fallback mit Cascade-Schutz ausgeführt.
    // Bekannte Supabase-Issues: #2013, #1594, #2111
    lockAcquireTimeout: 10000,
  }
});
