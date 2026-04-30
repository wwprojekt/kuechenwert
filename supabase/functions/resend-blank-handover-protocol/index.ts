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
 * Body:
 *   { "contractNumber": "KV-2026-00016" }
 *     → produces PDF + mails to seller + buyer + persists URL on contract.
 *
 *   { "contractNumber": "KV-2026-00016", "testRecipient": "info@example.com" }
 *     → DRY-RUN: generates PDF and mails ONLY to testRecipient.
 *       Does NOT update purchase_contracts and does NOT write admin_emails
 *       (so it can be safely used for previews without polluting state).
 *
 *   { "contractNumber": "KV-2026-00016", "onlyBuyer": true }
 *     → Production-mode but mails ONLY to the buyer (seller is skipped).
 *       Used when a previous run already delivered to seller and we just
 *       need to retry the buyer (e.g. after a Resend rate-limit). Updates
 *       contract URL + writes admin_emails as usual.
 *
 *   { "contractNumber": "KV-2026-00016", "onlySeller": true }
 *     → Same idea, mirrored.
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

  let payload: {
    contractNumber?: string;
    testRecipient?: string;
    onlyBuyer?: boolean;
    onlySeller?: boolean;
  } = {};
  try {
    payload = await req.json();
  } catch {
    /* ignore – validated below */
  }
  const contractNumber = payload?.contractNumber?.trim();
  const testRecipient = payload?.testRecipient?.trim();
  const onlyBuyer = payload?.onlyBuyer === true;
  const onlySeller = payload?.onlySeller === true;
  if (onlyBuyer && onlySeller) {
    return new Response(
      JSON.stringify({ error: 'onlyBuyer and onlySeller are mutually exclusive' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  if (!contractNumber) {
    return new Response(
      JSON.stringify({ error: 'contractNumber is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  if (testRecipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient)) {
    return new Response(
      JSON.stringify({ error: 'testRecipient must be a valid email address' }),
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
    .select('contract_number, kitchen_id, buyer_id, seller_id, sale_price')
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

  // ─── 2. Load kitchen (vehicle name) ────────────────────────────────
  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('manufacturer, model, year')
    .eq('id', contract.kitchen_id)
    .maybeSingle();

  const vehicleName = [
    kitchen?.manufacturer,
    kitchen?.model,
    kitchen?.year ? `(${kitchen.year})` : '',
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

  const settingsData = settings ?? { site_name: 'KuechenWert', contact_email: 'info@kuechenwert24.de' };

  // ─── 5a. TEST MODE: PDF generieren + nur an testRecipient schicken ──
  // Skips DB updates and admin_emails to keep state clean during previews.
  if (testRecipient) {
    try {
      const genRes = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-blank-handover-protocol`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            kitchenId: contract.kitchen_id,
            buyerId: contract.buyer_id,
            sellerId: contract.seller_id,
            contractNumber: contract.contract_number,
            salePrice: Number(contract.sale_price),
          }),
        },
      );
      if (!genRes.ok) {
        const txt = await genRes.text().catch(() => '');
        return new Response(
          JSON.stringify({
            mode: 'test',
            contractNumber: contract.contract_number,
            ok: false,
            info: 'generate failed',
            error: `HTTP ${genRes.status}: ${txt.slice(0, 300)}`,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const genData = await genRes.json().catch(() => null) as any;
      if (!genData?.success || !genData?.pdfBase64) {
        return new Response(
          JSON.stringify({
            mode: 'test',
            contractNumber: contract.contract_number,
            ok: false,
            info: 'generate: unexpected response',
            error: 'no pdfBase64 in response',
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const subject =
        `[TEST] Übergabeprotokoll zum Kaufvertrag ${contract.contract_number} – ${vehicleName}`;
      const filename = `${contract.contract_number}_uebergabeprotokoll.pdf`;
      const fromAddr = `${settingsData.site_name || 'KuechenWert'} <info@kuechenwert24.de>`;
      const html = `
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">
          <p><strong>TEST-Vorschau</strong></p>
          <p>Anbei das Blanko-Übergabeprotokoll, das in der Produktion an Käufer und Verkäufer geht.</p>
          <ul>
            <li><strong>Vertrag:</strong> ${contract.contract_number}</li>
            <li><strong>Fahrzeug:</strong> ${vehicleName}</li>
            <li><strong>Kaufpreis:</strong> €${Number(contract.sale_price).toLocaleString('de-DE')}</li>
            <li><strong>Verkäufer (Original-Empfänger):</strong> ${sellerProfile?.email ?? '–'}</li>
            <li><strong>Käufer (Original-Empfänger):</strong> ${buyerProfile?.email ?? '–'}</li>
          </ul>
          <p>Diese Test-Mail aktualisiert weder den Vertrag noch das Admin-Postfach.</p>
        </div>
      `;

      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [testRecipient],
          subject,
          html,
          attachments: [{ filename, content: genData.pdfBase64 }],
        }),
      });
      if (!sendRes.ok) {
        const txt = await sendRes.text().catch(() => '');
        return new Response(
          JSON.stringify({
            mode: 'test',
            contractNumber: contract.contract_number,
            ok: false,
            info: 'resend send failed',
            error: `HTTP ${sendRes.status}: ${txt.slice(0, 300)}`,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const sendJson = await sendRes.json().catch(() => ({})) as any;

      return new Response(
        JSON.stringify({
          mode: 'test',
          contractNumber: contract.contract_number,
          vehicleName,
          testRecipient,
          originalSellerEmail: sellerProfile?.email ?? null,
          originalBuyerEmail: buyerProfile?.email ?? null,
          ok: true,
          info: 'test mail sent (DB unchanged, no admin_emails row)',
          resendId: sendJson?.id ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch (e: any) {
      return new Response(
        JSON.stringify({
          mode: 'test',
          contractNumber: contract.contract_number,
          ok: false,
          info: 'test mode threw',
          error: e?.message || String(e),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // ─── 5b. PRODUCTION: Generate + send via shared helper ────────────────
  const recipientsArg: 'both' | 'buyer' | 'seller' =
    onlyBuyer ? 'buyer' : (onlySeller ? 'seller' : 'both');
  const result = await sendBlankHandoverProtocol({
    recipients: recipientsArg,
    supabase,
    resendApiKey: RESEND_API_KEY,
    settingsData,
    kitchenId: contract.kitchen_id,
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
