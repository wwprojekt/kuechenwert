import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  buildEmailLayout,
  greeting,
  paragraph,
  button,
  infoBox,
  detailRow,
  list,
} from "../_shared/email-builder.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { edgeLogger } from "../_shared/edgeLogger.ts";
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Send a registration invite email to a user whose account was
 * manually created by an admin. The email contains a magic link that:
 * 1. Confirms the user's email address
 * 2. Logs them in automatically
 * 3. Redirects them to their dashboard where they can set a password
 *
 * Supports two invite types:
 * - "seller" (default): For customers whose motorhome was created by admin
 * - "dealer": For dealers created via the admin Händlerverwaltung
 *
 * Body: {
 *   email: string (required) - Recipient email
 *   customerName?: string - Recipient name for greeting
 *   motorhomeId?: string - Motorhome ID for vehicle info in email (seller only)
 *   sessionId?: string - Wizard session ID to track invite sent (seller only)
 *   inviteType?: "seller" | "dealer" - Type of invite (default: "seller")
 *   companyName?: string - Company name for dealer invites
 * }
 */

interface InviteRequest {
  email: string;
  customerName?: string;
  motorhomeId?: string;
  sessionId?: string;
  inviteType?: "seller" | "dealer";
  companyName?: string;
  hasPassword?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  // Auth: only admin or service_role can send registration invites
  const authResult = await checkServiceRoleOrAdmin(req, headers);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const body: InviteRequest = await req.json();

    if (!body.email || !body.email.trim()) {
      return new Response(
        JSON.stringify({ error: "E-Mail-Adresse ist erforderlich" }),
        { status: 400, headers }
      );
    }

    const email = body.email.trim().toLowerCase();
    const customerName = body.customerName?.trim() || "";
    const inviteType = body.inviteType || "seller";
    const companyName = body.companyName?.trim() || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load site settings for email branding
    const { data: settings } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    const settingsData = settings || {
      site_name: "CaravanWert",
      site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
      contact_email: "info@caravanwert.de",
      support_phone: "+49 511 51532476",
    };

    // Load motorhome info if provided (seller invites only)
    let vehicleInfo = "";
    let vehicleName = "Ihr Wohnmobil";
    if (inviteType === "seller" && body.motorhomeId) {
      const { data: motorhome } = await supabase
        .from("motorhomes")
        .select("manufacturer, model, year, body_type, mileage, sale_channel, instant_price")
        .eq("id", body.motorhomeId)
        .maybeSingle();

      if (motorhome) {
        vehicleName = [motorhome.manufacturer, motorhome.model, motorhome.year ? `(${motorhome.year})` : ""]
          .filter(Boolean)
          .join(" ");

        const hasInstantBuy = motorhome.instant_price && Number(motorhome.instant_price) > 0;
        const saleChannelLabel =
          motorhome.sale_channel === "instant_price" ? "Festpreis (Sofortkauf)" :
          motorhome.sale_channel === "station" ? "Ankaufstation" :
          hasInstantBuy ? "H\u00e4ndler-Auktion + Sofortkauf" :
          motorhome.sale_channel === "auction" ? "H\u00e4ndler-Auktion" :
          motorhome.sale_channel || "\u2013";

        vehicleInfo = infoBox(
          "Ihr Fahrzeug bei CaravanWert",
          `${detailRow("Fahrzeug", vehicleName)}
           ${motorhome.body_type ? detailRow("Aufbauart", motorhome.body_type) : ""}
           ${motorhome.mileage ? detailRow("Kilometerstand", `${Number(motorhome.mileage).toLocaleString("de-DE")} km`) : ""}
           ${detailRow("Verkaufsweg", saleChannelLabel)}`,
          "success",
          settingsData
        );
      }
    }

    // Generate a magic link for the user
    // This will confirm their email AND log them in
    // If the user already set a password in the wizard, redirect directly to dashboard
    // Otherwise, the setup=password parameter triggers a password-setting dialog
    const hasPassword = body.hasPassword || false;
    const redirectUrl = hasPassword
      ? "https://caravanwert.de/dashboard"
      : "https://caravanwert.de/dashboard?setup=password";

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError) {
      edgeLogger.error("Failed to generate magic link:", linkError.message);
      return new Response(
        JSON.stringify({ error: `Magic Link konnte nicht erstellt werden: ${linkError.message}` }),
        { status: 500, headers }
      );
    }

    // The generated link contains the token - we need to build the confirmation URL
    // Supabase generateLink returns properties.action_link which is the full URL
    const magicLink = linkData?.properties?.action_link;

    if (!magicLink) {
      edgeLogger.error("No action_link in generateLink response");
      return new Response(
        JSON.stringify({ error: "Magic Link konnte nicht generiert werden" }),
        { status: 500, headers }
      );
    }

    // Rewrite the magic link to go through our AuthConfirm page
    // The action_link from Supabase looks like: SUPABASE_URL/auth/v1/verify?token=...&type=magiclink&redirect_to=...
    // We keep this as-is because Supabase handles the redirect after verification
    const registrationLink = magicLink;

    edgeLogger.info(`Generated registration link for ${email} (type: ${inviteType})`);

    // Build the email content based on invite type
    let content = "";
    let subject = "";

    if (inviteType === "dealer") {
      // ===== DEALER INVITE EMAIL =====
      content += greeting(customerName || undefined);

      content += paragraph(
        `willkommen bei <strong>${settingsData.site_name}</strong> &ndash; Deutschlands f&uuml;hrender Wohnmobil-Handelsplattform! ` +
        `Ihr H&auml;ndlerkonto${companyName ? ` f&uuml;r <strong>${companyName}</strong>` : ""} wurde erfolgreich eingerichtet.`
      );

      content += paragraph(
        `Aktivieren Sie jetzt Ihr Konto, um sofort auf exklusive H&auml;ndler-Auktionen, ` +
        `Sofortkauf-Angebote und Ihr pers&ouml;nliches H&auml;ndler-Dashboard zuzugreifen:`
      );

      content += button("Jetzt H&auml;ndlerkonto aktivieren", registrationLink, settingsData);

      content += infoBox(
        "Ihre Vorteile als H&auml;ndler",
        list([
          "<strong>H&auml;ndler-Auktionen</strong> &ndash; Bieten Sie auf gepr&uuml;fte Wohnmobile und Caravans",
          "<strong>Sofortkauf</strong> &ndash; Fahrzeuge direkt zum Festpreis erwerben",
          "<strong>Inventar-Verwaltung</strong> &ndash; Ihren Fahrzeugbestand zentral verwalten",
          "<strong>Nachrichten</strong> &ndash; Direkter Kontakt mit Verk&auml;ufern",
          "<strong>Rechnungen &amp; Dokumente</strong> &ndash; Alle Unterlagen an einem Ort",
        ]),
        "info",
        settingsData
      );

      content += paragraph(
        `<strong>Wichtig:</strong> Dieser Link ist einmalig und f&uuml;hrt Sie direkt in Ihr H&auml;ndler-Dashboard. ` +
        `Bei der ersten Anmeldung werden Sie aufgefordert, ein pers&ouml;nliches Passwort festzulegen, ` +
        `mit dem Sie sich k&uuml;nftig jederzeit einloggen k&ouml;nnen.`
      );

      content += paragraph(
        `Bei Fragen stehen wir Ihnen jederzeit gerne zur Verf&uuml;gung unter ` +
        `<strong>${settingsData.support_phone}</strong> oder per E-Mail an ` +
        `<a href="mailto:${settingsData.contact_email}" style="color: #1f8aa2;">${settingsData.contact_email}</a>.`
      );

      subject = `${companyName || "Ihr H\u00e4ndlerkonto"} \u2013 Willkommen bei ${settingsData.site_name}`;

    } else {
      // ===== SELLER INVITE EMAIL =====
      content += greeting(customerName || undefined);

      content += paragraph(
        `vielen Dank f&uuml;r Ihr Interesse an <strong>${settingsData.site_name}</strong>! ` +
        `Wir haben Ihr Fahrzeug erfolgreich in unser System aufgenommen und alles f&uuml;r Sie vorbereitet.`
      );

      if (vehicleInfo) {
        content += vehicleInfo;
      }

      content += paragraph(
        `Um Ihr Fahrzeug zu verwalten, den Verkaufsstatus zu verfolgen und mit H&auml;ndlern in Kontakt zu treten, ` +
        `aktivieren Sie jetzt Ihr pers&ouml;nliches Konto mit einem Klick:`
      );

      content += button("Jetzt Konto aktivieren &amp; Fahrzeug verwalten", registrationLink, settingsData);

      content += infoBox(
        "Das erwartet Sie in Ihrem Dashboard",
        list([
          "<strong>Fahrzeug-&Uuml;bersicht</strong> &ndash; Alle Details zu Ihrem Inserat auf einen Blick",
          "<strong>Auktions-Status</strong> &ndash; Verfolgen Sie Gebote und den Verkaufsfortschritt in Echtzeit",
          "<strong>Nachrichten</strong> &ndash; Direkter Kontakt mit interessierten H&auml;ndlern",
          "<strong>Dokumente</strong> &ndash; Rechnungen und Vertr&auml;ge sicher verwalten",
        ]),
        "info",
        settingsData
      );

      // Adapt the "Wichtig" paragraph based on whether user already has a password
      if (hasPassword) {
        content += paragraph(
          `<strong>Wichtig:</strong> Dieser Link ist einmalig und f&uuml;hrt Sie direkt in Ihr Dashboard. ` +
          `Sie k&ouml;nnen sich k&uuml;nftig jederzeit mit Ihrer E-Mail-Adresse und dem im Wizard gew&auml;hlten Passwort einloggen.`
        );
      } else {
        content += paragraph(
          `<strong>Wichtig:</strong> Dieser Link ist einmalig und f&uuml;hrt Sie direkt in Ihr Dashboard. ` +
          `Bei der ersten Anmeldung werden Sie aufgefordert, ein pers&ouml;nliches Passwort festzulegen, ` +
          `mit dem Sie sich k&uuml;nftig jederzeit einloggen k&ouml;nnen.`
        );
      }

      content += paragraph(
        `Bei Fragen stehen wir Ihnen jederzeit gerne zur Verf&uuml;gung unter ` +
        `<strong>${settingsData.support_phone}</strong> oder per E-Mail an ` +
        `<a href="mailto:${settingsData.contact_email}" style="color: #1f8aa2;">${settingsData.contact_email}</a>.`
      );

      subject = `${vehicleName} \u2013 Ihr Konto bei ${settingsData.site_name} aktivieren`;
    }

    const emailHtml = buildEmailLayout(settingsData, subject, content);

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [email],
        subject,
        html: emailHtml,
        reply_to: settingsData.contact_email || "info@caravanwert.de",
      }),
    });

    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      edgeLogger.error("Resend error:", errorText);
      return new Response(
        JSON.stringify({ error: "E-Mail konnte nicht gesendet werden", details: errorText }),
        { status: 500, headers }
      );
    }

    const resendResult = await resendRes.json();
    edgeLogger.info(`Registration invite sent to ${email} (type: ${inviteType}), resend_id: ${resendResult.id}`);

    // Log in admin_emails table
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("email", email)
      .maybeSingle();

    await supabase.from("admin_emails").insert({
      sender_email: "info@caravanwert.de",
      sender_name: settingsData.site_name,
      recipient_email: email,
      recipient_name: customerName || [recipientProfile?.first_name, recipientProfile?.last_name].filter(Boolean).join(" ") || null,
      recipient_id: recipientProfile?.id || null,
      subject,
      body_html: content,
      body_text: content.replace(/<[^>]*>/g, ""),
      email_type: inviteType === "dealer" ? "dealer_registration_invite" : "registration_invite",
      direction: "outbound",
      status: "sent",
      resend_id: resendResult.id,
      is_read: true,
    });

    // Update wizard session if sessionId provided (seller invites only, APPEND to existing notes)
    if (inviteType === "seller" && body.sessionId) {
      const { data: existingSession } = await supabase
        .from("wizard_sessions")
        .select("admin_notes")
        .eq("id", body.sessionId)
        .maybeSingle();

      const timestamp = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const newNote = `[${timestamp}] Registrierungslink gesendet an ${email}`;
      const updatedNotes = existingSession?.admin_notes
        ? `${existingSession.admin_notes}\n${newNote}`
        : newNote;

      await supabase
        .from("wizard_sessions")
        .update({ admin_notes: updatedNotes } as any)
        .eq("id", body.sessionId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Registrierungslink an ${email} gesendet`,
        resend_id: resendResult.id,
      }),
      { status: 200, headers }
    );

  } catch (error: any) {
    edgeLogger.error("Error in send-registration-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Interner Serverfehler" }),
      { status: 500, headers }
    );
  }
};

serve(handler);
