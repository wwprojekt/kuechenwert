import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, infoBox, detailRow, amountDisplay, warningBox, customerBadge } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    console.log('Processing payment reminders (Mahnwesen)...');

    // Get site settings
    const { data: settings } = await supabase
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

    // Get overdue invoices
    const { data: overdueInvoices, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email, customer_number),
        reminders:payment_reminders(reminder_level, reminder_date)
      `)
      .eq('payment_status', 'pending')
      .lt('due_date', new Date().toISOString())
      .order('due_date');

    if (fetchError) throw fetchError;

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No overdue invoices found' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const invoice of overdueInvoices) {
      try {
        const daysPastDue = Math.floor(
          (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine reminder level based on configurable days past due
        const level1Days = settingsData.dunning_level1_days ?? 14;
        const level2Days = settingsData.dunning_level2_days ?? 28;
        const level3Days = settingsData.dunning_level3_days ?? 42;
        const level1Fee = settingsData.dunning_level1_fee ?? 5.00;
        const level2Fee = settingsData.dunning_level2_fee ?? 10.00;
        const level3Fee = settingsData.dunning_level3_fee ?? 15.00;
        const restrictAtLevel = settingsData.dunning_restrict_at_level ?? 2;
        const autoEnabled = settingsData.dunning_auto_enabled ?? true;

        // Skip if automatic dunning is disabled
        if (!autoEnabled) {
          continue;
        }

        let reminderLevel = 1;
        let reminderFee = 0;
        
        if (daysPastDue >= level3Days) {
          reminderLevel = 3;
          reminderFee = level3Fee;
        } else if (daysPastDue >= level2Days) {
          reminderLevel = 2;
          reminderFee = level2Fee;
        } else if (daysPastDue >= level1Days) {
          reminderLevel = 1;
          reminderFee = level1Fee;
        } else {
          continue;
        }

        // Check if reminder already sent for this level
        const existingReminder = invoice.reminders?.find(
          (r: any) => r.reminder_level === reminderLevel
        );

        if (existingReminder) {
          if (restrictAtLevel > 0 && reminderLevel >= restrictAtLevel) {
            await restrictDealerAccount(supabase, invoice.dealer_id);
          }
          continue;
        }

        // Create payment reminder
        const subject = getReminderSubject(reminderLevel, invoice.invoice_number);
        const messageBody = getReminderMessage(reminderLevel, invoice, reminderFee);

        const { data: reminder, error: reminderError } = await supabase
          .from('payment_reminders')
          .insert({
            invoice_id: invoice.id,
            reminder_level: reminderLevel,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            original_amount: invoice.gross_amount,
            reminder_fee: reminderFee,
            total_amount: invoice.gross_amount + reminderFee,
            subject: subject,
            message_body: messageBody,
          })
          .select()
          .single();

        if (reminderError) {
          console.error('Error creating reminder:', reminderError);
          continue;
        }

        // Send reminder email
        await sendReminderEmail(invoice, reminder, reminderLevel, settingsData);

        // Restrict account based on configurable level
        if (restrictAtLevel > 0 && reminderLevel >= restrictAtLevel) {
          await restrictDealerAccount(supabase, invoice.dealer_id);
        }

        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          dealerEmail: invoice.dealer.email,
          reminderLevel: reminderLevel,
          daysPastDue: daysPastDue,
          success: true,
        });

      } catch (error: any) {
        console.error(`Error processing invoice ${invoice.invoice_number}:`, error);
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          error: error.message,
          success: false,
        });
      }
    }

    console.log(`Dunning process completed. Processed ${results.length} invoices.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} overdue invoices`,
        results: results,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-dunning:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }

  async function restrictDealerAccount(supabase: any, dealerId: string) {
    try {
      await supabase
        .from('profiles')
        .update({
          account_restricted: true,
          restriction_reason: '\u00dcberf\u00e4llige Zahlung',
          restricted_at: new Date().toISOString(),
        })
        .eq('id', dealerId);
      console.log(`Account restricted for dealer: ${dealerId}`);
    } catch (error) {
      console.error('Error restricting dealer account:', error);
    }
  }

  function getReminderSubject(level: number, invoiceNumber: string): string {
    const subjects: Record<number, string> = {
      1: `Zahlungserinnerung - Rechnung ${invoiceNumber}`,
      2: `1. Mahnung - Rechnung ${invoiceNumber}`,
      3: `2. Mahnung - Rechnung ${invoiceNumber}`,
    };
    return subjects[level] || `Mahnung - Rechnung ${invoiceNumber}`;
  }

  function getReminderMessage(level: number, invoice: any, fee: number): string {
    const dealerName = invoice.dealer.company_name || 
      `${invoice.dealer.first_name} ${invoice.dealer.last_name}`;

    const baseInfo = `Rechnung ${invoice.invoice_number} vom ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')} \u00fcber \u20ac${invoice.gross_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}. Zahlungsziel war der ${new Date(invoice.due_date).toLocaleDateString('de-DE')}.`;

    const messages: Record<number, string> = {
      1: `Sehr geehrte/r ${dealerName},\n\n${baseInfo}\n\nBitte \u00fcberweisen Sie den Betrag zeitnah auf unser Konto.\n\nFalls Sie bereits bezahlt haben, betrachten Sie diese Nachricht als gegenstandslos.`,
      2: `Sehr geehrte/r ${dealerName},\n\n${baseInfo}\n\nDa die Zahlung trotz Erinnerung noch nicht eingegangen ist, berechnen wir eine Mahngeb\u00fchr von \u20ac${fee.toFixed(2)}.\n\nIhr Account wurde eingeschr\u00e4nkt, bis die Zahlung eingegangen ist.`,
      3: `Sehr geehrte/r ${dealerName},\n\n${baseInfo}\n\nDies ist unsere letzte Mahnung. Bei weiterer Nichtzahlung werden wir rechtliche Schritte einleiten.\n\nZus\u00e4tzliche Mahngeb\u00fchr: \u20ac${fee.toFixed(2)}`,
    };

    return messages[level] || messages[1];
  }

  async function sendReminderEmail(invoice: any, reminder: any, level: number, settingsData: any) {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const dealerName = invoice.dealer.company_name || 
      `${invoice.dealer.first_name} ${invoice.dealer.last_name}`;

    const levelTitles: Record<number, string> = {
      1: 'Zahlungserinnerung',
      2: '1. Mahnung',
      3: '2. Mahnung (Letzte Mahnung)',
    };

    const levelVariant = level === 1 ? 'info' as const : 'warning' as const;

    // Build email content with email-builder
    const content = `
      ${paragraph(`Sehr geehrte/r ${dealerName},`)}
      ${customerBadge(invoice.dealer?.customer_number)}
      ${paragraph(`unsere Rechnung <strong>${invoice.invoice_number}</strong> vom ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')} ist noch nicht beglichen.`)}

      ${infoBox('Rechnungsdetails', `
        ${detailRow('Rechnungsnummer', invoice.invoice_number)}
        ${detailRow('Rechnungsdatum', new Date(invoice.invoice_date).toLocaleDateString('de-DE'))}
        ${detailRow('F&auml;lligkeitsdatum', new Date(invoice.due_date).toLocaleDateString('de-DE'))}
        ${detailRow('Rechnungsbetrag', `&euro;${invoice.gross_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`)}
        ${reminder.reminder_fee > 0 ? detailRow('Mahngeb&uuml;hr', `&euro;${reminder.reminder_fee.toFixed(2)}`) : ''}
      `, levelVariant)}

      ${amountDisplay('Zu zahlender Gesamtbetrag', `&euro;${reminder.total_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`)}

      ${level >= 2 ? warningBox('Ihr Account wurde eingeschr&auml;nkt, bis die Zahlung eingegangen ist.') : ''}
      ${level >= 3 ? warningBox('Dies ist unsere letzte Mahnung. Bei weiterer Nichtzahlung werden wir rechtliche Schritte einleiten.') : ''}

      ${infoBox('Bankverbindung', `
        ${detailRow('IBAN', settingsData.bank_iban || 'Bitte in Einstellungen hinterlegen')}
        ${settingsData.bank_bic ? detailRow('BIC', settingsData.bank_bic) : ''}
        ${settingsData.bank_name ? detailRow('Bank', settingsData.bank_name) : ''}
        ${detailRow('Verwendungszweck', invoice.invoice_number)}
      `)}

      ${level === 1 ? paragraph('Falls Sie bereits bezahlt haben, betrachten Sie diese Nachricht als gegenstandslos.') : ''}
      ${paragraph('Mit freundlichen Gr&uuml;&szlig;en<br>Ihr CaravanWert Team')}
    `;

    const emailHtml = buildEmailLayout(settingsData, levelTitles[level] || 'Zahlungserinnerung', content);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name || 'CaravanWert'} <info@caravanwert.de>`,
        to: [invoice.dealer.email],
        subject: reminder.subject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      throw new Error('Failed to send reminder email');
    }

    const resendResult = await resendResponse.json();
    console.log(`${level}. Mahnung sent to ${invoice.dealer.email}`);

    // Log in admin_emails for System tab
    try {
      await supabase.from('admin_emails').insert({
        sender_email: 'info@caravanwert.de',
        sender_name: settingsData.site_name,
        recipient_email: invoice.dealer.email,
        recipient_name: dealerName || null,
        subject: reminder.subject,
        body_html: emailHtml,
        body_text: '',
        email_type: `dunning_level_${level}`,
        direction: 'outbound',
        status: 'sent',
        resend_id: resendResult?.id || null,
        is_read: true,
      });
    } catch (logErr) {
      console.error('Failed to log email in admin_emails:', logErr);
    }
  }
});
