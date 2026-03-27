import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Edge Function: check-expired-auctions
 *
 * Scans for active auctions whose end_time has passed and triggers
 * the close-auction function for each one. This is typically called
 * by a cron job (via service_role) or manually by an admin.
 *
 * Auth: Requires either service_role key (cron/internal) or admin role.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  try {
    // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
    const authHeader = req.headers.get('authorization') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isServiceRole = authHeader.includes(serviceRoleKey);

    if (!isServiceRole) {
      // Not a service_role call – check if the caller is an authenticated admin
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Nicht autorisiert: Ungültiger oder fehlender Token' }),
          {
            status: 401,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      // Check admin role
      const { data: roles } = await supabaseAuth
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roles?.some((r) => r.role === 'admin');
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Zugriff verweigert: Admin-Rolle erforderlich' }),
          {
            status: 403,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ─── Main logic ────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking for expired auctions...');

    // Get all active auctions that have ended
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, end_time, status')
      .eq('status', 'active')
      .lt('end_time', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired auctions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredAuctions?.length || 0} expired auctions`);

    if (!expiredAuctions || expiredAuctions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired auctions found',
          closedAuctions: []
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Close each expired auction
    const results = [];
    for (const auction of expiredAuctions) {
      try {
        console.log(`Closing auction ${auction.id}...`);
        
        const { data, error } = await supabase.functions.invoke('close-auction', {
          body: { auctionId: auction.id },
        });

        if (error) {
          console.error(`Error closing auction ${auction.id}:`, error);
          results.push({
            auctionId: auction.id,
            success: false,
            error: error.message,
          });
        } else {
          console.log(`Successfully closed auction ${auction.id}:`, data);
          results.push({
            auctionId: auction.id,
            success: true,
            data,
          });
        }
      } catch (error: any) {
        console.error(`Exception closing auction ${auction.id}:`, error);
        results.push({
          auctionId: auction.id,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Auction closing completed: ${successCount} successful, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${expiredAuctions.length} expired auctions`,
        successCount,
        failCount,
        results,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in check-expired-auctions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
