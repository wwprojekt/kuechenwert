/**
 * "Neu"-Badge — Logik für frisch live gegangene Auktionen
 * ---------------------------------------------------------
 *
 * Ziel: Käufer sollen sofort erkennen, welche Inserate gerade neu online
 * sind, damit frisch gelistete Fahrzeuge mehr Sichtbarkeit bekommen.
 *
 * Kern-Design-Entscheidung (wichtig):
 * -----------------------------------
 * Anker-Zeitstempel ist `auctions.start_time` (mit Fallback `auctions.created_at`)
 * — NICHT `motorhomes.created_at`. Der Grund:
 *
 *   Ein Fahrzeug kann beliebig lange als Draft (motorhomes.status = 'draft')
 *   beim Verkäufer liegen, bevor er die Auktion startet. Während dieser Zeit
 *   existiert noch KEINE auctions-Zeile — das Fahrzeug ist nicht öffentlich
 *   sichtbar.
 *
 *   Würden wir gegen `motorhomes.created_at` messen, würde ein Verkäufer,
 *   der 2 Wochen an seinem Inserat feilt, nie ein "Neu"-Badge bekommen,
 *   obwohl sein Inserat am Go-Live-Tag für Käufer genauso frisch ist wie
 *   das eines hektischen Verkäufers. Das wäre semantisch falsch.
 *
 *   Mit `auctions.start_time` beginnt der 7-Tage-Timer zum Zeitpunkt des
 *   ersten öffentlichen Sichtbarwerdens — Draft-Zeit wird neutralisiert.
 *
 * Zweite Regel: Nur `auction_round === 1`
 * ----------------------------------------
 * Das Auto-Relist-System (close-auction Edge Function) und manuelle
 * Admin-Relists zählen `auction_round` hoch. Bei Runde 2+ ist das Inserat
 * KEIN "Neu" mehr — niemand wollte es in Runde 1, das Wissen soll beim
 * Käufer ankommen (deshalb eskaliert AuctionRoundBadge ab Runde 2 für
 * Händler in Gelb/Orange/Rot).
 *
 * Konsequenz: Das öffentliche "Neu"-Badge erscheint ausschließlich wenn
 * BEIDE Bedingungen erfüllt sind:
 *   1. auction_round === 1 (erste Auktion für dieses Fahrzeug)
 *   2. start_time (oder created_at) ist weniger als 7 Tage her
 *
 * Gilt gleichermaßen für sale_channel = 'auction' UND 'instant_price' —
 * auch Festpreis-Inserate haben eine auctions-Zeile mit start_time und
 * auction_round, und ein frisch eingestellter Festpreis ist genauso
 * interessant für Käufer.
 */

/** Anzahl Tage, für die ein frisches Inserat als "Neu" gilt. */
export const FRESH_BADGE_DAYS = 7;

/**
 * Liefert `true`, wenn die Auktion öffentlich als "Neu" markiert werden soll.
 *
 * Bewusst client-seitig/stateless berechnet — keine DB-Spalte, kein Cron.
 * Das Badge "verschwindet" automatisch nach 7 Tagen beim nächsten Render,
 * ohne dass der Server etwas tun muss.
 *
 * @param startTime         `auctions.start_time` (ISO-String, non-null per Schema)
 * @param auctionCreatedAt  `auctions.created_at` als Fallback (für Bestands-Auktionen,
 *                          bei denen start_time theoretisch NULL sein könnte)
 * @param auctionRound      `auctions.auction_round` — Default in DB ist 1
 * @param nowMs             Aktuelle Zeit (Parameter für Testbarkeit, Default: Date.now())
 */
export function isFreshAuction(
  startTime: string | null | undefined,
  auctionCreatedAt: string | null | undefined,
  auctionRound: number | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const round = typeof auctionRound === "number" && Number.isFinite(auctionRound)
    ? Math.floor(auctionRound)
    : 1;
  if (round > 1) return false;

  const anchorIso = startTime || auctionCreatedAt;
  if (!anchorIso) return false;

  const anchor = Date.parse(anchorIso);
  if (!Number.isFinite(anchor)) return false;

  const ageMs = nowMs - anchor;
  if (ageMs < 0) return false; // geplanter Start in der Zukunft — noch nicht live
  return ageMs < FRESH_BADGE_DAYS * 24 * 60 * 60 * 1000;
}
