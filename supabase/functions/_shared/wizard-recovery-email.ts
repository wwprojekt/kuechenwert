// Shared builder for wizard recovery emails.
//
// Wird sowohl vom 5-Minuten-Cron (`process-abandoned-wizards`) als auch vom
// manuellen Admin-Trigger (`send-wizard-resume-email`) verwendet, damit beide
// Wege identisch aussehen und gleichzeitig vom CaravanWert-Branding profitieren.
//
// Designziele:
//   1. 100 % Brand-Konsistenz mit `_shared/email-builder.ts` (Teal #1f8aa2,
//      keine Alt-Farben wie das fr\u00fchere Gr\u00fcn #195d3e).
//   2. Personalisierter Subject + Preview-Text \u2192 h\u00f6here Open-Rate in
//      Inbox-Listen (Gmail/Apple Mail zeigen die ersten ~110 Zeichen vor).
//   3. Vehicle-Card mit Marke/Modell/Baujahr/Karosserie als visueller Anker.
//   4. Variant-A First-Reminder (freundlich, fortschrittsorientiert).
//   5. Variant-B Followup (verkaufsst\u00e4rker, "letzte Erinnerung", Marktdaten).

import {
  buildEmailLayout,
  paragraph,
  button,
  detailRow,
  list,
  divider,
  type Settings,
} from "./email-builder.ts";

const STEP_NAMES: Record<number, string> = {
  1: "Fahrzeugtyp",
  2: "Fahrzeugdaten",
  3: "Details & Technik",
  4: "Ausstattung",
  5: "Kontakt",
  6: "Fotos",
  7: "Verkaufsweg & Telefon",
  8: "Standort & Konto",
};

// Brand-Farben m\u00fcssen in mehreren Helpern verf\u00fcgbar sein. Wir spiegeln sie
// hier 1:1 aus _shared/email-builder.ts (BRAND-Konstante ist dort bewusst
// privat). Falls die Farben dort gepflegt werden, m\u00fcssen sie hier mit
// nachgezogen werden \u2013 daf\u00fcr gibt's diesen Kommentar.
const COLOR = {
  primary: "#1f8aa2",
  primaryLight: "#239cb8",
  primaryDark: "#1a7489",
  primaryDarker: "#0f4f5c",
  text: "#374151",
  textLight: "#6b7280",
  heading: "#111827",
  bgGray: "#f1f5f9",
  border: "#e2e8f0",
  successText: "#065f46",
  warningText: "#92400e",
};

export interface WizardSession {
  id: string;
  customer_email?: string | null;
  customer_name?: string | null;
  current_step?: number | null;
  max_step_reached?: number | null;
  total_steps?: number | null;
  resume_token?: string | null;
  form_data?: Record<string, unknown> | null;
  vehicle_summary?: string | null;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  /** Inbox-Vorschau (Apple Mail, Gmail) */
  previewText: string;
}

/**
 * H\u00f6chster sinnvoller Step f\u00fcr das Resume-UI: nimmt `max_step_reached`,
 * f\u00e4llt auf `current_step` zur\u00fcck. Sch\u00fctzt vor Tracking-Inkonsistenzen
 * (z. B. step_name="Fahrzeugtyp" + max=7 in alten Datens\u00e4tzen).
 */
function effectiveStep(session: WizardSession): number {
  const max = session.max_step_reached ?? 0;
  const current = session.current_step ?? 0;
  const step = Math.max(max, current, 1);
  return Math.min(step, session.total_steps || 8);
}

function vehicleNameFromSession(session: WizardSession): string {
  const fd = session.form_data || {};
  const parts = [
    typeof fd.manufacturer === "string" ? fd.manufacturer : "",
    typeof fd.model === "string" ? fd.model : "",
    typeof fd.year === "number" || typeof fd.year === "string" ? `(${fd.year})` : "",
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (session.vehicle_summary && session.vehicle_summary !== "Noch keine Fahrzeugdaten") {
    return session.vehicle_summary;
  }
  return "Ihr Wohnmobil";
}

function bodyTypeLabel(session: WizardSession): string {
  const fd = session.form_data || {};
  const v = typeof fd.bodyType === "string" ? fd.bodyType : "";
  return v.trim();
}

function vehicleTypeLabel(session: WizardSession): string {
  const fd = session.form_data || {};
  const v =
    typeof fd.vehicleType === "string"
      ? fd.vehicleType
      : typeof fd.vehicle_type === "string"
        ? fd.vehicle_type
        : "";
  return v.trim() || "Wohnmobil";
}

function buildResumeUrl(session: WizardSession, source: string): string {
  if (session.resume_token) {
    return `https://caravanwert.de/verkaufen/wizard?token=${encodeURIComponent(
      session.resume_token,
    )}&source=${source}`;
  }
  const step = effectiveStep(session);
  return `https://caravanwert.de/verkaufen/wizard?step=${step}&source=${source}`;
}

/**
 * Hidden preview text: Email-Clients (Apple Mail, Gmail, Outlook) zeigen
 * die ersten ~110 Zeichen aus dem HTML-Body als Vorschau in der Inbox.
 * Mit diesem Trick steuern wir die Vorschau gezielt, ohne sichtbares
 * Layout zu ver\u00e4ndern. Das whitespace-padding am Ende verhindert dass
 * danach noch andere Body-Inhalte (z. B. der Greeting) reinleaken.
 */
function previewBlock(text: string): string {
  const safe = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#ffffff;line-height:1px;">${safe}${"&nbsp;".repeat(80)}</div>`;
}

/**
 * Visual progress bar im Brand-Teal. Wird in beiden Mails verwendet.
 */
function progressBar(currentStep: number, totalSteps: number): string {
  const pct = Math.max(0, Math.min(100, Math.round((currentStep / totalSteps) * 100)));
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 12px 0 6px;">
      <tr>
        <td>
          <div style="background-color: ${COLOR.bgGray}; border-radius: 999px; height: 14px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, ${COLOR.primaryLight} 0%, ${COLOR.primary} 100%); width: ${pct}%; height: 14px; border-radius: 999px;">&nbsp;</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 6px; text-align: center; font-size: 13px; color: ${COLOR.textLight}; font-weight: 600;">
          Schritt ${currentStep} von ${totalSteps} &middot; ${pct}% abgeschlossen
        </td>
      </tr>
    </table>
  `;
}

/**
 * Vehicle-Card: zeigt Marke, Modell, Baujahr, Karosserie als visuell
 * abgesetzte Box. Liefert dem User einen Anker ("ah, MEIN Inserat").
 */
function vehicleCard(session: WizardSession): string {
  const fd = session.form_data || {};
  const manufacturer = typeof fd.manufacturer === "string" ? fd.manufacturer.trim() : "";
  const model = typeof fd.model === "string" ? fd.model.trim() : "";
  const year =
    typeof fd.year === "number" || (typeof fd.year === "string" && fd.year !== "")
      ? String(fd.year)
      : "";
  const mileage =
    typeof fd.mileage === "number" && fd.mileage > 0
      ? new Intl.NumberFormat("de-DE").format(fd.mileage) + " km"
      : "";
  const vehicleType = vehicleTypeLabel(session);
  const bodyType = bodyTypeLabel(session);

  const titleParts = [manufacturer, model].filter(Boolean);
  const title = titleParts.length > 0 ? titleParts.join(" ") : `Ihr ${vehicleType}-Inserat`;

  const rows: string[] = [];
  if (year) rows.push(detailRow("Baujahr", year));
  if (mileage) rows.push(detailRow("Kilometerstand", mileage));
  if (bodyType) rows.push(detailRow("Aufbau", `${vehicleType} &middot; ${bodyType}`));
  else if (vehicleType) rows.push(detailRow("Fahrzeugtyp", vehicleType));

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid ${COLOR.border}; border-left: 4px solid ${COLOR.primary}; border-radius: 8px; background-color: ${COLOR.bgGray};">
      <tr>
        <td style="padding: 18px 20px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: ${COLOR.textLight}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Ihr Inserat-Entwurf</p>
          <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 700; color: ${COLOR.heading}; line-height: 1.3;">${title}</h3>
          ${rows.join("")}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Trust-Block: 3 Spalten mit Icons. F\u00fcr First-Reminder.
 */
function trustBlock(stepsRemaining: number): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" width="33%" style="padding: 8px;">
          <div style="font-size: 28px; line-height: 1; margin-bottom: 8px;">&#9201;</div>
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLOR.text};">
            <strong style="color: ${COLOR.primaryDark};">Nur ${stepsRemaining} Schritt${stepsRemaining === 1 ? "" : "e"}</strong><br/>
            <span style="color: ${COLOR.textLight};">bis zur Ver\u00f6ffentlichung</span>
          </p>
        </td>
        <td align="center" width="33%" style="padding: 8px;">
          <div style="font-size: 28px; line-height: 1; margin-bottom: 8px;">&#128274;</div>
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLOR.text};">
            <strong style="color: ${COLOR.primaryDark};">100 % kostenlos</strong><br/>
            <span style="color: ${COLOR.textLight};">und unverbindlich</span>
          </p>
        </td>
        <td align="center" width="33%" style="padding: 8px;">
          <div style="font-size: 28px; line-height: 1; margin-bottom: 8px;">&#128664;</div>
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLOR.text};">
            <strong style="color: ${COLOR.primaryDark};">Gepr\u00fcfte H\u00e4ndler</strong><br/>
            <span style="color: ${COLOR.textLight};">in ganz Deutschland</span>
          </p>
        </td>
      </tr>
    </table>
  `;
}

/**
 * First-Reminder \u2013 2 Stunden nach letzter Aktivit\u00e4t.
 *
 * Tone: freundlich-aktivierend. Setzt auf den bereits investierten Aufwand
 * ("Ihre Daten sind gespeichert") + niedrige Resthurde ("nur noch X Schritte").
 *
 * @param session Wizard-Session aus DB
 * @param settings Site-Settings (CaravanWert-Defaults im Caller setzen)
 * @param customMessage Optional: vom Admin manuell mitgegebene Nachricht
 *        (nur send-wizard-resume-email Pfad). Wird oberhalb der CTA gerendert.
 */
export function buildWizardRecoveryFirstEmail(
  session: WizardSession,
  settings: Settings,
  customMessage?: string,
): BuiltEmail {
  const totalSteps = session.total_steps || 8;
  const step = effectiveStep(session);
  const stepName = STEP_NAMES[step] || `Schritt ${step}`;
  const stepsRemaining = Math.max(1, totalSteps - step + 1);
  const customerName = session.customer_name?.trim() || "";
  const greetingName = customerName ? customerName.split(/\s+/)[0] : "";
  const vehicleName = vehicleNameFromSession(session);
  const resumeUrl = buildResumeUrl(session, "recovery_first");

  const subject = vehicleName.startsWith("Ihr")
    ? `Ihr Inserat ist fast fertig \u2013 nur noch ${stepsRemaining} Schritt${stepsRemaining === 1 ? "" : "e"}`
    : `${vehicleName} \u2013 Ihr Inserat ist fast fertig`;

  const previewText = `Sie sind bei Schritt ${step} von ${totalSteps} (${stepName}) stehen geblieben. Klicken Sie hier, um genau dort weiterzumachen.`;

  // Bereits ausgef\u00fcllte Steps als Liste
  const completedItems: string[] = [];
  for (let i = 1; i < step; i++) {
    completedItems.push(`<strong>${STEP_NAMES[i] || `Schritt ${i}`}</strong>`);
  }

  let content = "";

  // Preview-Text (versteckt, steuert Inbox-Vorschau)
  content += previewBlock(previewText);

  // Pers\u00f6nliche Anrede
  content += paragraph(
    greetingName ? `Hallo ${greetingName},` : "Hallo,",
  );

  content += paragraph(
    `Sie haben vor Kurzem begonnen, <strong>${vehicleName}</strong> auf ${settings.site_name} zu inserieren \u2013 sind aber bei <strong>Schritt ${step} (${stepName})</strong> stehen geblieben.`,
  );

  content += paragraph(
    `Keine Sorge: Ihre bisherigen Eingaben sind gespeichert. Mit einem Klick machen Sie genau dort weiter, wo Sie aufgeh\u00f6rt haben.`,
  );

  // Vehicle-Card
  content += vehicleCard(session);

  // Progress-Bar
  content += progressBar(step, totalSteps);

  // Already completed steps (only show if at least 2)
  if (completedItems.length >= 2) {
    content += `
      <p style="margin: 18px 0 6px; font-size: 14px; color: ${COLOR.heading}; font-weight: 600;">Bereits ausgef\u00fcllt:</p>
      ${list(completedItems)}
    `;
  }

  // Custom-Message vom Admin (nur send-wizard-resume-email Pfad)
  if (customMessage && customMessage.trim().length > 0) {
    const safe = customMessage
      .trim()
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
    content += `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
        <tr>
          <td style="background-color: #ecfeff; border-left: 4px solid ${COLOR.primary}; border-radius: 0 8px 8px 0; padding: 16px 20px;">
            <p style="margin: 0 0 8px; font-size: 12px; color: ${COLOR.primaryDark}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Pers\u00f6nliche Nachricht von unserem Team</p>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: ${COLOR.text};">${safe}</p>
          </td>
        </tr>
      </table>
    `;
  }

  // CTA
  content += button("Inserat jetzt fertigstellen", resumeUrl, settings);

  // Trust-Block
  content += trustBlock(stepsRemaining);

  content += divider();

  content += paragraph(
    `Sie haben Fragen oder brauchen Hilfe beim Ausf\u00fcllen? Antworten Sie einfach auf diese E-Mail oder rufen Sie uns an unter <strong style="color: ${COLOR.primaryDark};">${settings.support_phone}</strong>. Wir helfen Ihnen pers\u00f6nlich weiter.`,
  );

  const html = buildEmailLayout(settings, "Ihr Inserat ist fast fertig", content);

  return { subject, html, previewText };
}

/**
 * Followup \u2013 14 Tage nach letzter Aktivit\u00e4t.
 *
 * Tone: verkaufsst\u00e4rker, "letzte Erinnerung". Marktdaten + Knappheits-Hinweis.
 * Variante B aus der Diskussion mit dem User \u2013 konvertiert h\u00f6her als die
 * neutralere Variante A.
 */
export function buildWizardRecoveryFollowupEmail(
  session: WizardSession,
  settings: Settings,
): BuiltEmail {
  const totalSteps = session.total_steps || 8;
  const step = effectiveStep(session);
  const stepName = STEP_NAMES[step] || `Schritt ${step}`;
  const customerName = session.customer_name?.trim() || "";
  const greetingName = customerName ? customerName.split(/\s+/)[0] : "";
  const vehicleName = vehicleNameFromSession(session);
  const resumeUrl = buildResumeUrl(session, "recovery_followup");

  const subject = `${vehicleName} \u2013 letzte Erinnerung`;

  const previewText = `Ihr Inserat-Entwurf wartet seit 2 Wochen. Aktuell suchen \u00fcber 1.500 H\u00e4ndler nach \u00e4hnlichen Fahrzeugen \u2013 nutzen Sie das Momentum.`;

  let content = "";

  content += previewBlock(previewText);

  content += paragraph(
    greetingName ? `Hallo ${greetingName},` : "Hallo,",
  );

  content += paragraph(
    `vor zwei Wochen haben Sie begonnen, <strong>${vehicleName}</strong> auf ${settings.site_name} zu inserieren. Ihr Entwurf ist noch da \u2013 und seitdem ist auf dem Markt einiges passiert.`,
  );

  // Vehicle-Card
  content += vehicleCard(session);

  // Marktdaten-Box (Variante B: Verkaufs-Push)
  content += `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="background: linear-gradient(135deg, ${COLOR.primaryDarker} 0%, ${COLOR.primary} 100%); border-radius: 12px; padding: 24px 28px; color: #ffffff;">
          <p style="margin: 0 0 6px; font-size: 12px; color: rgba(255,255,255,0.85); font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px;">Aktueller Marktstand</p>
          <p style="margin: 0 0 14px; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">\u00dcber 1.500 gepr\u00fcfte H\u00e4ndler<br/>warten auf neue Inserate</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.92);">
            Inserate, die innerhalb der ersten 24 Stunden online gehen, erhalten im Schnitt
            <strong style="color: #ffffff;">3,4&nbsp;Mal mehr Anfragen</strong> als sp\u00e4ter aktivierte Angebote.
            Ihr Wohnmobil wartet \u2013 und der Markt ist gerade besonders nachfragestark.
          </p>
        </td>
      </tr>
    </table>
  `;

  // CTA
  content += button("Jetzt 1 Klick zum Inserat", resumeUrl, settings);

  content += paragraph(
    `Sie waren bereits bei <strong>Schritt ${step} von ${totalSteps} (${stepName})</strong> angekommen. Es fehlen nur noch wenige Angaben \u2013 dann ist Ihr Inserat live.`,
  );

  // 3 Gr\u00fcnde (kompakter als trustBlock)
  content += `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 18px 0;">
      <tr>
        <td style="padding: 10px 0; font-size: 14px; color: ${COLOR.text};">
          <span style="color: ${COLOR.primary}; font-weight: 700;">&#10003;</span>&nbsp;&nbsp;<strong>Kostenlos &amp; unverbindlich</strong> \u2013 keine versteckten Geb\u00fchren
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; font-size: 14px; color: ${COLOR.text};">
          <span style="color: ${COLOR.primary}; font-weight: 700;">&#10003;</span>&nbsp;&nbsp;<strong>Auktion oder Festpreis</strong> \u2013 Sie entscheiden, wir machen den Rest
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; font-size: 14px; color: ${COLOR.text};">
          <span style="color: ${COLOR.primary}; font-weight: 700;">&#10003;</span>&nbsp;&nbsp;<strong>Datenschutz nach DSGVO</strong> \u2013 Ihre Daten bleiben bei uns
        </td>
      </tr>
    </table>
  `;

  content += divider();

  content += paragraph(
    `Brauchen Sie pers\u00f6nliche Unterst\u00fctzung? Wir helfen Ihnen gerne in 5 Minuten am Telefon: <strong style="color: ${COLOR.primaryDark};">${settings.support_phone}</strong> oder per Antwort auf diese E-Mail.`,
  );

  content += `
    <p style="margin: 24px 0 0; font-size: 12px; color: ${COLOR.textLight}; line-height: 1.6;">
      Sie erhalten diese E-Mail, weil Sie auf ${settings.site_name} eine Fahrzeugbewertung begonnen haben.
      Dies ist unsere letzte automatische Erinnerung \u2013 falls Sie kein Interesse mehr haben, k\u00f6nnen Sie diese Nachricht einfach ignorieren.
    </p>
  `;

  const html = buildEmailLayout(settings, "Ihr Inserat-Entwurf wartet noch", content);

  return { subject, html, previewText };
}
