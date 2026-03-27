import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  try {
    // Auth: Admin-only
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
    }

    const { group } = await req.json();

    let count = 0;
    let label = '';

    switch (group) {
      case 'all': {
        const { count: c } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('email', 'is', null);
        count = c || 0;
        label = 'Alle Benutzer';
        break;
      }
      case 'customers': {
        const { count: c } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'private').not('email', 'is', null);
        count = c || 0;
        label = 'Alle Kunden';
        break;
      }
      case 'dealers': {
        const { count: c } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'dealer').not('email', 'is', null);
        count = c || 0;
        label = 'Alle Händler';
        break;
      }
      case 'verified_dealers': {
        const { count: c } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'dealer').eq('is_verified', true).not('email', 'is', null);
        count = c || 0;
        label = 'Verifizierte Händler';
        break;
      }
      case 'newsletter': {
        const { count: c } = await supabase.from('user_notification_preferences').select('*', { count: 'exact', head: true }).eq('newsletter_enabled', true);
        count = c || 0;
        label = 'Newsletter-Abonnenten';
        break;
      }
      case 'active_bidders': {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: bids } = await supabase.from('bids').select('bidder_id').gte('created_at', thirtyDaysAgo);
        const uniqueIds = new Set((bids || []).map((b: any) => b.bidder_id));
        count = uniqueIds.size;
        label = 'Aktive Bieter (letzte 30 Tage)';
        break;
      }
      default:
        count = 0;
        label = 'Unbekannte Gruppe';
    }

    return new Response(JSON.stringify({ count, label, group }), { status: 200, headers });

  } catch (error: any) {
    console.error("Error getting recipient count:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};

serve(handler);
