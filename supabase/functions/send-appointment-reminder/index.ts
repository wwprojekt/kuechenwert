import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, greeting, button, infoBox, detailRow } from '../_shared/email-builder.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Termin-Erinnerung – wird per Cron-Job aufgerufen.
 * Sendet Erinnerungen für Termine die in den nächsten 24h stattfinden.
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find appointments in the next 24 hours that haven't been reminded
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Use correct field names: seller_id (not user_id), appointment_date (contains datetime, no separate appointment_time)
    // reminder_sent may not exist yet (migration pending) - handle gracefully
    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, status, seller_id, reminder_sent,
        kitchens (manufacturer, model, year),
        purchase_stations (name, address, city, postal_code)
      `)
      .gte('appointment_date', now.toISOString())
      .lte('appointment_date', in24h.toISOString())
      .in('status', ['confirmed', 'scheduled']);

    if (fetchError) {
      // If reminder_sent column doesn't exist yet, retry without it
      if (fetchError.message?.includes('reminder_sent')) {
        console.warn('reminder_sent column not found, querying without it');
        const { data: fallbackAppointments, error: fallbackError } = await supabase
          .from('appointments')
          .select(`
            id, appointment_date, status, seller_id,
            kitchens (manufacturer, model, year),
            purchase_stations (name, address, city, postal_code)
          `)
          .gte('appointment_date', now.toISOString())
          .lte('appointment_date', in24h.toISOString())
          .in('status', ['confirmed', 'scheduled']);

        if (fallbackError) {
          throw new Error(`Fetch error: ${fallbackError.message}`);
        }

        // Process without reminder_sent filter - all matching appointments
        return await processAppointments(supabase, fallbackAppointments || [], false);
      }
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    // Filter out already reminded appointments (in case the .neq filter wasn't applied)
    const unreminedAppointments = (appointments || []).filter((apt: any) => !apt.reminder_sent);
    return await processAppointments(supabase, unreminedAppointments, true);

  } catch (error: any) {
    console.error("Error in appointment reminder:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

async function processAppointments(
  supabase: any,
  appointments: any[],
  hasReminderSentColumn: boolean
): Promise<Response> {
  if (!appointments || appointments.length === 0) {
    return new Response(JSON.stringify({ message: "No appointments to remind", count: 0 }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch site settings
  const { data: settings } = await supabase.from('site_settings').select('*').single();
  const settingsData = settings || {
    site_name: 'KuechenWert',
    site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
    contact_email: 'info@kuechenwert.de',
    support_phone: '+49 511 51532476',
  };

  let sent = 0;
  let failed = 0;

  for (const apt of appointments) {
    try {
      // Use seller_id (correct field name) to get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', apt.seller_id)
        .single();

      if (!profile?.email) continue;

      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      const kitchen = apt.kitchens as any;
      const station = apt.purchase_stations as any;

      // appointment_date is a full ISO datetime string (includes time)
      const dateObj = new Date(apt.appointment_date);
      const formattedDate = dateObj.toLocaleDateString('de-DE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const formattedTime = dateObj.toLocaleTimeString('de-DE', {
        hour: '2-digit', minute: '2-digit',
      });

      const subject = `Erinnerung: Ihr Termin in den n\u00e4chsten 24 Stunden bei ${settingsData.site_name}`;
      const emailContent = `
        ${greeting(name || undefined)}
        ${paragraph(`Wir m&ouml;chten Sie an Ihren <strong>bevorstehenden Termin</strong> erinnern:`)}
        ${infoBox('Termindetails', `
          ${detailRow('Datum', formattedDate)}
          ${detailRow('Uhrzeit', formattedTime + ' Uhr')}
          ${kitchen ? detailRow('Fahrzeug', `${kitchen.manufacturer} ${kitchen.model} (${kitchen.year})`) : ''}
          ${station ? detailRow('Station', station.name) : ''}
          ${station?.address ? detailRow('Adresse', `${station.address}, ${station.postal_code} ${station.city}`) : ''}
        `, 'info', settingsData)}
        ${paragraph('<strong>Bitte bringen Sie folgende Unterlagen mit:</strong>')}
        ${paragraph(`
          &bull; Fahrzeugschein (Zulassungsbescheinigung Teil I)<br>
          &bull; Fahrzeugbrief (Zulassungsbescheinigung Teil II)<br>
          &bull; Alle vorhandenen Fahrzeugschl&uuml;ssel<br>
          &bull; Serviceheft / Wartungsnachweise<br>
          &bull; G&uuml;ltiger Personalausweis oder Reisepass
        `)}
        ${button('Termin ansehen', 'https://kuechenwert24.de/dashboard', settingsData)}
        ${paragraph(`Falls Sie den Termin nicht wahrnehmen k&ouml;nnen, kontaktieren Sie uns bitte unter <a href="tel:${settingsData.support_phone.replace(/\s/g, '')}" style="color: #1f8aa2;">${settingsData.support_phone}</a>.`)}
      `;

      const html = buildEmailLayout(settingsData, subject, emailContent);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${settingsData.site_name} <info@kuechenwert.de>`,
          to: [profile.email],
          subject,
          html,
          reply_to: 'info@kuechenwert.de',
        }),
      });

      if (!emailResponse.ok) {
        const error = await emailResponse.text();
        throw new Error(error);
      }

      const resendResult = await emailResponse.json();

      // Log in admin_emails for System tab
      try {
        await supabase.from('admin_emails').insert({
          sender_email: 'info@kuechenwert.de',
          sender_name: settingsData.site_name,
          recipient_email: profile.email,
          recipient_name: name || null,
          subject,
          body_html: html,
          body_text: '',
          email_type: 'appointment_reminder',
          direction: 'outbound',
          status: 'sent',
          resend_id: resendResult?.id || null,
          is_read: true,
        });
      } catch (logErr) {
        console.error('Failed to log email in admin_emails:', logErr);
      }

      // Mark as reminded (only if the column exists)
      if (hasReminderSentColumn) {
        try {
          await supabase
            .from('appointments')
            .update({ reminder_sent: true })
            .eq('id', apt.id);
        } catch (updateErr) {
          console.warn('Could not update reminder_sent:', updateErr);
        }
      }

      sent++;
    } catch (err: any) {
      console.error(`Failed to send reminder for appointment ${apt.id}:`, err.message);
      failed++;
    }
  }

  return new Response(JSON.stringify({
    success: true,
    message: `Reminders sent: ${sent}, failed: ${failed}`,
    sent,
    failed,
  }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

serve(handler);
