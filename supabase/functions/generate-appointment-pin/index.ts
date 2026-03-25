import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, paragraph, infoBox, detailRow, pinDisplay, list } from '../_shared/email-builder.ts';
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

    // Get site settings
    const { data: settings } = await supabaseClient
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Ihr Wohnmobil-Marktplatz',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '',
    };

    // Send PIN via email using Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && fullAppointment.profiles?.email) {
      try {
        // Build email content with email-builder
        const content = `
          ${paragraph('Guten Tag,')}
          ${paragraph('Ihr Freigabe-PIN f&uuml;r die &Uuml;bergabe Ihres Fahrzeugs wurde generiert:')}

          ${pinDisplay(pin)}

          ${infoBox('Details zur &Uuml;bergabe', `
            ${detailRow('Fahrzeug', `${fullAppointment.motorhomes.manufacturer} ${fullAppointment.motorhomes.model}`)}
            ${detailRow('Station', fullAppointment.purchase_stations.name)}
            ${detailRow('Adresse', `${fullAppointment.purchase_stations.address}, ${fullAppointment.purchase_stations.city}`)}
            ${detailRow('Termin', new Date(fullAppointment.appointment_date).toLocaleString('de-DE'))}
          `, 'info')}

          ${infoBox('', `
            <p style="margin: 0; font-size: 14px; color: #374151;">
              <strong>Wichtig:</strong> Dieser PIN ist 24 Stunden g&uuml;ltig und wird bei der &Uuml;bergabe ben&ouml;tigt.
              Geben Sie diesen PIN niemals an Dritte weiter.
            </p>
          `, 'warning')}
        `;

        const emailHtml = buildEmailLayout(settingsData, 'Ihr Freigabe-PIN', content);

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${settingsData.site_name || 'CaravanWert'} <info@caravanwert.de>`,
            to: [fullAppointment.profiles.email],
            subject: 'Ihr Freigabe-PIN f\u00fcr die Fahrzeug\u00fcbergabe',
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Email send failed:', await emailResponse.text());
        } else {
          console.log('PIN email sent successfully to:', fullAppointment.profiles.email);
          const pinResult = await emailResponse.json();
          // Log in admin_emails for System tab
          try {
            await supabaseClient.from('admin_emails').insert({
              sender_email: 'info@caravanwert.de',
              sender_name: settingsData.site_name || 'CaravanWert',
              recipient_email: fullAppointment.profiles.email,
              recipient_name: fullAppointment.profiles.first_name || null,
              subject: 'Ihr Freigabe-PIN f\u00fcr die Fahrzeug\u00fcbergabe',
              body_html: emailHtml,
              body_text: '',
              email_type: 'appointment_pin',
              direction: 'outbound',
              status: 'sent',
              resend_id: pinResult?.id || null,
              is_read: true,
            });
          } catch (logErr) {
            console.error('Failed to log email in admin_emails:', logErr);
          }
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
