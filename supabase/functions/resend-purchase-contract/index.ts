import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { buildEmailLayout, paragraph, infoBox, detailRow } from '../_shared/email-builder.ts';

/**
 * Edge Function: resend-purchase-contract
 *
 * Re-sends the Kaufvertrag PDF to seller and/or buyer.
 * Downloads the PDF from Supabase Storage and sends with attachment via Resend.
 *
 * Body: { contractId: string, targets?: 'both' | 'seller' | 'buyer' }
 * Auth: service_role or admin
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const authResult = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!authResult.authorized) return authResult.response;

  try {
    const { contractId, targets = 'both' } = await req.json();

    if (!contractId) {
      return new Response(
        JSON.stringify({ error: 'contractId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: contract, error: contractError } = await supabase
      .from('purchase_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: 'Contract not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!contract.storage_path) {
      return new Response(
        JSON.stringify({ error: 'No PDF storage path found for this contract' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Download PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('purchase-contracts')
      .download(contract.storage_path);

    if (downloadError || !pdfData) {
      return new Response(
        JSON.stringify({ error: `Failed to download PDF: ${downloadError?.message || 'No data'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const pdfBase64 = btoa(binaryString);

    // Load profiles
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, company_name')
      .eq('id', contract.seller_id)
      .single();

    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, company_name')
      .eq('id', contract.buyer_id)
      .single();

    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const settingsData = settings || { site_name: 'CaravanWert', contact_email: 'info@caravanwert.de' };
    const vehicleName = contract.vehicle_description || 'Fahrzeug';
    const contractNumber = contract.contract_number;
    const salePrice = `€${Number(contract.sale_price).toLocaleString('de-DE')}`;

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const results: { target: string; email: string; success: boolean; error?: string }[] = [];

    // Send to seller
    if ((targets === 'both' || targets === 'seller') && sellerProfile?.email) {
      try {
        const sellerName = `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Kunde';
        const html = buildEmailLayout(settingsData, 'Ihr Kaufvertrag', `
          ${paragraph(`Hallo ${sellerName},`)}
          ${paragraph('Anbei erhalten Sie den Kaufvertrag für Ihr verkauftes Fahrzeug.')}
          ${infoBox('Vertragsdetails', `
            ${detailRow('Vertragsnr.', contractNumber)}
            ${detailRow('Fahrzeug', vehicleName)}
            ${detailRow('Kaufpreis', salePrice)}
          `, 'success')}
          ${paragraph('Bitte prüfen Sie den Vertrag sorgfältig. Bei Fragen stehen wir Ihnen gerne zur Verfügung.')}
          ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
        `);

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${settingsData.site_name} <info@caravanwert.de>`,
            to: [sellerProfile.email],
            subject: `Kaufvertrag ${contractNumber} – ${vehicleName}`,
            html,
            attachments: [{ filename: `${contractNumber}.pdf`, content: pdfBase64 }],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Resend: ${errText}`);
        }

        const resendResult = await res.json();
        results.push({ target: 'seller', email: sellerProfile.email, success: true });

        // Log in admin_emails
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: sellerProfile.email,
          recipient_name: sellerName,
          subject: `Kaufvertrag ${contractNumber} – ${vehicleName}`,
          body_html: html,
          body_text: '',
          email_type: 'purchase_contract',
          direction: 'outbound',
          status: 'sent',
          resend_id: resendResult?.id || null,
          is_read: false,
        }).then(() => {}).catch((e: any) => console.error('Failed to log seller email:', e));

        console.log('Contract resent to seller:', sellerProfile.email);
      } catch (e: any) {
        console.error('Error resending contract to seller:', e);
        results.push({ target: 'seller', email: sellerProfile.email, success: false, error: e.message });
      }
    }

    // Send to buyer
    if ((targets === 'both' || targets === 'buyer') && buyerProfile?.email) {
      try {
        const buyerName = buyerProfile.company_name
          || `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim()
          || 'Händler';
        const html = buildEmailLayout(settingsData, 'Kaufvertrag', `
          ${paragraph(`Sehr geehrte/r ${buyerName},`)}
          ${paragraph('Anbei erhalten Sie den Kaufvertrag für das erworbene Fahrzeug.')}
          ${infoBox('Vertragsdetails', `
            ${detailRow('Vertragsnr.', contractNumber)}
            ${detailRow('Fahrzeug', vehicleName)}
            ${detailRow('Kaufpreis', salePrice)}
          `, 'success')}
          ${paragraph('Bitte prüfen Sie den Vertrag sorgfältig. Die Rechnung über die Vermittlungsprovision erhalten Sie in einer separaten E-Mail.')}
          ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
        `);

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${settingsData.site_name} <info@caravanwert.de>`,
            to: [buyerProfile.email],
            subject: `Kaufvertrag ${contractNumber} – ${vehicleName}`,
            html,
            attachments: [{ filename: `${contractNumber}.pdf`, content: pdfBase64 }],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Resend: ${errText}`);
        }

        const resendResult = await res.json();
        results.push({ target: 'buyer', email: buyerProfile.email, success: true });

        // Log in admin_emails
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: buyerProfile.email,
          recipient_name: buyerName,
          subject: `Kaufvertrag ${contractNumber} – ${vehicleName}`,
          body_html: html,
          body_text: '',
          email_type: 'purchase_contract',
          direction: 'outbound',
          status: 'sent',
          resend_id: resendResult?.id || null,
          is_read: false,
        }).then(() => {}).catch((e: any) => console.error('Failed to log buyer email:', e));

        console.log('Contract resent to buyer:', buyerProfile.email);
      } catch (e: any) {
        console.error('Error resending contract to buyer:', e);
        results.push({ target: 'buyer', email: buyerProfile.email, success: false, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: results.every(r => r.success),
        contractNumber,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error in resend-purchase-contract:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
