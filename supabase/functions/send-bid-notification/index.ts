import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, infoBox, detailRow, paragraph } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BidNotificationRequest {
  bidderId: string;
  auctionId: string;
  bidAmount: number;
  isOutbid: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  try {
    const { bidderId, auctionId, bidAmount, isOutbid }: BidNotificationRequest = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch bidder profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', bidderId)
      .single();

    if (!profile?.email) {
      throw new Error('Bidder email not found');
    }

    // Fetch auction details
    const { data: auction } = await supabase
      .from('auctions')
      .select(`
        *,
        motorhome:motorhomes(manufacturer, model)
      `)
      .eq('id', auctionId)
      .single();

    if (!auction) {
      throw new Error('Auction not found');
    }

    // Fetch site settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .single();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '0800 123 456 78',
    };

    const motorhomeName = `${auction.motorhome.manufacturer} ${auction.motorhome.model}`;
    const userName = profile.first_name || profile.email.split('@')[0];
    const auctionUrl = `https://caravanwert.de/auktion/${auctionId}`;

    // Build email content
    const content = isOutbid 
      ? `
        ${paragraph(`Hallo ${userName},`)}
        ${paragraph(`Sie wurden bei der Auktion für <strong>${motorhomeName}</strong> überboten.`)}
        
        ${infoBox('Gebotsstatus', `
          ${detailRow('Ihr Gebot', `€${bidAmount.toLocaleString()}`)}
          ${detailRow('Aktuelles Höchstgebot', `€${auction.current_bid.toLocaleString()}`)}
        `, 'warning', settingsData)}
        
        ${detailRow('Auktion endet', new Date(auction.end_time).toLocaleString('de-DE'))}
        
        ${paragraph('Geben Sie ein höheres Gebot ab, um weiterhin im Rennen zu bleiben.')}
        ${paragraph(`<a href="${auctionUrl}" style="color: #195d3e; text-decoration: underline; font-weight: bold;">Höheres Gebot abgeben →</a>`)}
      `
      : `
        ${paragraph(`Hallo ${userName},`)}
        ${paragraph(`Ihr Gebot für <strong>${motorhomeName}</strong> wurde erfolgreich platziert!`)}
        
        ${infoBox('Gebotsstatus', `
          ${detailRow('Ihr Gebot', `€${bidAmount.toLocaleString()}`)}
          ${detailRow('Status', 'Sie sind derzeit Höchstbietender ✓')}
        `, 'success', settingsData)}
        
        ${detailRow('Auktion endet', new Date(auction.end_time).toLocaleString('de-DE'))}
        
        ${paragraph('Behalten Sie die Auktion im Auge, um sicherzustellen, dass Sie Höchstbietender bleiben.')}
        ${paragraph(`<a href="${auctionUrl}" style="color: #195d3e; text-decoration: underline; font-weight: bold;">Auktion ansehen →</a>`)}
      `;

    const html = buildEmailLayout(
      settingsData, 
      isOutbid ? 'Sie wurden überboten!' : 'Ihr Gebot wurde akzeptiert', 
      content
    );

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [profile.email],
        subject: isOutbid ? `Sie wurden überboten - ${motorhomeName}` : `Gebot bestätigt - ${motorhomeName}`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const result = await emailResponse.json();
    console.log(`Bid notification sent to ${profile.email}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (error: any) {
    console.error("Error in send-bid-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
