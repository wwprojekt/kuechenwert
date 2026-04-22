/**
 * resend-blank-handover-protocol
 *
 * Admin/service-role rescue endpoint to (re-)generate the blank Übergabe-
 * Protokoll for an existing purchase_contracts row and mail it to seller +
 * buyer. Use this when the original sale flow (admin-sell-to-dealer,
 * instant-buy or close-auction) failed to deliver the protocol — for
 * example because `generate-blank-handover-protocol` was undeployed at the
 * time of the sale.
 *
 * Body: { "contractNumber": "KV-2026-00016" }
 *
 * Auth: service_role token OR admin user JWT (checkServiceRoleOrAdmin).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { sendBlankHandoverProtocol } from '../_shared/sendBlankHandoverProtocol.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  let payload: { contractNumber?: string } = {};
  try {
    payload = await req.json();
  } catch {
    /* ignore – validated below */
  }
  const contractNumber = payload?.contractNumber?.trim();
  if (!contractNumber) {
    return new Response(
      JSON.stringify({ error: 'contractNumber is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY missing in environment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ─── 1. Load purchase contract ────────────────────────────────────────
  const { data: contract, error: contractErr } = await supabase
    .from('purchase_contracts')
    .select('contract_number, motorhome_id, buyer_id, seller_id, sale_price')
    .eq('contract_number', contractNumber)
    .maybeSingle();

  if (contractErr || !contract) {
    return new Response(
      JSON.stringify({
        error: `Contract not found: ${contractNumber}`,
        details: contractErr?.message,
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ─── 2. Load motorhome (vehicle name) ────────────────────────────────
  const { data: motorhome } = await supabase
    .from('motorhomes')
    .select('manufacturer, model, year')
    .eq('id', contract.motorhome_id)
    .maybeSingle();

  const vehicleName = [
    motorhome?.manufacturer,
    motorhome?.model,
    motorhome?.year ? `(${motorhome.year})` : '',
  ].filter(Boolean).join(' ').trim() || 'Fahrzeug';

  // ─── 3. Load seller + buyer profiles ─────────────────────────────────
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, company_name')
    .in('id', [contract.seller_id, contract.buyer_id]);

  const sellerProfile = profiles?.find((p: any) => p.id === contract.seller_id) ?? null;
  const buyerProfile = profiles?.find((p: any) => p.id === contract.buyer_id) ?? null;

  // ─── 4. Load site settings ───────────────────────────────────────────
  const { data: settings } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  const settingsData = settings ?? { site_name: 'CaravanWert', contact_email: 'info@caravanwert.de' };

  // ─── 5. Generate + send via shared helper ────────────────────────────
  const result = await sendBlankHandoverProtocol({
    supabase,
    resendApiKey: RESEND_API_KEY,
    settingsData,
    motorhomeId: contract.motorhome_id,
    buyerId: contract.buyer_id,
    sellerId: contract.seller_id,
    contractNumber: contract.contract_number,
    salePrice: Number(contract.sale_price),
    vehicleName,
    sellerProfile,
    buyerProfile,
    source: 'resend-blank-handover-protocol',
  });

  return new Response(
    JSON.stringify({
      contractNumber: contract.contract_number,
      vehicleName,
      sellerEmail: sellerProfile?.email ?? null,
      buyerEmail: buyerProfile?.email ?? null,
      ...result,
    }),
    {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
