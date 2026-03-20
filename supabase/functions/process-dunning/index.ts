import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check: must be service_role (cron) or authenticated admin
  const authHeader = req.headers.get('authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isServiceRole = authHeader.includes(serviceRoleKey);

  if (!isServiceRole) {
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseCheck = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: roles } = await supabaseCheck.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing payment reminders (Mahnwesen)...');

    // Get overdue invoices
    const { data: overdueInvoices, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email),
        reminders:payment_reminders(reminder_level, reminder_date)
      `)
      .eq('payment_status', 'pending')
      .lt('due_date', new Date().toISOString())
      .order('due_date');

    if (fetchError) throw fetchError;

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No overdue invoices found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const invoice of overdueInvoices) {
      try {
        const daysPastDue = Math.floor(
          (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine reminder level based on days past due
        let reminderLevel = 1;
        let reminderFee = 0;
        
        if (daysPastDue >= 42) { // 6 weeks
          reminderLevel = 3;
          reminderFee = 15.00; // €15 for 3rd reminder
        } else if (daysPastDue >= 28) { // 4 weeks
          reminderLevel = 2;
          reminderFee = 10.00; // €10 for 2nd reminder
        } else if (daysPastDue >= 14) { // 2 weeks
          reminderLevel = 1;
          reminderFee = 5.00; // €5 for 1st reminder
        } else {
          // Not yet time for reminder
          continue;
        }

        // Check if reminder already sent for this level
        const existingReminder = invoice.reminders?.find(
          (r: any) => r.reminder_level === reminderLevel
        );

        if (existingReminder) {
          // Check if account should be restricted (after 28 days)
          if (daysPastDue >= 28 && reminderLevel >= 2) {
            await restrictDealerAccount(supabase, invoice.dealer_id);
          }
          continue;
        }

        // Create payment reminder
        const { data: reminder, error: reminderError } = await supabase
          .from('payment_reminders')
          .insert({
            invoice_id: invoice.id,
            reminder_level: reminderLevel,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            original_amount: invoice.gross_amount,
            reminder_fee: reminderFee,
            total_amount: invoice.gross_amount + reminderFee,
            subject: getReminderSubject(reminderLevel, invoice.invoice_number),
            message_body: getReminderMessage(reminderLevel, invoice, reminderFee),
          })
          .select()
          .single();

        if (reminderError) {
          console.error('Error creating reminder:', reminderError);
          continue;
        }

        // Send reminder email
        await sendReminderEmail(invoice, reminder, reminderLevel);

        // Restrict account if 2nd reminder (28 days overdue)
        if (reminderLevel >= 2) {
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-dunning:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  async function restrictDealerAccount(supabase: any, dealerId: string) {
    try {
      await supabase
        .from('profiles')
        .update({
          account_restricted: true,
          restriction_reason: 'Überfällige Zahlung',
          restricted_at: new Date().toISOString(),
        })
        .eq('id', dealerId);
      console.log(`Account restricted for dealer: ${dealerId}`);
    } catch (error) {
      console.error('Error restricting dealer account:', error);
    }
  }

  function getReminderSubject(level: number, invoiceNumber: string): string {
    const subjects = {
      1: `Zahlungserinnerung - Rechnung ${invoiceNumber}`,
      2: `1. Mahnung - Rechnung ${invoiceNumber}`,
      3: `2. Mahnung - Rechnung ${invoiceNumber}`,
    };
    return subjects[level as keyof typeof subjects] || `Mahnung - Rechnung ${invoiceNumber}`;
  }

  function getReminderMessage(level: number, invoice: any, fee: number): string {
    const dealerName = invoice.dealer.company_name || 
      `${invoice.dealer.first_name} ${invoice.dealer.last_name}`;

    const baseMessage = `
Sehr geehrte/r ${dealerName},

unsere Rechnung ${invoice.invoice_number} vom ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')} 
über €${invoice.gross_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ist noch nicht beglichen.

Zahlungsziel war der ${new Date(invoice.due_date).toLocaleDateString('de-DE')}.
`;

    const messages = {
      1: baseMessage + `
Bitte überweisen Sie den Betrag zeitnah auf unser Konto.

Falls Sie bereits bezahlt haben, betrachten Sie diese Nachricht als gegenstandslos.
`,
      2: baseMessage + `
Da die Zahlung trotz Erinnerung noch nicht eingegangen ist, berechnen wir eine Mahngebühr von €${fee.toFixed(2)}.

Gesamtbetrag: €${(invoice.gross_amount + fee).toLocaleString('de-DE', { minimumFractionDigits: 2 })}

Ihr Account wurde eingeschränkt, bis die Zahlung eingegangen ist.
`,
      3: baseMessage + `
Dies ist unsere letzte Mahnung. Bei weiterer Nichtzahlung werden wir rechtliche Schritte einleiten.

Zusätzliche Mahngebühr: €${fee.toFixed(2)}
Gesamtbetrag: €${(invoice.gross_amount + fee).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
`,
    };

    return messages[level as keyof typeof messages] + `
    
Mit freundlichen Grüßen
Ihr CamperAnker24 Team`;
  }

  async function sendReminderEmail(invoice: any, reminder: any, level: number) {
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY not configured');
      }

      // Dealer name for email - used in reminder.message_body which is included in the template
      const dealerName = invoice.dealer.company_name || 
        `${invoice.dealer.first_name} ${invoice.dealer.last_name}`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${level === 1 ? '#fbbf24' : level === 2 ? '#f97316' : '#dc2626'}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .amount { font-size: 24px; font-weight: bold; color: #dc2626; margin: 20px 0; }
    .warning { background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${level === 1 ? '⚠️' : level === 2 ? '🚨' : '⛔'} ${reminder.subject}</h1>
    </div>
    <div class="content">
      <div style="white-space: pre-line;">${reminder.message_body}</div>
      
      <div class="amount">
        Zu zahlen: €${reminder.total_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
      </div>
      
      ${level >= 2 ? '<div class="warning"><strong>Ihr Account wurde eingeschränkt</strong> bis zur Zahlung.</div>' : ''}
      
      <p><strong>Bankverbindung:</strong><br>
      IBAN: DE89 3704 0044 0532 0130 00<br>
      BIC: COBADEFFXXX<br>
      Verwendungszweck: ${invoice.invoice_number}</p>
    </div>
  </div>
</body>
</html>`;

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'CamperAnker24 Buchhaltung <billing@camperanker24.de>',
          to: [invoice.dealer.email],
          subject: reminder.subject,
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        throw new Error('Failed to send reminder email');
      }

      console.log(`${level}. Mahnung sent to ${invoice.dealer.email}`);
    } catch (error) {
      console.error('Error sending reminder email:', error);
      throw error;
    }
  }
});
