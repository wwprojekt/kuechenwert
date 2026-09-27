/**
 * Freiwillige E-Mails, die ein Konto selbst abbestellen kann. Transaktionale
 * Mails (Projektlinks, Angebote, Zuschlag, Auftragsschritte, Rechnungen) hängen
 * nicht an diesen Einstellungen.
 *
 * Die Auflösung fehlender Werte muss zu send-broadcast-email passen:
 * Plattform-Hinweise gehen an alle, die sich nicht abgemeldet haben; Newsletter
 * und Werbung nur an Konten mit ausdrücklicher Einwilligung (§ 7 Abs. 2 UWG).
 */
export interface EmailPreferences {
  broadcast: boolean;
  newsletter: boolean;
  promotional: boolean;
}

export type EmailPreferenceKey = keyof EmailPreferences;

export type EmailAudience = "dealer" | "consumer";

export interface EmailPreferenceRow {
  broadcast_emails_enabled: boolean | null;
  newsletter_enabled: boolean | null;
  promotional_emails: boolean | null;
}

export const EMAIL_PREFERENCE_DEFAULTS: EmailPreferences = {
  broadcast: true,
  newsletter: false,
  promotional: false,
};

export const EMAIL_PREFERENCE_OPTIONS: Record<EmailAudience, ReadonlyArray<{ key: EmailPreferenceKey; label: string; description: string }>> = {
  dealer: [
    { key: "broadcast", label: "Hinweise für Partner-Studios", description: "Neue Funktionen der Projekt-Börse, geänderte Abläufe und wichtige Mitteilungen." },
    { key: "newsletter", label: "Newsletter", description: "Tipps für mehr Aufträge und Neuigkeiten aus der Küchenbranche." },
    { key: "promotional", label: "Aktionen", description: "Angebote und Aktionen von KüchenWert für Küchenstudios." },
  ],
  consumer: [
    { key: "broadcast", label: "Hinweise zu KüchenWert", description: "Wichtige Neuigkeiten zu Ihrem Konto und unserem Service." },
    { key: "newsletter", label: "Newsletter", description: "Ratgeber, Planungstipps und Trends rund um die Küche." },
    { key: "promotional", label: "Aktionen", description: "Angebote und Aktionen von KüchenWert." },
  ],
};

export function resolveEmailPreferences(row: EmailPreferenceRow | null): EmailPreferences {
  return {
    broadcast: row?.broadcast_emails_enabled !== false,
    newsletter: row?.newsletter_enabled === true,
    promotional: row?.promotional_emails === true,
  };
}

/** Schreibt immer alle drei Werte, damit eine neu angelegte Zeile keine Einwilligung aus Spalten-Defaults erbt. */
export function toEmailPreferenceRow(userId: string, prefs: EmailPreferences): EmailPreferenceRow & { user_id: string } {
  return {
    user_id: userId,
    broadcast_emails_enabled: prefs.broadcast,
    newsletter_enabled: prefs.newsletter,
    promotional_emails: prefs.promotional,
  };
}
