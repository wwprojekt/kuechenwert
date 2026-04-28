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
    // - dealer_id instead of buyer_id (note: for seller_penalty invoices,
    //   dealer_id stores the SELLER's user id — the column is named dealer
    //   for historical reasons but holds the invoice recipient regardless of role)
    // - payment_status instead of status for payment filtering
    // - removed dunning_level (not in invoices table)
    // - auction_id is a FK in invoices, but for seller_penalty invoices it
    //   may be NULL → we read invoice_type and only join the auction context
    //   when it's a regular commission invoice (otherwise we'd send a
    //   "Wohnmobil"-Fallback that confuses recipients of a Vertragsstrafe).
    // Filter rules:
    // - payment_status IN ('pending','partial'): teilweise bezahlte, aber 3+
    //   Tage überfällige Rechnungen bekommen ebenfalls die weiche Erinnerung.
    //   Vorher `eq('pending')` → Teilzahler fielen durch bis zum formellen
    //   Mahnwesen an Tag 14.
    // - status != 'cancelled': stornierte Rechnungen dürfen niemals eine
    //   Zahlungserinnerung auslösen, selbst wenn payment_status aus Legacy-
    //   Daten noch auf 'pending' steht (Daten-Inkonsistenz-Guard).
    const { data: invoices, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, gross_amount, due_date, dealer_id, invoice_type, payment_reminder_sent,
        auctions:auction_id (
          kitchens:kitchen_id (manufacturer, model, year)
        )
      `)
      .in('payment_status', ['pending', 'partial'])
      .neq('status', 'cancelled')
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
      contact_email: 'info@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    let sent = 0;
    let failed = 0;

    for (const invoice of invoices) {
      try {
        // Get profile of the invoice recipient. For commission invoices this is
        // a dealer; for seller_penalty invoices it's a private seller — same
        // column either way (dealer_id).
        const { data: profile } = await supabase
          .from('profiles')
          .select('salutation, first_name, last_name, company_name, email, customer_number')
          .eq('id', invoice.dealer_id)
          .single();

        if (!profile?.email) continue;

        const isPenalty = invoice.invoice_type === 'seller_penalty';
        // Greeting prefers the proper name. For penalty (private seller):
        // "Vorname Nachname". For commission (dealer): company_name if set,
        // otherwise the personal name. Both fall back to the other side so we
        // never end up with an empty greeting line.
        const personalName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
        const recipientName = isPenalty
          ? (personalName || profile.company_name || '')
          : (profile.company_name || personalName || '');

        // Subject line and headline differ slightly: a private seller hasn't
        // bought anything from us, so calling it a "Rechnung" with vehicle
        // context is misleading.
        const refLabel = isPenalty ? 'Vertragsstrafe' : 'Fahrzeug';
        const kitchen = isPenalty ? null : (invoice.auctions as any)?.kitchens;
        const refValue = isPenalty
          ? 'Vertragsstrafe gem&auml;&szlig; AGB'
          : (kitchen ? `${kitchen.manufacturer} ${kitchen.model} (${kitchen.year})` : 'Vermittlungsprovision');

        const dueDate = new Date(invoice.due_date).toLocaleDateString('de-DE', {
          year: 'numeric', month: 'long', day: 'numeric',
        });

        // FIXED: Use gross_amount instead of amount
        const amount = typeof invoice.gross_amount === 'number'
          ? invoice.gross_amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
          : `${invoice.gross_amount} €`;

        // Absichtlich OHNE das Wort "Zahlungserinnerung": dieses ist
        // gemäß §286 BGB dem Level-1-Mahnschritt in `process-dunning` (Tag 14)
        // vorbehalten. Wäre es auch hier (Tag 3) drin, würden beide Mails im
        // Postfach des Empfängers auf den ersten Blick identisch aussehen
        // und Mail-Clients/Spam-Filter könnten sie de-duplizieren.
        const subject = `Erinnerung: Rechnung ${invoice.invoice_number} – Zahlung noch offen`;
        const emailContent = `
          ${greeting(recipientName || undefined)}
          ${customerBadge(profile.customer_number)}
          ${paragraph(`Wir m&ouml;chten Sie freundlich daran erinnern, dass die folgende Rechnung noch offen ist:`)}
          ${infoBox('Rechnungsdetails', `
            ${detailRow('Rechnung Nr.', invoice.invoice_number)}
            ${detailRow(refLabel, refValue)}
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
            recipient_name: recipientName || null,
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
