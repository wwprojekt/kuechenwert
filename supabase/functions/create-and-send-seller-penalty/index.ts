import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { edgeLogger, logEdgeError } from '../_shared/edgeLogger.ts';

/**
 * Edge Function: create-and-send-seller-penalty
 *
 * Atomic admin action: creates a Vertragsstrafe (€399) for a seller and –
 * unless explicitly suppressed – immediately generates the invoice PDF and
 * mails it to the seller.
 *
 * Why this function exists:
 * Previously the dialog called three things from the browser in sequence:
 *   1. RPC create_seller_penalty_invoice
 *   2. Edge: generate-invoice-pdf
 *   3. Edge: send-invoice-email
 * If the tab/network died between steps the invoice would silently stay as
 * an unsent draft. This function moves the chain server-side and records a
 * single audit_logs entry for the whole action so admins always know who
 * issued which penalty against whom and whether the e-mail went out.
 *
 * Auth: admin role (checked via user JWT) – not service_role, because every
 * call must be attributable to a human admin for audit purposes.
 *
 * Request body:
 * {
 *   sellerId: string (required),
 *   reason: 'anderweitiger_verkauf' | 'vorzeitige_ruecknahme' | 'falsche_angaben',
 *   auctionId?: string,
 *   motorhomeId?: string,
 *   notes?: string,
 *   sendEmail?: boolean (default true)
 * }
 *
 * Response 200:
 * {
 *   success: true,
 *   invoiceId, invoiceNumber,
 *   emailSent, pdfGenerated,
 *   emailError?, recipientEmail
 * }
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface RequestBody {
  sellerId: string;
  reason: 'anderweitiger_verkauf' | 'vorzeitige_ruecknahme' | 'falsche_angaben';
  auctionId?: string | null;
  motorhomeId?: string | null;
  notes?: string | null;
  sendEmail?: boolean;
}

const VALID_REASONS = new Set([
  'anderweitiger_verkauf',
  'vorzeitige_ruecknahme',
  'falsche_angaben',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  // ─── Auth: must be an authenticated admin user ──────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers,
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }
  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  const isAdmin = roles?.some((r: { role: string }) => r.role === 'admin');
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
      status: 403,
      headers,
    });
  }

  // ─── Parse + validate body ──────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers,
    });
  }

  const sellerId = body.sellerId?.trim();
  const reason = body.reason;
  const auctionId = body.auctionId?.trim() || null;
  const motorhomeId = body.motorhomeId?.trim() || null;
  const notes = body.notes?.trim() || null;
  const sendEmail = body.sendEmail !== false;

  if (!sellerId) {
    return new Response(JSON.stringify({ error: 'sellerId ist erforderlich' }), {
      status: 400,
      headers,
    });
  }
  if (!reason || !VALID_REASONS.has(reason)) {
    return new Response(
      JSON.stringify({ error: 'Ungültiger Grund (reason)' }),
      { status: 400, headers },
    );
  }

  // ─── Step 1: Create the invoice via RPC (uses an admin client because
  // the RPC itself enforces has_role(auth.uid(),'admin') – we therefore
  // need the original user JWT, not service_role). ────────────────────────
  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: invoiceId, error: rpcError } = await supabaseAsUser.rpc(
    'create_seller_penalty_invoice',
    {
      seller_id_param: sellerId,
      auction_id_param: auctionId,
      motorhome_id_param: motorhomeId,
      penalty_reason_param: reason,
      notes_param: notes,
    },
  );

  if (rpcError || !invoiceId) {
    edgeLogger.error('create_seller_penalty_invoice RPC failed', rpcError);
    await logEdgeError(supabaseAdmin, {
      component: 'create-and-send-seller-penalty',
      message: 'create_seller_penalty_invoice RPC failed',
      severity: 'high',
      category: 'invoice',
      originalError: rpcError,
      userId: user.id,
      metadata: { sellerId, reason, auctionId, motorhomeId },
    });
    return new Response(
      JSON.stringify({
        error: 'Vertragsstrafe konnte nicht erstellt werden',
        details: rpcError?.message,
      }),
      { status: 500, headers },
    );
  }

  // ─── Fetch invoice context for the audit log + recipient address ────────
  const { data: invoiceRow } = await supabaseAdmin
    .from('invoices')
    .select(
      'invoice_number, gross_amount, dealer_id, dealer:profiles!invoices_dealer_id_fkey(email, first_name, last_name, company_name)',
    )
    .eq('id', invoiceId)
    .single();

  const recipientEmail = invoiceRow?.dealer?.email ?? null;
  const invoiceNumber = invoiceRow?.invoice_number ?? null;

  let pdfGenerated = false;
  let emailSent = false;
  let emailError: string | null = null;

  // ─── Step 2 + 3: PDF + email (best effort, errors don't undo the invoice) ─
  if (sendEmail) {
    let pdfBase64: string | undefined;

    try {
      const pdfRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ invoiceId }),
      });
      if (pdfRes.ok) {
        const pdfJson = await pdfRes.json();
        if (pdfJson?.pdfBase64) {
          pdfBase64 = pdfJson.pdfBase64 as string;
          pdfGenerated = true;
        }
      } else {
        const text = await pdfRes.text();
        edgeLogger.error('PDF generation failed', pdfRes.status, text);
      }
    } catch (e) {
      edgeLogger.error('PDF generation threw', e);
    }

    try {
      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-invoice-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ invoiceId, pdfBase64 }),
      });
      if (emailRes.ok) {
        emailSent = true;
      } else {
        emailError = `${emailRes.status}: ${(await emailRes.text()).slice(0, 200)}`;
        edgeLogger.error('Invoice email failed', emailError);
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
      edgeLogger.error('Invoice email threw', e);
    }

    // Record any silent failure in error_logs so admins notice in the
    // dashboard, not just in function logs.
    if (!emailSent) {
      await logEdgeError(supabaseAdmin, {
        component: 'create-and-send-seller-penalty',
        message: 'Penalty invoice created but email dispatch failed',
        severity: 'high',
        category: 'email',
        originalError: emailError,
        userId: user.id,
        metadata: {
          invoiceId,
          invoiceNumber,
          sellerId,
          recipientEmail,
          pdfGenerated,
        },
      });
    }
  }

  // ─── Audit log entry ────────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'create_seller_penalty',
      entity_type: 'invoice',
      entity_id: String(invoiceId),
      details: {
        invoice_number: invoiceNumber,
        seller_id: sellerId,
        recipient_email: recipientEmail,
        gross_amount: invoiceRow?.gross_amount ?? 399.0,
        penalty_reason: reason,
        auction_id: auctionId,
        motorhome_id: motorhomeId,
        notes,
        send_email_requested: sendEmail,
        email_sent: emailSent,
        email_error: emailError,
        pdf_generated: pdfGenerated,
      },
    });
  } catch (e) {
    edgeLogger.error('audit_logs insert failed', e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      invoiceId,
      invoiceNumber,
      recipientEmail,
      emailSent,
      pdfGenerated,
      emailError,
    }),
    { status: 200, headers },
  );
});
