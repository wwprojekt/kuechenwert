// One-shot admin notification: lists active/kaufchance auctions with NULL
// seller_initial_reserve (legacy gap before AGB v7 hardening). Will be
// invoked once and then removed from the project. Internal use only —
// no public auth contract required.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (_req: Request): Promise<Response> => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: rows, error } = await supabase
      .from("auctions")
      .select("id, motorhome_id, starting_bid, end_time, status, motorhomes!inner(manufacturer, model, year)")
      .in("status", ["active", "kaufchance"])
      .is("seller_initial_reserve", null)
      .order("start_time", { ascending: true });

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0, message: "No affected auctions" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tableRows = rows
      .map((r: any) => {
        const m = r.motorhomes;
        const endTime = new Date(r.end_time).toLocaleString("de-DE", {
          timeZone: "Europe/Berlin",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<tr>
          <td style="padding:8px;border:1px solid #ddd;">${m.manufacturer ?? ""} ${m.model ?? ""} (${m.year ?? "?"})</td>
          <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-size:12px;">${r.id}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${r.starting_bid ?? "-"} €</td>
          <td style="padding:8px;border:1px solid #ddd;">${endTime}</td>
          <td style="padding:8px;border:1px solid #ddd;"><a href="https://caravanwert.de/admin/motorhomes/${r.motorhome_id}" style="color:#0066cc;">Bearbeiten →</a></td>
        </tr>`;
      })
      .join("\n");

    const todayDe = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
    const subject = `⚠️ Aktion erforderlich: ${rows.length} Auktionen ohne Mindestpreis (AGB v7)`;

    const html = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;margin:0;padding:24px;color:#374151;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="border-bottom:3px solid #1f8aa2;padding-bottom:16px;margin-bottom:24px;">
      <h1 style="margin:0;color:#1f8aa2;font-size:22px;">CaravanWert · Admin-Alarm</h1>
    </div>
    <h2 style="color:#d32f2f;margin-top:0;font-size:20px;">⚠️ Risiko: ${rows.length} aktive Auktionen ohne Mindestpreis</h2>
    <p style="font-size:15px;line-height:1.6;">Folgende Auktionen laufen derzeit <strong>ohne <code>seller_initial_reserve</code></strong>. Die AGB §6.4 c) Reduktionsboden-Logik kann hier nicht greifen – theoretisch wären Verkäufe ab dem Startpreis (z. B. 50&nbsp;€) möglich.</p>
    <p style="font-size:15px;line-height:1.6;"><strong>Bitte sofort prüfen und einen Wunsch-Mindestpreis eintragen</strong> (Rücksprache mit Verkäufer falls nötig):</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin-top:16px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Fahrzeug</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Auktion-ID</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:right;">Startpreis</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Endet</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Aktion</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="margin-top:24px;font-size:13px;color:#555;line-height:1.6;"><strong>Hintergrund:</strong> Mit AGB v7 (in Kraft seit ${todayDe}) greift bei Auktionen die automatische Preisanpassung mit Reduktionsboden -6&nbsp;% vom Wunsch-Mindestpreis. Ohne <code>seller_initial_reserve</code> existiert kein Anker und kein Boden.</p>
    <p style="font-size:13px;color:#555;line-height:1.6;">Neue Inserate sind ab sofort durch UI- und Backend-Validierung gegen NULL-Mindestpreise geschützt (Wizard, Händler-Erstellung, Verkäufer-Edit, Edge Function, DB-CHECK-Constraint). Diese E-Mail betrifft nur Altbestand.</p>
    <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#9ca3af;text-align:center;">CaravanWert · Automatischer System-Alarm · ${todayDe}</p>
  </div>
</body>
</html>`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CaravanWert <info@caravanwert.de>",
        to: ["info@caravanwert.de"],
        subject,
        html,
        reply_to: "info@caravanwert.de",
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      throw new Error(`Resend ${resendResp.status}: ${errText}`);
    }
    const resendResult = await resendResp.json();

    await supabase.from("admin_emails").insert({
      sender_email: "info@caravanwert.de",
      sender_name: "CaravanWert",
      recipient_email: "info@caravanwert.de",
      subject,
      body_html: html,
      body_text: html.replace(/<[^>]+>/g, ""),
      email_type: "single",
      direction: "outbound",
      status: "sent",
      resend_id: resendResult.id,
      is_read: true,
    });

    return new Response(
      JSON.stringify({ ok: true, count: rows.length, resend_id: resendResult.id }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("notify-admin-missing-reserve failed:", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
