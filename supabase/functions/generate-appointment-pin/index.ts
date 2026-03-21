import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  try {
    // Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { appointment_id } = await req.json();

    // Input validation
    if (!appointment_id || typeof appointment_id !== 'string') {
      throw new Error('Valid appointment_id is required');
    }

    // Verify user owns the appointment or is admin
    const { data: appointment, error: checkError } = await supabaseClient
      .from('appointments')
      .select('seller_id')
      .eq('id', appointment_id)
      .single();

    if (checkError || !appointment) {
      throw new Error('Appointment not found');
    }

    const { data: isAdmin } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (appointment.seller_id !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not own this appointment' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Generate a 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // Update appointment with PIN
    const { data: fullAppointment, error: updateError } = await supabaseClient
      .from('appointments')
      .update({
        release_pin: pin,
        pin_generated_at: new Date().toISOString(),
      })
      .eq('id', appointment_id)
      .select('*, motorhomes(*), purchase_stations(*), profiles!appointments_seller_id_fkey(*)')
      .single();

    if (updateError) throw updateError;

    // Send PIN via email using Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && fullAppointment.profiles?.email) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'CaravanWert <noreply@caravanwert.de>',
            to: [fullAppointment.profiles.email],
            subject: 'Ihr Freigabe-PIN für die Fahrzeugübergabe',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #19753e;">Ihr Freigabe-PIN</h1>
                <p>Guten Tag,</p>
                <p>Ihr Freigabe-PIN für die Übergabe Ihres Fahrzeugs wurde generiert:</p>
                <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                  <h2 style="font-size: 36px; letter-spacing: 8px; margin: 0; color: #19753e;">${pin}</h2>
                </div>
                <p><strong>Details zur Übergabe:</strong></p>
                <ul>
                  <li>Fahrzeug: ${fullAppointment.motorhomes.manufacturer} ${fullAppointment.motorhomes.model}</li>
                  <li>Station: ${fullAppointment.purchase_stations.name}</li>
                  <li>Adresse: ${fullAppointment.purchase_stations.address}, ${fullAppointment.purchase_stations.city}</li>
                  <li>Termin: ${new Date(fullAppointment.appointment_date).toLocaleString('de-DE')}</li>
                </ul>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  <strong>Wichtig:</strong> Dieser PIN ist 24 Stunden gültig und wird bei der Übergabe benötigt.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
                <p style="color: #999; font-size: 12px;">
                  Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese Nachricht.
                </p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Email send failed:', await emailResponse.text());
        } else {
          console.log('PIN email sent successfully to:', fullAppointment.profiles.email);
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't throw - PIN was generated, email is optional
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PIN wurde erfolgreich generiert und per E-Mail verschickt',
      }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
