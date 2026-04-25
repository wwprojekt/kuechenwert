/**
 * Quiet-Hours-Helper fuer die Notification-Engine.
 *
 * Bietet zwei Utilities:
 *
 * 1. `isTransactional(emailType)` -- Whitelist jener Email-Typen, die
 *    NIEMALS ausser Dienst gestellt werden duerfen (Rechnungen, Mahnungen,
 *    Auktionsergebnis, Terminbestaetigungen, Vertragsunterlagen,
 *    Auktion-endet-bald-Erinnerung). Quiet-Hours wirken nur auf den
 *    "Marketing/Digest/Soft"-Layer.
 *
 * 2. `computeDeferUntil(prefs, now?)` -- berechnet, ob `now` innerhalb der
 *    User-Quiet-Hours liegt und gibt den Zeitpunkt zurueck, an dem die
 *    Ruhezeit in Europe/Berlin endet. Liegt `now` ausserhalb, kommt `null`
 *    zurueck (sofort senden). Unterstuetzt Wrap-Around-Fenster
 *    (z. B. 22:00--08:00).
 *
 * Zeitzone ist fix **Europe/Berlin** -- `user_notification_preferences.timezone`
 * wird absichtlich nicht mehr ausgewertet, damit Seller/Dealer/Kaeufer ein
 * konsistentes Zustellfenster erleben. Ein einziges DST-Crossover-Event pro
 * Jahr kann eine einzelne Mail um 1h verschieben; das ist akzeptabel.
 */

export type QuietHoursPrefs = {
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
};

const TRANSACTIONAL_EMAIL_TYPES: ReadonlySet<string> = new Set([
  "invoice",
  "payment_confirmation",
  "bid_confirmed",
  "auction_winner",
  "auction_ending_soon",
  "appointment_confirmation",
  "appointment_pin",
  "appointment_reminder",
  "purchase_contract",
  "purchase_contract_notification",
  "handover_protocol_blank",
  "dealer_documents_request",
  "google_review_request",
  "wizard_resume",
  "wizard_recovery_first",
  "wizard_recovery_followup",
  "registration_invite",
  "dealer_registration_invite",
  "dealer_welcome",
  "dealer_approved",
  "dealer_rejected",
  "dealer_suspended",
  "dealer_reactivated",
  "expert_valuation",
  "vehicle_question",
]);

export function isTransactional(emailType: string | null | undefined): boolean {
  if (!emailType) return false;
  if (TRANSACTIONAL_EMAIL_TYPES.has(emailType)) return true;
  if (emailType.startsWith("dunning_")) return true;
  if (emailType === "payment_reminder") return true;
  if (emailType.startsWith("lead_")) return true;
  return false;
}

function parseHHMM(raw: string | null | undefined): { hour: number; minute: number } | null {
  if (!raw) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!m) return null;
  const hour = Number.parseInt(m[1]!, 10);
  const minute = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function getBerlinHourMinute(d: Date): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "hour") hour = Number.parseInt(p.value, 10);
    if (p.type === "minute") minute = Number.parseInt(p.value, 10);
  }
  // `de-DE` with hour12:false kann fuer Mitternacht "24" liefern
  if (hour === 24) hour = 0;
  return { hour, minute };
}

export function computeDeferUntil(
  prefs: QuietHoursPrefs,
  now: Date = new Date()
): Date | null {
  const start = parseHHMM(prefs.quiet_hours_start ?? null);
  const end = parseHHMM(prefs.quiet_hours_end ?? null);
  if (!start || !end) return null;

  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;
  if (startMin === endMin) return null;

  const berlin = getBerlinHourMinute(now);
  const nowMin = berlin.hour * 60 + berlin.minute;

  let minutesToDefer: number | null = null;

  if (startMin < endMin) {
    if (nowMin >= startMin && nowMin < endMin) {
      minutesToDefer = endMin - nowMin;
    }
  } else {
    if (nowMin >= startMin) {
      minutesToDefer = 24 * 60 - nowMin + endMin;
    } else if (nowMin < endMin) {
      minutesToDefer = endMin - nowMin;
    }
  }

  if (minutesToDefer === null) return null;
  return new Date(now.getTime() + minutesToDefer * 60 * 1000);
}

/**
 * Shortcut fuer Call-Sites, die Pref-Row + Email-Typ in einem Rutsch pruefen.
 * Gibt `null` zurueck wenn sofort gesendet werden kann (Transactional, keine
 * Ruhezeit aktiv, oder keine Prefs vorhanden), sonst den Defer-Zeitpunkt.
 */
export function deferIfQuiet(
  prefs: QuietHoursPrefs | null | undefined,
  emailType: string | null | undefined,
  now: Date = new Date()
): Date | null {
  if (!prefs) return null;
  if (isTransactional(emailType)) return null;
  return computeDeferUntil(prefs, now);
}
