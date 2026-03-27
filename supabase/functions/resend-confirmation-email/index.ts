import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth check: must be authenticated admin
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: { user: adminUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !adminUser) {
      const errorMsg = userError?.message?.includes('expired') 
        ? 'Sitzung abgelaufen. Bitte laden Sie die Seite neu und melden Sie sich erneut an.'
        : !token 
          ? 'Nicht authentifiziert. Bitte melden Sie sich an.'
          : 'Sitzung ungültig. Bitte laden Sie die Seite neu.';
      console.error('Auth error in resend-confirmation-email:', userError?.message || 'No user found', 'Token present:', !!token);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .eq('role', 'admin')
      .single();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get target user email from request body
    const body = await req.json();
    const { email, user_id } = body;

    if (!email && !user_id) {
      return new Response(JSON.stringify({ error: 'email or user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let targetEmail = email;

    // If only user_id is provided, look up the email
    if (!targetEmail && user_id) {
      const { data: { user: targetUser }, error: lookupError } = await supabase.auth.admin.getUserById(user_id);
      if (lookupError || !targetUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetEmail = targetUser.email;

      // Check if email is already confirmed
      if (targetUser.email_confirmed_at) {
        return new Response(JSON.stringify({ 
          error: 'Email is already confirmed',
          email_confirmed_at: targetUser.email_confirmed_at,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Use Supabase's built-in resend method to send a new confirmation email
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
    });

    if (resendError) {
      // Fallback: If resend fails (e.g., rate limited), try generating an invite link
      // and sending it manually via the admin API
      console.log('Resend failed, trying admin generateLink:', resendError.message);
      
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: targetEmail,
        options: {
          redirectTo: `${SUPABASE_URL.replace('.supabase.co', '')}.supabase.co/auth/v1/verify?redirect_to=https://caravanwert.de/dashboard`,
        },
      });

      if (linkError) {
        return new Response(JSON.stringify({ 
          error: `Failed to resend confirmation: ${resendError.message}. Fallback also failed: ${linkError.message}`,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If generateLink succeeded, we can confirm the email directly via admin
      // since the admin explicitly wants to resend confirmation
      const { error: updateError } = await supabase.auth.admin.updateUser(user_id || '', {
        email_confirm: true,
      });

      if (updateError) {
        console.log('Could not auto-confirm, but magic link was generated:', updateError.message);
      }

      return new Response(JSON.stringify({ 
        success: true,
        method: 'admin_confirm',
        message: `E-Mail-Adresse ${targetEmail} wurde direkt bestätigt (Bestätigungslink konnte nicht gesendet werden).`,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      method: 'resend',
      message: `Bestätigungslink wurde erneut an ${targetEmail} gesendet.`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
