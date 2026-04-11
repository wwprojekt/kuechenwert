import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, greeting, button, infoBox, detailRow, amountDisplay, customerBadge } from '../_shared/email-builder.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Freundliche Zahlungserinnerung – wird per Cron-Job aufgerufen.
 * Sendet eine Erinnerung 3 Tage nach Fälligkeit, BEVOR das Mahnwesen greift.
 *
 * FIXED: amount → gross_amount (invoices table column)
 * FIXED: buyer_id → dealer_id (invoices table column)
 * FIXED: status = 'pending' → payment_status = 'pending' (invoices uses payment_status)
 * FIXED: dunning_level removed (not a column in invoices)
 * FIXED: auctions join via auction_id FK
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const authCheck = await checkServiceRoleOrAdmin(req);
  if (!authCheck.authorized) return authCheck.response;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find invoices that are 3 days overdue and haven't received a reminder
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // FIXED: Use correct column names from invoices table
    // - gross_amount instead of amount
    // - dealer_id instead of buyer_id
    // - payment_status instead of status for payment filtering
    // - removed dunning_level (not in invoices table)
    // - auction_id is a FK in invoices, so we can join via auctions(motorhomes(...))
    const { data: invoices, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, gross_amount, due_date, dealer_id, payment_reminder_sent,
        auctions:auction_id (
          motorhomes:motorhome_id (manufacturer, model, year)
        )
      `)
      .eq('payment_status', 'pending')
      .lte('due_date', threeDaysAgo.toISOString().split('T')[0])
      .neq('payment_reminder_sent', true);

    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ message: "No payment reminders needed", count: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    let sent = 0;
    let failed = 0;

    for (const invoice of invoices) {
      try {
        // Get dealer profile (FIXED: dealer_id instead of buyer_id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, customer_number')
          .eq('id', invoice.dealer_id)
          .single();

        if (!profile?.email) continue;

        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
        const motorhome = (invoice.auctions as any)?.motorhomes;
        const vehicleStr = motorhome ? `${motorhome.manufacturer} ${motorhome.model} (${motorhome.year})` : 'Wohnmobil';

        const dueDate = new Date(invoice.due_date).toLocaleDateString('de-DE', {
          year: 'numeric', month: 'long', day: 'numeric',
        });

        // FIXED: Use gross_amount instead of amount
        const amount = typeof invoice.gross_amount === 'number'
          ? invoice.gross_amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
          : `${invoice.gross_amount} €`;

        const subject = `Freundliche Zahlungserinnerung – Rechnung ${invoice.invoice_number}`;
        const emailContent = `
          ${greeting(name || undefined)}
          ${customerBadge(profile.customer_number)}
          ${paragraph(`Wir m&ouml;chten Sie freundlich daran erinnern, dass die folgende Rechnung noch offen ist:`)}
          ${infoBox('Rechnungsdetails', `
            ${detailRow('Rechnung Nr.', invoice.invoice_number)}
            ${detailRow('Fahrzeug', vehicleStr)}
            ${detailRow('F&auml;llig seit', dueDate)}
          `, 'info', settingsData)}
          ${amountDisplay('Offener Betrag', amount)}
          ${paragraph('Sollte sich Ihre Zahlung mit dieser Erinnerung &uuml;berschnitten haben, betrachten Sie diese Nachricht bitte als gegenstandslos.')}
          ${paragraph(`Falls Sie Fragen zur Rechnung haben oder eine Ratenzahlung vereinbaren m&ouml;chten, kontaktieren Sie uns gerne unter <a href="mailto:${settingsData.contact_email}" style="color: #1f8aa2;">${settingsData.contact_email}</a> oder telefonisch unter <a href="tel:${settingsData.support_phone.replace(/\s/g, '')}" style="color: #1f8aa2;">${settingsData.support_phone}</a>.`)}
          ${button('Rechnung ansehen', 'https://caravanwert.de/dashboard', settingsData)}
        `;

        const html = buildEmailLayout(settingsData, subject, emailContent);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${settingsData.site_name} <info@caravanwert.de>`,
            to: [profile.email],
            subject,
            html,
            reply_to: 'info@caravanwert.de',
          }),
        });

        if (!emailResponse.ok) {
          const error = await emailResponse.text();
          throw new Error(error);
        }

        const reminderResult = await emailResponse.json();

        // Log in admin_emails for System tab
        try {
          await supabase.from('admin_emails').insert({
            sender_email: 'info@caravanwert.de',
            sender_name: settingsData.site_name,
            recipient_email: profile.email,
            recipient_name: name || null,
            subject,
            body_html: html,
            body_text: '',
            email_type: 'payment_reminder',
            direction: 'outbound',
            status: 'sent',
            resend_id: reminderResult?.id || null,
            is_read: true,
          });
        } catch (logErr) {
          console.error('Failed to log email in admin_emails:', logErr);
        }

        // Mark as reminded
        await supabase
          .from('invoices')
          .update({ payment_reminder_sent: true })
          .eq('id', invoice.id);

        sent++;
      } catch (err: any) {
        console.error(`Failed to send payment reminder for invoice ${invoice.id}:`, err.message);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Payment reminders sent: ${sent}, failed: ${failed}`,
      sent,
      failed,
    }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in payment reminder:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
