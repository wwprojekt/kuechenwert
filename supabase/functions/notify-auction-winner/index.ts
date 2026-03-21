import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  try {
    const { auctionId, winnerId, amount } = await req.json();

    if (!auctionId || !winnerId || !amount) {
      throw new Error('auctionId, winnerId, and amount are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Notifying auction winner:', winnerId, 'for auction:', auctionId);

    // Get auction details
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select(`
        *,
        motorhome:motorhomes(*)
      `)
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      throw new Error('Auction not found');
    }

    // Get winner profile
    const { data: winnerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', winnerId)
      .single();

    if (profileError || !winnerProfile) {
      throw new Error('Winner profile not found');
    }

    // Get site settings for email
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    // Prepare email content
    const motorhome = auction.motorhome;
    const emailSubject = `Herzlichen Glückwunsch! Sie haben die Auktion gewonnen`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #195D3E 0%, #D2281C 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .vehicle-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #195D3E; }
          .price { font-size: 32px; font-weight: bold; color: #195D3E; margin: 20px 0; }
          .button { display: inline-block; background: #195D3E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Auktion gewonnen!</h1>
          </div>
          <div class="content">
            <p>Sehr geehrte/r ${winnerProfile.first_name} ${winnerProfile.last_name},</p>
            
            <p><strong>Herzlichen Glückwunsch!</strong> Sie haben die Auktion erfolgreich gewonnen.</p>
            
            <div class="vehicle-info">
              <h2>${motorhome.manufacturer} ${motorhome.model}</h2>
              <p><strong>Baujahr:</strong> ${motorhome.year}</p>
              <p><strong>Kilometerstand:</strong> ${motorhome.mileage.toLocaleString()} km</p>
              <p><strong>Aufbauart:</strong> ${motorhome.body_type}</p>
            </div>
            
            <p style="text-align: center;">
              <strong>Ihr Gebot:</strong>
              <div class="price">€${Number(amount).toLocaleString()}</div>
            </p>
            
            <p>Wir werden uns in Kürze mit Ihnen in Verbindung setzen, um die nächsten Schritte zu besprechen:</p>
            <ul>
              <li>Zahlungsabwicklung</li>
              <li>Terminvereinbarung für Übergabe</li>
              <li>Fahrzeugdokumentation</li>
            </ul>
            
            <p>Falls Sie Fragen haben, erreichen Sie uns unter:</p>
            <p>
              📧 <a href="mailto:${settings?.contact_email || 'kontakt@caravanwert.de'}">${settings?.contact_email || 'kontakt@caravanwert.de'}</a><br>
              📞 ${settings?.support_phone || '+49 123 456789'}
            </p>
            
            <div style="text-align: center;">
              <a href="https://cmvhcudymrtvmbomkenq.supabase.co" class="button">Zum Dashboard</a>
            </div>
            
            <div class="footer">
              <p>Vielen Dank für Ihr Vertrauen in ${settings?.site_name || 'CaravanWert'}!</p>
              <p>${settings?.site_tagline || 'Deutschlands führende Wohnmobil-Handelsplattform'}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey && winnerProfile.email) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: settings?.from_email || 'noreply@caravanwert.de',
          to: [winnerProfile.email],
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error('Error sending email via Resend:', errorData);
        throw new Error('Failed to send email');
      }

      console.log('Winner notification email sent successfully');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Winner notified successfully' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in notify-auction-winner:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
