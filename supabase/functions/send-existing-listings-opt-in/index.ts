import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { logEdgeError } from '../_shared/edgeLogger.ts';
import { MARKETING_CONFIG } from '../_shared/marketing-config.ts';

/**
 * Edge Function: send-existing-listings-opt-in
 *
 * Phase-4 Audit-Fix #8 (B3 = Bestand-läuft-Alt-Logik-aus + Opt-in-Mail).
 *
 * Einmalige Kampagne für aktive Bestand-Inserate (Auktionen + Festpreise),
 * die VOR Phase-3-Deploy (2026-04-19) erstellt wurden und keinen
 * `seller_initial_reserve` haben (= laufen unter Alt-Logik).
 *
 * Pro Inserat:
 *   1. setzt marketing_phase_max_until = now() + EXISTING_LISTINGS_GRACE_DAYS
 *      (Default 60 Tage). check-expired-auctions erkennt diesen Cap und endet
 *      die Auktion danach mit der seller_soft_brake-Mail (3-Buttons).
 *   2. sendet einmalig die `seller_existing_listing_optin` Info-Mail an
 *      den Verkäufer mit transparenter Ankündigung des Soft-Caps und
 *      Erklärung der Phase-4-Vorteile.
 *
 * Idempotent:
 *   - marketing_phase_max_until wird nur gesetzt, wenn IS NULL (kein
 *     Überschreiben bestehender Phase-4-Inserate).
 *   - Die Mail wird per admin_emails-Probe deduplicated (max 1 pro Inserat
 *     in der gesamten Lifetime).
 *
 * Auth: nur Admins / service-role. Nicht für reguläre User.
 *
 * Body (optional):
 *   { dryRun?: boolean, limit?: number }
 *   - dryRun=true: zeigt nur an, was passieren würde (kein DB-Write, keine Mail)
 *   - limit: maximal N Inserate verarbeiten (Default: alle)
 */

interface RequestBody {
  dryRun?: boolean;
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let body: RequestBody = {};
  try {
    body = await req.json();
  } catch {
    // POST ohne Body ist OK → defaults
  }
  const dryRun = body.dryRun === true;
  const limit = typeof body.limit === 'number' && body.limit > 0 ? body.limit : null;

  try {
    const grace = MARKETING_CONFIG.EXISTING_LISTINGS_GRACE_DAYS;
    const softCapDate = new Date(Date.now() + grace * 24 * 60 * 60 * 1000);
    const softCapDateFmt = softCapDate.toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    // Bestand-Inserate finden:
    //   * status IN ('active', 'kaufchance')
    //   * seller_initial_reserve IS NULL  (Alt-Logik, kein Phase-4)
    //   * marketing_phase_max_until IS NULL  (noch keine Opt-in-Mail erhalten)
    //   * created_at < CUTOVER_DATE  (echtes Bestand, NICHT Pre-P3 Drafts ohne Reserve)
    //
    // Cutover-Datum ist der Phase-3-Deploy: 2026-04-19 00:00:00+00.
    // Inserate, die ab diesem Datum erstellt wurden und noch keinen Anker
    // haben, sind kaputte Drafts (Admin hat sie ohne Reserve aktiviert) —
    // die brauchen Admin-Aufmerksamkeit, KEINE Opt-in-Mail.
    const CUTOVER_DATE = '2026-04-19T00:00:00+00:00';
    let query = supabase
      .from('auctions')
      .select(`
        id, kitchen_id, reserve_price, status, created_at,
        marketing_phase_max_until, seller_initial_reserve,
        kitchens!inner(id, manufacturer, model, sale_channel, seller_id, instant_price, reserve_price)
      `)
      .in('status', ['active', 'kaufchance'])
      .is('seller_initial_reserve', null)
      .is('marketing_phase_max_until', null)
      .lt('created_at', CUTOVER_DATE)
      .order('created_at', { ascending: true });

    if (limit) query = query.limit(limit);

    const { data: bestandListings, error: fetchErr } = await query;
    if (fetchErr) {
      throw new Error(`Fehler beim Laden der Bestand-Inserate: ${fetchErr.message}`);
    }

    const total = bestandListings?.length ?? 0;
    console.log(`[opt-in] found ${total} Bestand-Inserate to process (dryRun=${dryRun})`);

    const results: Array<{
      auctionId: string;
      sellerEmail?: string;
      action: 'sent' | 'skipped_dedup' | 'skipped_no_email' | 'failed' | 'dry_run';
      error?: string;
    }> = [];

    for (const listing of bestandListings ?? []) {
      const mh = (listing.kitchens as any) || {};
      const kitchenName = `${mh.manufacturer || ''} ${mh.model || ''}`.trim();

      try {
        // Effektiven Anker-Preis ermitteln: bei vielen Bestand-Inseraten
        // ist auctions.reserve_price=NULL aber kitchens.reserve_price gesetzt
        // (Pre-P3-Drift). Wir nehmen den ersten verfügbaren Wert.
        const effectiveReserve = (listing.reserve_price && Number(listing.reserve_price) > 0)
          ? Number(listing.reserve_price)
          : (mh.reserve_price && Number(mh.reserve_price) > 0
              ? Number(mh.reserve_price)
              : (mh.instant_price && Number(mh.instant_price) > 0
                  ? Number(mh.instant_price)
                  : null));

        // Skip wenn überhaupt kein Preis-Anker vorhanden ist —
        // diese Inserate sind kaputt und brauchen Admin-Aufmerksamkeit,
        // keine Opt-in-Mail (sonst würde "—" als Preis stehen).
        if (effectiveReserve == null) {
          results.push({
            auctionId: listing.id,
            action: 'skipped_no_email',
            error: 'no reserve/instant price anchor',
          });
          continue;
        }

        if (!mh.seller_id) {
          results.push({ auctionId: listing.id, action: 'skipped_no_email', error: 'seller_id missing' });
          continue;
        }

        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('email, first_name, company_name')
          .eq('id', mh.seller_id)
          .single();

        if (!sellerProfile?.email) {
          results.push({ auctionId: listing.id, action: 'skipped_no_email', error: 'no email on profile' });
          continue;
        }

        // Dedup-Check: schon Opt-in-Mail für diese Auktion gesendet?
        const dedupMarker = `dedup:opt-in:${listing.id}`;
        const { data: alreadySent } = await supabase
          .from('admin_emails')
          .select('id')
          .eq('recipient_email', sellerProfile.email)
          .eq('email_type', 'auction_seller_existing_listing_optin')
          .ilike('body_text', `%${dedupMarker}%`)
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          results.push({ auctionId: listing.id, sellerEmail: sellerProfile.email, action: 'skipped_dedup' });
          continue;
        }

        if (dryRun) {
          results.push({ auctionId: listing.id, sellerEmail: sellerProfile.email, action: 'dry_run' });
          continue;
        }

        // marketing_phase_max_until setzen (Soft-Cap-Stempel)
        // Defensive: nur wenn noch NULL — verhindert Überschreiben von Phase-4
        // Inseraten falls sich der Filter mal ändert.
        const { error: capErr } = await supabase
          .from('auctions')
          .update({
            marketing_phase_max_until: softCapDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', listing.id)
          .is('marketing_phase_max_until', null);
        if (capErr) {
          throw new Error(`Cap-update failed: ${capErr.message}`);
        }

        // Mail mit Dashboard-Link senden
        const dashboardUrl = `https://caravanwert.de/dashboard/listings/${mh.id}`;
        const reserveFmt = `€${effectiveReserve.toLocaleString('de-DE')}`;

        const sellerNameStr = sellerProfile.company_name
          || sellerProfile.first_name
          || sellerProfile.email.split('@')[0];

        const { error: mailErr } = await supabase.functions.invoke('send-auction-notification', {
          body: {
            email: sellerProfile.email,
            name: sellerNameStr,
            type: 'seller_existing_listing_optin',
            kitchenModel: kitchenName,
            auctionUrl: dashboardUrl,
            reservePrice: reserveFmt,
            softCapDate: softCapDateFmt,
            kitchenId: mh.id,
          },
        });
        if (mailErr) {
          // Mail fehlgeschlagen → Cap zurücksetzen, sonst hat der Verkäufer
          // einen Cap ohne Information darüber.
          await supabase
            .from('auctions')
            .update({ marketing_phase_max_until: null })
            .eq('id', listing.id);
          throw new Error(`Mail-invoke failed: ${mailErr.message}`);
        }

        results.push({ auctionId: listing.id, sellerEmail: sellerProfile.email, action: 'sent' });
        console.log(`[opt-in] sent to ${sellerProfile.email} for auction ${listing.id}, soft-cap=${softCapDateFmt}`);

      } catch (e: any) {
        console.error(`[opt-in] failed for auction ${listing.id}:`, e?.message);
        results.push({ auctionId: listing.id, action: 'failed', error: e?.message });
      }
    }

    const summary = {
      total,
      sent: results.filter(r => r.action === 'sent').length,
      dryRun: results.filter(r => r.action === 'dry_run').length,
      skippedDedup: results.filter(r => r.action === 'skipped_dedup').length,
      skippedNoEmail: results.filter(r => r.action === 'skipped_no_email').length,
      failed: results.filter(r => r.action === 'failed').length,
    };
    console.log('[opt-in] summary:', summary);

    if (summary.failed > 0) {
      await logEdgeError(supabase, {
        component: 'send-existing-listings-opt-in',
        message: `Opt-in Kampagne: ${summary.failed} Inserate fehlgeschlagen`,
        severity: summary.failed >= 5 ? 'high' : 'medium',
        category: 'auction',
        metadata: summary,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        softCapDate: softCapDateFmt,
        summary,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: any) {
    console.error('Error in send-existing-listings-opt-in:', error);
    try {
      await logEdgeError(supabase, {
        component: 'send-existing-listings-opt-in',
        message: `Opt-in Kampagne abgebrochen: ${error?.message || 'unbekannt'}`,
        severity: 'critical',
        category: 'auction',
        originalError: error,
      });
    } catch { /* swallow */ }

    return new Response(
      JSON.stringify({ error: error?.message ?? 'unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
