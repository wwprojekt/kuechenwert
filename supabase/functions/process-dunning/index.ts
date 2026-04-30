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
    // ─── Initialize Supabase client ──────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ─── Parse body for optional single-invoice mode ────────────
    // Two call paths share this function:
    //   1. Cron (daily): no body / empty body  → batch-process all overdue
    //      invoices honouring `dunning_auto_enabled`.
    //   2. Admin UI: `{ invoiceId: "..." }`    → process exactly one invoice,
    //      bypassing the auto-enabled toggle (manual = explicit consent).
    // Without a single-invoice mode the previous code processed ALL overdue
    // invoices on every UI click, which mass-mailed dealers and triggered
    // unintended account restrictions.
    let requestedInvoiceId: string | null = null;
    try {
      const raw = await req.text();
      if (raw && raw.trim().length > 0) {
        const body = JSON.parse(raw);
        if (body && typeof body.invoiceId === 'string' && body.invoiceId.trim()) {
          requestedInvoiceId = body.invoiceId.trim();
        }
      }
    } catch {
      // Ignore: cron passes '{}'::jsonb which parses fine; malformed body
      // simply falls back to batch mode.
    }
    const singleMode = requestedInvoiceId !== null;

    console.log(
      singleMode
        ? `Processing dunning for single invoice ${requestedInvoiceId}…`
        : 'Processing payment reminders (Mahnwesen) – batch mode…'
    );

    // Get site settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const settingsData = settings || {
      site_name: 'KuechenWert',
      site_description: 'Ihr Wohnmobil-Marktplatz',
      contact_email: 'info@kuechenwert24.de',
      support_phone: '',
    };

    // Get overdue invoices. Note: `dealer_id` stores the invoice recipient
    // regardless of role; for seller_penalty invoices it is the private
    // seller, not a dealer. We therefore also fetch invoice_type so the
    // reminder body / restriction logic can adapt.
    //
    // Includes BOTH `pending` and `partial` payment statuses: a partially
    // paid but overdue invoice is still in active dunning (only the open
    // remainder is due). The reminder text is built from `gross_amount` -
    // `amount_paid` further down.
    let query = supabase
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email, customer_number, salutation),
        reminders:payment_reminders(reminder_level, reminder_date)
      `)
      .in('payment_status', ['pending', 'partial'])
      .neq('status', 'cancelled')
      .lt('due_date', new Date().toISOString())
      .order('due_date');

    if (singleMode) {
      query = query.eq('id', requestedInvoiceId!);
    }

    const { data: overdueInvoices, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          singleMode,
          message: singleMode
            ? 'Rechnung ist nicht überfällig oder bereits storniert/bezahlt'
            : 'No overdue invoices found',
          results: [],
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const invoice of overdueInvoices) {
      try {
        // Guard: ohne gültige Empfänger-Adresse keine Mahnung versenden.
        // Ursache kann ein gelöschtes Profil, eine leer gespeicherte Email
        // oder ein FK-Mismatch sein. Früher crashte der spätere
        // `invoice.dealer.email`-Zugriff und landete im generischen
        // outer-try → Error-Message "Cannot read properties of null" ohne
        // Bezug zur Rechnung. Hier melden wir es explizit zurück.
        if (!invoice.dealer?.email) {
          results.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            skipped: true,
            reason: 'Empfänger-Profil fehlt oder hat keine E-Mail-Adresse',
            success: false,
          });
          continue;
        }

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

        // Auto-enabled toggle only applies to the cron batch run. A manual
        // admin click is an explicit instruction and must always proceed –
        // otherwise the UI button would silently do nothing whenever the
        // settings flag is off.
        if (!autoEnabled && !singleMode) {
          continue;
        }

        // Determine the highest already-sent reminder level so we can advance
        // the dunning ladder one step (instead of always starting at level 1).
        const existingLevels: number[] = (invoice.reminders ?? [])
          .map((r: { reminder_level?: number | null }) => Number(r.reminder_level ?? 0))
          .filter((n: number) => Number.isFinite(n) && n > 0);
        const maxExistingLevel = existingLevels.length ? Math.max(...existingLevels) : 0;

        let reminderLevel = 1;

        if (daysPastDue >= level3Days) {
          reminderLevel = 3;
        } else if (daysPastDue >= level2Days) {
          reminderLevel = 2;
        } else if (daysPastDue >= level1Days) {
          reminderLevel = 1;
        } else if (singleMode) {
          // Manual run for an invoice that is overdue but hasn't crossed
          // level1Days yet: still send the soft "Zahlungserinnerung". This
          // matches what the admin clearly intends when invoking the action.
          reminderLevel = 1;
        } else {
          continue;
        }

        // In manual mode we always advance to the NEXT level (so the admin
        // can escalate even before the configured day threshold is reached).
        // In batch mode we keep the day-threshold-based level so the cron
        // doesn't accidentally skip steps for highly overdue invoices.
        if (singleMode && maxExistingLevel >= reminderLevel) {
          reminderLevel = Math.min(3, maxExistingLevel + 1);
        }

        // Calculate cumulative fees for all levels up to current
        let reminderFee = 0;
        for (let level = 1; level <= reminderLevel; level++) {
          if (level === 1) reminderFee += level1Fee;
          else if (level === 2) reminderFee += level2Fee;
          else if (level === 3) reminderFee += level3Fee;
        }

        // Check if reminder already sent for this level. In batch mode this
        // is normal idempotency. In single mode the level was already bumped
        // above (`maxExistingLevel + 1`), so a hit here means the invoice is
        // already at the highest level (3) and we report that to the caller.
        const existingReminder = invoice.reminders?.find(
          (r: any) => r.reminder_level === reminderLevel
        );

        if (existingReminder) {
          results.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            reminderLevel,
            daysPastDue,
            skipped: true,
            reason: singleMode
              ? 'Höchste Mahnstufe bereits erreicht – kein weiterer Brief versendet'
              : 'Already sent for this level',
            success: false,
          });
          continue;
        }

        // Compute the still-open amount. For partial payments we must dunn
        // only the remainder, not the full gross again. `Math.max` guards
        // against rounding overshoot from older payment recordings.
        const grossAmount = Number(invoice.gross_amount || 0);
        const amountPaid = Number(invoice.amount_paid || 0);
        const remainingAmount = Math.max(0, grossAmount - amountPaid);

        // Create payment reminder
        const subject = getReminderSubject(reminderLevel, invoice.invoice_number);
        const messageBody = getReminderMessage(
          reminderLevel,
          invoice,
          reminderFee,
          remainingAmount
        );

        const { data: reminder, error: reminderError } = await supabase
          .from('payment_reminders')
          .insert({
            invoice_id: invoice.id,
            reminder_level: reminderLevel,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            // `original_amount` historically stores the open balance carried
            // into this dunning step, not the original gross. For full-pay
            // overdue invoices these are equal; for partial it's the rest.
            original_amount: remainingAmount,
            reminder_fee: reminderFee,
            total_amount: remainingAmount + reminderFee,
            subject: subject,
            message_body: messageBody,
          })
          .select()
          .single();

        if (reminderError) {
          console.error('Error creating reminder:', reminderError);
          results.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            error: reminderError.message,
            success: false,
          });
          continue;
        }

        // Send reminder email
        await sendReminderEmail(
          invoice,
          reminder,
          reminderLevel,
          settingsData,
          remainingAmount,
          amountPaid
        );

        // Restrict account based on configurable level. Only meaningful for
        // dealer commission invoices – seller_penalty invoices are issued to
        // private sellers who do not have a "dealer account" to restrict, so
        // flipping `account_restricted` on their profile would block their
        // ability to sell again on the platform without any policy basis.
        const isDealerInvoice =
          invoice.invoice_type !== 'seller_penalty' &&
          invoice.invoice_type !== 'private_penalty';
        if (
          isDealerInvoice &&
          restrictAtLevel > 0 &&
          reminderLevel >= restrictAtLevel
        ) {
          await restrictDealerAccount(supabase, invoice.dealer_id);
        }

        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          dealerEmail: invoice.dealer?.email ?? null,
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

    console.log(`Dunning process completed. Processed ${results.length} invoices (singleMode=${singleMode}).`);

    // In single mode the caller (admin UI) cares about whether THIS invoice
    // was actually advanced. We surface the first result on the top level so
    // the frontend can show a precise toast (sent vs. skipped vs. error).
    const primary = singleMode ? results[0] ?? null : null;

    return new Response(
      JSON.stringify({
        success: true,
        singleMode,
        message: singleMode
          ? primary?.success
            ? `Mahnung Stufe ${primary.reminderLevel} versendet`
            : primary?.skipped
              ? primary.reason
              : primary?.error || 'Keine Mahnung versendet'
          : `Processed ${results.length} overdue invoices`,
        primary,
        results,
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

  // Pick the proper recipient name + reference depending on invoice_type.
  // For seller_penalty (private seller) we prefer the personal name + the
  // word "Konto"; for commission invoices (dealer) we prefer the company
  // name + the word "Account" (matches the existing dealer-facing wording
  // in the rest of the platform).
  function getRecipientContext(invoice: any) {
    const isPenalty = invoice.invoice_type === 'seller_penalty';
    const personalName = `${invoice.dealer?.first_name || ''} ${invoice.dealer?.last_name || ''}`.trim();
    const recipientName = isPenalty
      ? (personalName || invoice.dealer?.company_name || 'Kunde')
      : (invoice.dealer?.company_name || personalName || 'Kunde');
    const accountWord = isPenalty ? 'Konto' : 'Account';
    return { isPenalty, recipientName, accountWord };
  }

  function getReminderMessage(
    level: number,
    invoice: any,
    fee: number,
    remainingAmount: number
  ): string {
    const { isPenalty, recipientName, accountWord } = getRecipientContext(invoice);

    const grossAmount = Number(invoice.gross_amount || 0);
    const amountPaid = Number(invoice.amount_paid || 0);
    const isPartial = amountPaid > 0 && remainingAmount > 0;

    const amountLine = isPartial
      ? `Rechnung ${invoice.invoice_number} vom ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')} \u00fcber \u20ac${grossAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (davon bereits gezahlt: \u20ac${amountPaid.toLocaleString('de-DE', { minimumFractionDigits: 2 })}, offen: \u20ac${remainingAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}). Zahlungsziel war der ${new Date(invoice.due_date).toLocaleDateString('de-DE')}.`
      : `Rechnung ${invoice.invoice_number} vom ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')} \u00fcber \u20ac${grossAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}. Zahlungsziel war der ${new Date(invoice.due_date).toLocaleDateString('de-DE')}.`;

    // Restrict warning is suppressed for seller_penalty invoices because
    // private sellers don't have a "dealer account" we restrict – see the
    // matching guard around `restrictDealerAccount(...)` above.
    const restrictWarning = isPenalty
      ? ''
      : `\n\nIhr ${accountWord} wurde eingeschr\u00e4nkt, bis die Zahlung eingegangen ist.`;

    const messages: Record<number, string> = {
      1: `Sehr geehrte/r ${recipientName},\n\n${amountLine}\n\nBitte \u00fcberweisen Sie den ${isPartial ? 'offenen Restbetrag' : 'Betrag'} zeitnah auf unser Konto.\n\nFalls Sie bereits bezahlt haben, betrachten Sie diese Nachricht als gegenstandslos.`,
      2: `Sehr geehrte/r ${recipientName},\n\n${amountLine}\n\nDa die Zahlung trotz Erinnerung noch nicht eingegangen ist, berechnen wir eine Mahngeb\u00fchr von \u20ac${fee.toFixed(2)}.${restrictWarning}`,
      3: `Sehr geehrte/r ${recipientName},\n\n${amountLine}\n\nDies ist unsere letzte Mahnung. Bei weiterer Nichtzahlung werden wir rechtliche Schritte einleiten.\n\nZus\u00e4tzliche Mahngeb\u00fchr: \u20ac${fee.toFixed(2)}`,
    };

    return messages[level] || messages[1];
  }

  async function sendReminderEmail(
    invoice: any,
    reminder: any,
    level: number,
    settingsData: any,
    remainingAmount: number,
    amountPaid: number,
  ) {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const { isPenalty, recipientName, accountWord } = getRecipientContext(invoice);

    const levelTitles: Record<number, string> = {
      1: 'Zahlungserinnerung',
      2: '1. Mahnung',
      3: '2. Mahnung (Letzte Mahnung)',
    };

    const levelVariant = level === 1 ? 'info' as const : 'warning' as const;
    const grossAmount = Number(invoice.gross_amount || 0);
    const isPartial = amountPaid > 0 && remainingAmount > 0;

    const partialDetailRows = isPartial
      ? `
        ${detailRow('Bereits gezahlt', `&euro;${amountPaid.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`)}
        ${detailRow('<strong>Offener Restbetrag</strong>', `<strong>&euro;${remainingAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong>`)}
      `
      : '';

    // Build email content with email-builder
    const content = `
      ${paragraph(`Sehr geehrte/r ${recipientName},`)}
      ${customerBadge(invoice.dealer?.customer_number)}
      ${paragraph(`unsere ${isPenalty ? 'Vertragsstrafen-Rechnung' : 'Rechnung'} <strong>${invoice.invoice_number}</strong> vom ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')} ist ${isPartial ? 'nur teilweise beglichen' : 'noch nicht beglichen'}.`)}

      ${infoBox('Rechnungsdetails', `
        ${detailRow('Rechnungsnummer', invoice.invoice_number)}
        ${detailRow('Rechnungsdatum', new Date(invoice.invoice_date).toLocaleDateString('de-DE'))}
        ${detailRow('F&auml;lligkeitsdatum', new Date(invoice.due_date).toLocaleDateString('de-DE'))}
        ${detailRow('Rechnungsbetrag', `&euro;${grossAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`)}
        ${partialDetailRows}
        ${reminder.reminder_fee > 0 ? detailRow('Mahngeb&uuml;hr', `&euro;${reminder.reminder_fee.toFixed(2)}`) : ''}
      `, levelVariant)}

      ${amountDisplay('Zu zahlender Gesamtbetrag', `&euro;${reminder.total_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`)}

      ${level >= 2 && !isPenalty ? warningBox(`Ihr ${accountWord} wurde eingeschr&auml;nkt, bis die Zahlung eingegangen ist.`) : ''}
      ${level >= 3 ? warningBox('Dies ist unsere letzte Mahnung. Bei weiterer Nichtzahlung werden wir rechtliche Schritte einleiten.') : ''}

      ${infoBox('Bankverbindung', `
        ${detailRow('IBAN', settingsData.bank_iban || 'Bitte in Einstellungen hinterlegen')}
        ${settingsData.bank_bic ? detailRow('BIC', settingsData.bank_bic) : ''}
        ${settingsData.bank_name ? detailRow('Bank', settingsData.bank_name) : ''}
        ${detailRow('Verwendungszweck', invoice.invoice_number)}
      `)}

      ${level === 1 ? paragraph('Falls Sie bereits bezahlt haben, betrachten Sie diese Nachricht als gegenstandslos.') : ''}
      ${paragraph('Mit freundlichen Gr&uuml;&szlig;en<br>Ihr KuechenWert Team')}
    `;

    const emailHtml = buildEmailLayout(settingsData, levelTitles[level] || 'Zahlungserinnerung', content);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name || 'KuechenWert'} <info@kuechenwert24.de>`,
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
        sender_email: 'info@kuechenwert24.de',
        sender_name: settingsData.site_name,
        recipient_email: invoice.dealer.email,
        recipient_name: recipientName || null,
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
