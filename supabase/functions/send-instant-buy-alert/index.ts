import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  buildEmailLayout,
  paragraph,
  greeting,
  button,
  detailRow,
  auctionEmailCard,
  pickPrimaryPhotoUrl,
} from "../_shared/email-builder.ts";
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";
import { deferIfQuiet } from "../_shared/quiet-hours.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Sofortkauf-Alert (Haendler-Suchagent). Laeuft via Cron alle 15 Minuten.
 *
 * Flow:
 *  1. Finde alle Auktionen der letzten 20 Minuten (Cron-Drift-Puffer) die
 *     ein Sofortkauf-Listing sind (`sale_channel='instant_price'`) und
 *     aktiv (`status='active'`).
 *  2. Lade alle `dealer_instant_buy_alerts` mit `enabled=true`.
 *  3. Matche pro (auction, alert) die Filter (Hersteller / Aufbauart / Land
 *     / Preis / Baujahr / Kilometer). Leere Filter-Arrays bedeuten "alles
 *     erlaubt".
 *  4. Fuer jedes Match: Dedup-Check via `instant_buy_alerts_sent`. Zusaetzlich
 *     werden `user_notification_preferences` respektiert:
 *       - `email_new_auction === false`      -> skip
 *       - `broadcast_emails_enabled === false` -> skip
 *       - Quiet-Hours aktiv -> Mail wird in `admin_emails` mit status='queued'
 *         + scheduled_at=<Ende der Ruhezeit> eingestellt und von
 *         process-scheduled-emails spaeter versendet.
 *  5. Log in `admin_emails` mit `email_type='dealer_instant_buy_alert'`.
 *
 * Auth: service_role oder authentifizierter Admin (wie andere Cron-Funktionen).
 */

type MotorhomeRow = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  body_type: string | null;
  mileage: number | null;
  city: string | null;
  country: string | null;
  seller_id: string | null;
  sale_channel: string | null;
  instant_price: number | null;
  photos: unknown;
};

type AuctionRow = {
  id: string;
  created_at: string;
  end_time: string;
  status: string;
  motorhomes: MotorhomeRow | MotorhomeRow[] | null;
};

type DealerAlertRow = {
  user_id: string;
  enabled: boolean;
  min_price: number | null;
  max_price: number | null;
  manufacturers: string[];
  body_types: string[];
  countries: string[];
  min_year: number | null;
  max_year: number | null;
  max_mileage: number | null;
};

type PrefsRow = {
  user_id: string;
  email_new_auction: boolean | null;
  broadcast_emails_enabled: boolean | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

function matches(alert: DealerAlertRow, m: MotorhomeRow): boolean {
  const price = m.instant_price != null ? Number(m.instant_price) : null;
  if (alert.min_price != null && (price == null || price < Number(alert.min_price))) return false;
  if (alert.max_price != null && (price == null || price > Number(alert.max_price))) return false;

  if (alert.manufacturers.length > 0) {
    if (!m.manufacturer || !alert.manufacturers.includes(m.manufacturer)) return false;
  }
  if (alert.body_types.length > 0) {
    if (!m.body_type || !alert.body_types.includes(m.body_type)) return false;
  }
  if (alert.countries.length > 0) {
    const c = m.country ?? "DE";
    if (!alert.countries.includes(c)) return false;
  }

  if (alert.min_year != null && (m.year == null || m.year < alert.min_year)) return false;
  if (alert.max_year != null && (m.year == null || m.year > alert.max_year)) return false;
  if (alert.max_mileage != null && m.mileage != null && m.mileage > alert.max_mileage) return false;

  return true;
}

function formatPrice(amount: number | null): string {
  if (amount == null) return "-";
  return Number(amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await checkServiceRoleOrAdmin(req, { "Content-Type": "application/json" });
  if (!auth.authorized) return auth.response;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: settings } = await supabase.from("site_settings").select("*").single();
    const settingsData = settings || {
      site_name: "CaravanWert",
      site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
      contact_email: "info@caravanwert.de",
      support_phone: "+49 511 51532476",
    };

    const now = new Date();
    const twentyMinAgo = new Date(now.getTime() - 20 * 60 * 1000);

    // Scan neue Auktionen der letzten 20 Minuten, die Sofortkauf sind.
    // Der Cron laeuft alle 15 Minuten; die 20-Min-Spanne deckt Cron-Drift
    // + leichte Latenz ab. Dedup verhindert Doppelversand.
    const { data: auctions, error: auctionsError } = await supabase
      .from("auctions")
      .select(`
        id, created_at, end_time, status,
        motorhomes!inner (
          id, manufacturer, model, year, body_type, mileage, city, country,
          seller_id, sale_channel, instant_price,
          photos:motorhome_photos(url, display_order)
        )
      `)
      .eq("status", "active")
      .gt("created_at", twentyMinAgo.toISOString())
      .order("created_at", { ascending: true });

    if (auctionsError) throw new Error(`Auctions fetch: ${auctionsError.message}`);

    const instantBuyAuctions: Array<{ auction: AuctionRow; m: MotorhomeRow }> = [];
    for (const a of (auctions || []) as AuctionRow[]) {
      const mRaw = a.motorhomes;
      const m = Array.isArray(mRaw) ? mRaw[0] : mRaw;
      if (!m) continue;
      if (m.sale_channel !== "instant_price") continue;
      instantBuyAuctions.push({ auction: a, m });
    }

    if (instantBuyAuctions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No new instant-buy listings in window", scanned: auctions?.length ?? 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Alle aktiven Alerts laden
    const { data: alerts, error: alertsError } = await supabase
      .from("dealer_instant_buy_alerts")
      .select("*")
      .eq("enabled", true);

    if (alertsError) throw new Error(`Alerts fetch: ${alertsError.message}`);
    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No dealers with instant-buy alerts enabled" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const alertUserIds = (alerts as DealerAlertRow[]).map((a) => a.user_id);

    // Prefs in einem Rutsch laden
    const { data: prefs } = await supabase
      .from("user_notification_preferences")
      .select("user_id, email_new_auction, broadcast_emails_enabled, quiet_hours_start, quiet_hours_end")
      .in("user_id", alertUserIds);

    const prefsByUser = new Map<string, PrefsRow>(
      ((prefs || []) as PrefsRow[]).map((p) => [p.user_id, p])
    );

    // Profile fuer Empfaenger-Namen / Email
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, email_bounced")
      .in("id", alertUserIds);

    const profileByUser = new Map<string, { id: string; email: string | null; first_name: string | null; last_name: string | null; email_bounced: boolean | null }>(
      ((profiles || []) as Array<{ id: string; email: string | null; first_name: string | null; last_name: string | null; email_bounced: boolean | null }>).map((p) => [p.id, p])
    );

    // Auction-IDs + User-IDs fuer Bulk-Dedup-Check laden
    const auctionIds = instantBuyAuctions.map((x) => x.auction.id);
    const { data: alreadySent } = await supabase
      .from("instant_buy_alerts_sent")
      .select("auction_id, user_id")
      .in("auction_id", auctionIds)
      .in("user_id", alertUserIds);

    const sentPairs = new Set(
      ((alreadySent || []) as Array<{ auction_id: string; user_id: string }>).map((r) => `${r.auction_id}:${r.user_id}`)
    );

    let sent = 0;
    let queued = 0;
    let skipped = 0;
    let failed = 0;

    for (const { auction, m } of instantBuyAuctions) {
      for (const alert of alerts as DealerAlertRow[]) {
        const pairKey = `${auction.id}:${alert.user_id}`;
        if (sentPairs.has(pairKey)) continue;

        // Eigene Listings niemals an den Verkaeufer alerten.
        if (m.seller_id && m.seller_id === alert.user_id) continue;

        if (!matches(alert, m)) continue;

        const profile = profileByUser.get(alert.user_id);
        if (!profile?.email) {
          skipped++;
          continue;
        }
        if (profile.email_bounced) {
          skipped++;
          continue;
        }

        const userPrefs = prefsByUser.get(alert.user_id);
        if (userPrefs) {
          if (userPrefs.email_new_auction === false) {
            skipped++;
            continue;
          }
          if (userPrefs.broadcast_emails_enabled === false) {
            skipped++;
            continue;
          }
        }

        // Email aufbauen
        const userName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email.split("@")[0];
        const vehicleTitle = `${m.manufacturer || "?"} ${m.model || ""} (${m.year ?? "–"})`.trim();
        const price = formatPrice(m.instant_price);
        const auctionUrl = `https://caravanwert.de/auktion/${auction.id}`;
        const details =
          detailRow("Festpreis", `<strong style="color: #d97706;">${price}</strong>`) +
          (m.body_type ? detailRow("Aufbauart", m.body_type) : "") +
          (m.mileage != null ? detailRow("Kilometerstand", `${Number(m.mileage).toLocaleString("de-DE")} km`) : "") +
          (m.city ? detailRow("Standort", `${m.city}${m.country ? ", " + m.country : ""}`) : "");

        const content =
          greeting(userName) +
          paragraph(`Ein neues Sofortkauf-Inserat entspricht Ihrem Suchagent.`) +
          auctionEmailCard(auctionUrl, vehicleTitle, details, pickPrimaryPhotoUrl(m.photos)) +
          paragraph("Wer zuerst zugreift, bekommt das Fahrzeug. Zum Festpreis – ohne Bieten, ohne Wartezeit.") +
          button("Jetzt kaufen", auctionUrl, settingsData) +
          paragraph(
            `<span style="font-size: 12px; color: #6b7280;">Sie erhalten diese E-Mail, weil Sie einen Sofortkauf-Alert konfiguriert haben. ` +
              `<a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2;">Alert-Filter anpassen</a></span>`
          );

        const subject = `Neuer Sofortkauf: ${m.manufacturer || ""} ${m.model || ""} – ${price}`.trim();
        const html = buildEmailLayout(settingsData, subject, content);

        // Dedup-Log IMMER schreiben (auch bei Queue), damit der naechste
        // Cron-Run die gleiche (auction, user)-Kombination nicht erneut
        // bearbeitet. upsert mit ON CONFLICT DO NOTHING waere sauberer,
        // aber der Primary Key macht ein Insert mit on_conflict=(auction_id,user_id)
        // zu einem Race-Safety-Guard.
        const { error: dedupErr } = await supabase
          .from("instant_buy_alerts_sent")
          .insert({ auction_id: auction.id, user_id: alert.user_id });

        if (dedupErr) {
          // unique_violation (23505) = paralleler Cron-Run hat schon gesendet.
          if ((dedupErr as { code?: string }).code === "23505") {
            skipped++;
            continue;
          }
          console.error(`[send-instant-buy-alert] dedup insert failed for ${pairKey}:`, dedupErr);
          failed++;
          continue;
        }

        // Quiet-Hours-Deferral
        const deferUntil = userPrefs
          ? deferIfQuiet(
              { quiet_hours_start: userPrefs.quiet_hours_start, quiet_hours_end: userPrefs.quiet_hours_end },
              "dealer_instant_buy_alert"
            )
          : null;

        if (deferUntil) {
          const { error: queueErr } = await supabase.from("admin_emails").insert({
            sender_email: "info@caravanwert.de",
            sender_name: settingsData.site_name,
            recipient_email: profile.email,
            recipient_name: userName || null,
            recipient_id: alert.user_id,
            subject,
            body_html: html,
            body_text: "",
            email_type: "dealer_instant_buy_alert",
            direction: "outbound",
            status: "queued",
            scheduled_at: deferUntil.toISOString(),
            is_read: true,
          });
          if (queueErr) {
            console.error(`[send-instant-buy-alert] queue insert failed for ${profile.email}:`, queueErr.message);
            failed++;
          } else {
            queued++;
          }
          continue;
        }

        // Sofort senden
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `${settingsData.site_name} <info@caravanwert.de>`,
              to: [profile.email],
              subject,
              html,
              reply_to: "info@caravanwert.de",
              headers: {
                "List-Unsubscribe": "<https://caravanwert.de/dashboard/profile>",
              },
            }),
          });

          if (!emailResponse.ok) {
            const errText = await emailResponse.text();
            throw new Error(errText);
          }
          const resendResult = await emailResponse.json();

          await supabase.from("admin_emails").insert({
            sender_email: "info@caravanwert.de",
            sender_name: settingsData.site_name,
            recipient_email: profile.email,
            recipient_name: userName || null,
            recipient_id: alert.user_id,
            subject,
            body_html: html,
            body_text: "",
            email_type: "dealer_instant_buy_alert",
            direction: "outbound",
            status: "sent",
            resend_id: resendResult?.id ?? null,
            is_read: true,
          });

          await supabase
            .from("dealer_instant_buy_alerts")
            .update({ last_alert_at: now.toISOString() })
            .eq("user_id", alert.user_id);

          sent++;
        } catch (sendErr: any) {
          console.error(`[send-instant-buy-alert] send failed for ${profile.email}:`, sendErr?.message ?? sendErr);
          failed++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned_auctions: instantBuyAuctions.length,
        enabled_alerts: alerts.length,
        sent,
        queued,
        skipped,
        failed,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-instant-buy-alert] fatal:", error?.message ?? error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
