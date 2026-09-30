/**
 * Inhalte der Supabase-Auth-Mails (Send-Email-Hook kw-auth-email).
 *
 * Links führen auf /auth/confirm?token_hash=…&type=… (verifyOtp im Browser,
 * src/pages/AuthConfirm.tsx): Mail-Scanner, die Links vorab abrufen, führen
 * kein JavaScript aus und verbrauchen den Token deshalb nicht.
 *
 * Die Anrede bleibt neutral: Registrierungsdaten wie der Name kommen
 * ungeprüft vom Absender des Formulars und dürfen nicht in Mails an fremde
 * Adressen landen.
 */

import { BRAND, BRAND_LEGAL } from "./brand-config.ts";
import { buildEmailLayout, button, codeDisplay, greeting, linkFallback, paragraph, type Settings } from "./email-builder.ts";

export interface AuthHookUser {
  id?: string;
  email?: string | null;
  new_email?: string | null;
}

export interface AuthHookEmailData {
  email_action_type: string;
  token?: string;
  token_hash?: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to?: string;
  site_url?: string;
  old_email?: string;
}

export interface AuthMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Wert für admin_emails.email_type. */
  emailType: string;
  /** Tokens und Hashes, die das Mail-Protokoll nicht speichern darf. */
  secrets: string[];
}

interface MailContent {
  subject: string;
  title: string;
  intro: string[];
  action?: { label: string; url: string };
  code?: string;
  outro: string[];
}

const SETTINGS: Settings = {
  site_name: BRAND.name,
  site_description: BRAND.tagline,
  contact_email: BRAND.supportEmail,
  support_phone: BRAND_LEGAL.phone,
};

const LOCAL_ORIGIN = /^http:\/\/localhost(?::\d+)?$/;
const WWW_ORIGIN = `https://www.${BRAND.domain}`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function parseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Origin der Links: localhost beim Entwickeln, sonst immer die Produktions-Domain. */
export function linkOrigin(redirectTo: string | undefined): string {
  const url = parseUrl(redirectTo);
  return url && LOCAL_ORIGIN.test(url.origin) ? url.origin : BRAND.baseUrl;
}

/**
 * Ziel nach der Bestätigung, nur eigene Seiten. "/" und /auth/confirm bleiben
 * leer, dann wählt AuthConfirm das Ziel passend zum Typ.
 */
export function nextPath(redirectTo: string | undefined, origin: string): string | null {
  const url = parseUrl(redirectTo);
  if (!url) return null;
  const sameSite = url.origin === origin || (origin === BRAND.baseUrl && url.origin === WWW_ORIGIN);
  if (!sameSite || url.pathname === "/" || url.pathname.startsWith("//") || url.pathname.startsWith("/auth/confirm")) {
    return null;
  }
  return url.pathname + url.search;
}

export function confirmLink(origin: string, tokenHash: string, type: string, next: string | null): string {
  const params = new URLSearchParams({ token_hash: tokenHash, type });
  if (next) params.set("redirect_to", next);
  return `${origin}/auth/confirm?${params.toString()}`;
}

export function redactSecrets(text: string, secrets: string[]): string {
  return secrets.filter((s) => s.length >= 6).reduce((out, secret) => out.split(secret).join("[entfernt]"), text);
}

function renderHtml(c: MailContent): string {
  const url = c.action ? escapeHtml(c.action.url) : "";
  const parts = [
    greeting(),
    ...c.intro.map((t) => paragraph(escapeHtml(t))),
    c.code ? codeDisplay("Bestätigungscode", escapeHtml(c.code)) : "",
    c.action ? button(escapeHtml(c.action.label), url) : "",
    c.action ? linkFallback(url) : "",
    ...c.outro.map((t) => paragraph(escapeHtml(t))),
  ];
  return buildEmailLayout(SETTINGS, escapeHtml(c.title), parts.join(""));
}

function renderText(c: MailContent): string {
  return [
    c.title,
    "",
    "Guten Tag,",
    "",
    ...c.intro.flatMap((t) => [t, ""]),
    ...(c.code ? [`Bestätigungscode: ${c.code}`, ""] : []),
    ...(c.action ? [`${c.action.label}: ${c.action.url}`, ""] : []),
    ...c.outro.flatMap((t) => [t, ""]),
    "Mit freundlichen Grüßen",
    `Ihr ${BRAND.name} Team`,
    "",
    `${BRAND.domain} · ${BRAND.supportEmail} · ${BRAND_LEGAL.phone}`,
    `${BRAND_LEGAL.company} · ${BRAND_LEGAL.street}, ${BRAND_LEGAL.postalCode} ${BRAND_LEGAL.city}`,
    `${BRAND_LEGAL.registerCourt}, ${BRAND_LEGAL.registerNumber} · Geschäftsführung: ${BRAND_LEGAL.managingDirector}`,
  ].join("\n");
}

function mail(to: string | null | undefined, emailType: string, content: MailContent, secrets: string[]): AuthMail {
  const address = to?.trim();
  if (!address) throw new Error(`Empfänger fehlt (${emailType})`);
  return { to: address, subject: content.subject, html: renderHtml(content), text: renderText(content), emailType, secrets };
}

const SECURITY_OUTRO = [
  "Waren Sie das nicht? Setzen Sie bitte sofort Ihr Passwort zurück und antworten Sie auf diese E-Mail, wir helfen Ihnen.",
];

const NOTIFICATIONS: Record<string, { subject: string; text: (user: AuthHookUser, data: AuthHookEmailData) => string }> = {
  password_changed_notification: {
    subject: "Ihr Passwort wurde geändert",
    text: () => `das Passwort Ihres ${BRAND.name}-Kontos wurde soeben geändert.`,
  },
  email_changed_notification: {
    subject: "Ihre E-Mail-Adresse wurde geändert",
    text: (user, data) =>
      data.old_email
        ? `die E-Mail-Adresse Ihres ${BRAND.name}-Kontos wurde von ${data.old_email} auf ${user.email ?? "eine neue Adresse"} geändert.`
        : `die E-Mail-Adresse Ihres ${BRAND.name}-Kontos wurde soeben geändert.`,
  },
  phone_changed_notification: {
    subject: "Ihre Telefonnummer wurde geändert",
    text: () => `die Telefonnummer Ihres ${BRAND.name}-Kontos wurde soeben geändert.`,
  },
  identity_linked_notification: {
    subject: "Neue Anmeldemethode verknüpft",
    text: () => `mit Ihrem ${BRAND.name}-Konto wurde soeben eine weitere Anmeldemethode verknüpft.`,
  },
  identity_unlinked_notification: {
    subject: "Anmeldemethode entfernt",
    text: () => `von Ihrem ${BRAND.name}-Konto wurde soeben eine Anmeldemethode entfernt.`,
  },
  mfa_factor_enrolled_notification: {
    subject: "Zwei-Faktor-Anmeldung eingerichtet",
    text: () => `für Ihr ${BRAND.name}-Konto wurde soeben ein zweiter Faktor für die Anmeldung eingerichtet.`,
  },
  mfa_factor_unenrolled_notification: {
    subject: "Zwei-Faktor-Anmeldung entfernt",
    text: () => `von Ihrem ${BRAND.name}-Konto wurde soeben ein zweiter Faktor für die Anmeldung entfernt.`,
  },
};

/** Baut die Mails für einen Hook-Aufruf; wirft bei unbekanntem Typ oder fehlenden Daten. */
export function buildAuthMails(user: AuthHookUser, data: AuthHookEmailData): AuthMail[] {
  const type = data.email_action_type;
  const origin = linkOrigin(data.redirect_to);
  const next = nextPath(data.redirect_to, origin);
  const link = (hash: string | undefined, linkType = type) => {
    if (!hash) throw new Error(`token_hash fehlt (${type})`);
    return confirmLink(origin, hash, linkType, next);
  };
  const secretsOf = (...values: Array<string | undefined>) => values.filter((v): v is string => !!v);

  switch (type) {
    case "signup":
      return [
        mail(user.email, "auth_signup", {
          subject: "Bitte bestätigen Sie Ihre E-Mail-Adresse",
          title: "E-Mail-Adresse bestätigen",
          intro: [`vielen Dank für Ihre Registrierung bei ${BRAND.name}. Bitte bestätigen Sie Ihre E-Mail-Adresse, damit Ihr Konto aktiv wird.`],
          action: { label: "E-Mail-Adresse bestätigen", url: link(data.token_hash) },
          outro: ["Sie haben sich nicht registriert? Dann ignorieren Sie diese E-Mail einfach, ohne Bestätigung wird kein Konto aktiv."],
        }, secretsOf(data.token_hash, data.token)),
      ];
    case "invite":
      return [
        mail(user.email, "auth_invite", {
          subject: `Ihre Einladung zu ${BRAND.name}`,
          title: "Sie wurden eingeladen",
          intro: [`Sie wurden zu ${BRAND.name} eingeladen. Über den folgenden Link nehmen Sie die Einladung an.`],
          action: { label: "Einladung annehmen", url: link(data.token_hash) },
          outro: ["Sie erwarten keine Einladung? Dann ignorieren Sie diese E-Mail einfach."],
        }, secretsOf(data.token_hash, data.token)),
      ];
    case "magiclink":
    case "email":
      return [
        mail(user.email, type === "email" ? "auth_email" : "auth_magiclink", {
          subject: `Ihr Anmeldelink für ${BRAND.name}`,
          title: `Anmelden bei ${BRAND.name}`,
          intro: ["mit dem folgenden Link melden Sie sich ohne Passwort an. Der Link funktioniert nur einmal."],
          action: { label: "Jetzt anmelden", url: link(data.token_hash) },
          outro: ["Sie haben keinen Anmeldelink angefordert? Dann ignorieren Sie diese E-Mail, ohne Klick passiert nichts."],
        }, secretsOf(data.token_hash, data.token)),
      ];
    case "recovery":
      return [
        mail(user.email, "auth_recovery", {
          subject: "Passwort zurücksetzen",
          title: "Neues Passwort festlegen",
          intro: [`Sie möchten Ihr Passwort für ${BRAND.name} zurücksetzen. Über den folgenden Link legen Sie ein neues Passwort fest.`],
          action: { label: "Neues Passwort festlegen", url: link(data.token_hash) },
          outro: ["Sie haben das nicht angefordert? Dann ignorieren Sie diese E-Mail, Ihr bisheriges Passwort bleibt gültig."],
        }, secretsOf(data.token_hash, data.token)),
      ];
    case "email_change": {
      // Supabase benennt die Hashes umgekehrt: token_hash_new gehört zur
      // bisherigen Adresse (user.email), token_hash zur neuen (user.new_email).
      const toNew = mail(user.new_email, "auth_email_change", {
        subject: "Neue E-Mail-Adresse bestätigen",
        title: "Neue E-Mail-Adresse bestätigen",
        intro: [`bitte bestätigen Sie diese Adresse als neue E-Mail-Adresse Ihres ${BRAND.name}-Kontos.`],
        action: { label: "Neue Adresse bestätigen", url: link(data.token_hash) },
        outro: ["Sie haben keine Änderung angefordert? Dann ignorieren Sie diese E-Mail einfach."],
      }, secretsOf(data.token_hash, data.token_new, data.token));
      if (!data.token_hash_new) return [toNew];
      const toCurrent = mail(user.email, "auth_email_change", {
        subject: "Änderung Ihrer E-Mail-Adresse bestätigen",
        title: "Änderung der E-Mail-Adresse bestätigen",
        intro: [`Sie möchten die E-Mail-Adresse Ihres ${BRAND.name}-Kontos auf ${user.new_email} ändern. Bitte bestätigen Sie die Änderung auch von Ihrer bisherigen Adresse aus.`],
        action: { label: "Änderung bestätigen", url: link(data.token_hash_new) },
        outro: SECURITY_OUTRO,
      }, secretsOf(data.token_hash_new, data.token));
      return [toCurrent, toNew];
    }
    case "reauthentication": {
      if (!data.token) throw new Error("token fehlt (reauthentication)");
      return [
        mail(user.email, "auth_reauthentication", {
          subject: "Ihr Bestätigungscode",
          title: "Bestätigungscode",
          intro: [`geben Sie diesen Code ein, um die Änderung in Ihrem ${BRAND.name}-Konto zu bestätigen. Er gilt nur kurze Zeit.`],
          code: data.token,
          outro: SECURITY_OUTRO,
        }, secretsOf(data.token)),
      ];
    }
    default: {
      const notice = NOTIFICATIONS[type];
      if (!notice) throw new Error(`Unbekannter E-Mail-Typ: ${type}`);
      const to = type === "email_changed_notification" ? data.old_email || user.email : user.email;
      return [
        mail(to, "auth_notification", {
          subject: notice.subject,
          title: notice.subject,
          intro: [notice.text(user, data)],
          action: { label: "Passwort zurücksetzen", url: `${BRAND.baseUrl}/forgot-password` },
          outro: SECURITY_OUTRO,
        }, []),
      ];
    }
  }
}
