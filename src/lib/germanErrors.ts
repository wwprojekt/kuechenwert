/**
 * Zentrales deutsches Fehlermeldungssystem
 * 
 * Übersetzt alle englischen Fehlermeldungen (Supabase, Zod, Browser-APIs)
 * in verständliche deutsche Fehlermeldungen für Kunden und Händler.
 */

import { z } from 'zod';

// ============================================================================
// Fehlercode-Definitionen
// ============================================================================

export type ErrorCategory = 'validation' | 'auth' | 'api' | 'business' | 'system' | 'ui' | 'unknown';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface GermanError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
}

// ============================================================================
// Zod / Validierungsfehler auf Deutsch
// ============================================================================

const ZOD_ERROR_MAP: Record<string, string> = {
  // Typ-Fehler
  'Expected number, received null': 'Bitte geben Sie eine Zahl ein. Dieses Feld darf nicht leer sein.',
  'Expected number, received nan': 'Bitte geben Sie eine gültige Zahl ein.',
  'Expected number, received string': 'Bitte geben Sie eine Zahl ein (keine Buchstaben).',
  'Expected string, received number': 'Bitte geben Sie einen Text ein.',
  'Expected string, received null': 'Dieses Feld darf nicht leer sein.',
  'Expected boolean, received null': 'Bitte wählen Sie eine Option aus.',
  'Expected array, received null': 'Bitte wählen Sie mindestens einen Eintrag aus.',
  'Expected object, received null': 'Bitte füllen Sie alle erforderlichen Felder aus.',
  
  // Pflichtfeld-Fehler
  'Required': 'Dieses Feld ist ein Pflichtfeld.',
  'required': 'Dieses Feld ist ein Pflichtfeld.',
  
  // String-Validierung
  'String must contain at least 1 character(s)': 'Dieses Feld darf nicht leer sein.',
  'Invalid email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  'Invalid url': 'Bitte geben Sie eine gültige URL ein.',
  'Invalid uuid': 'Ungültige ID. Bitte versuchen Sie es erneut.',
  
  // Zahlen-Validierung
  'Number must be greater than or equal to 0': 'Der Wert darf nicht negativ sein.',
  'Number must be greater than 0': 'Der Wert muss größer als 0 sein.',
  'Number must be less than or equal to': 'Der Wert ist zu hoch.',
  'Number must be greater than or equal to': 'Der Wert ist zu niedrig.',
  
  // Array-Validierung
  'Array must contain at least': 'Es werden mehr Einträge benötigt.',
  'Array must contain at most': 'Es sind zu viele Einträge.',
  
  // Enum-Validierung
  'Invalid enum value': 'Bitte wählen Sie einen gültigen Wert aus der Liste.',
  
  // Datum
  'Invalid date': 'Bitte geben Sie ein gültiges Datum ein.',
};

// ============================================================================
// Supabase Auth-Fehler auf Deutsch
// ============================================================================

const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Ungültige E-Mail-Adresse oder Passwort. Bitte überprüfen Sie Ihre Eingaben.',
  'Email not confirmed': 'Ihre E-Mail-Adresse wurde noch nicht bestätigt. Bitte prüfen Sie Ihren Posteingang.',
  'User already registered': 'Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an oder verwenden Sie eine andere E-Mail.',
  'already registered': 'Diese E-Mail-Adresse ist bereits registriert.',
  'Signup requires a valid password': 'Bitte geben Sie ein gültiges Passwort ein.',
  'Password should be at least 6 characters': 'Das Passwort muss mindestens 6 Zeichen lang sein.',
  'Password should contain at least one character of each': 'Das Passwort muss Groß- und Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.',
  'User not found': 'Kein Konto mit dieser E-Mail-Adresse gefunden.',
  'Invalid refresh token': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  'Token expired': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  'JWT expired': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  // Internes Sentinel von SessionExpiredError (sessionGuard.ts). Sollte dank
  // Auto-Dialog + Toast-Filter eigentlich nie sichtbar werden – aber Defense-in-Depth
  // für den Fall, dass die Message irgendwo doch zur Übersetzung durchkommt.
  'SESSION_EXPIRED': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  'invalid claim: missing sub claim': 'Sitzungsfehler. Bitte melden Sie sich erneut an.',
  'Auth session missing': 'Sie sind nicht angemeldet. Bitte melden Sie sich an.',
  'Unauthorized': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  'No authorization header': 'Sie sind nicht angemeldet. Bitte melden Sie sich an.',
  'New password should be different from the old password': 'Das neue Passwort muss sich vom alten Passwort unterscheiden.',
  'For security purposes, you can only request this once every 60 seconds': 'Aus Sicherheitsgründen können Sie diese Anfrage nur einmal pro Minute stellen. Bitte warten Sie einen Moment.',
  'Email rate limit exceeded': 'Zu viele E-Mail-Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.',
  'over_email_send_rate_limit': 'Zu viele E-Mail-Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.',
  'rate_limit': 'Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.',
  // Navigator Lock-Fehler (Supabase Auth-JS Session-Synchronisierung)
  'Lock broken by another request': 'Sitzungssynchronisierung wird durchgeführt. Bitte versuchen Sie es erneut.',
  'Lock was stolen by another request': 'Sitzungssynchronisierung wird durchgeführt. Bitte versuchen Sie es erneut.',
  'was released because another request stole it': 'Sitzungssynchronisierung wird durchgeführt. Bitte versuchen Sie es erneut.',
  'Lock acquisition timed out': 'Die Anmeldung hat etwas länger gedauert. Bitte versuchen Sie es erneut.',
  'was not released within': 'Die Anmeldung hat etwas länger gedauert. Bitte versuchen Sie es erneut.',
  'Acquiring an exclusive Navigator LockManager lock': 'Sitzungssynchronisierung wird durchgeführt. Bitte versuchen Sie es erneut.',
  'Acquiring process lock': 'Sitzungssynchronisierung wird durchgeführt. Bitte versuchen Sie es erneut.',
};

// ============================================================================
// Supabase API/DB-Fehler auf Deutsch
// ============================================================================

const API_ERROR_MAP: Record<string, string> = {
  // PostgreSQL Fehler
  '23505': 'Dieser Eintrag existiert bereits. Bitte überprüfen Sie Ihre Eingaben.',
  '23503': 'Dieser Eintrag kann nicht verarbeitet werden, da er mit anderen Daten verknüpft ist.',
  '23502': 'Ein Pflichtfeld wurde nicht ausgefüllt. Bitte überprüfen Sie Ihre Eingaben.',
  '42501': 'Sie haben keine Berechtigung für diese Aktion.',
  '42P01': 'Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
  'PGRST116': 'Der angeforderte Eintrag wurde nicht gefunden.',
  'PGRST301': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  
  // Netzwerk-Fehler
  'Failed to fetch': 'Verbindungsproblem. Bitte versuchen Sie es erneut. Falls das Problem bestehen bleibt, prüfen Sie Ihre Internetverbindung.',
  'NetworkError': 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.',
  'Load failed': 'Die Anfrage konnte nicht geladen werden. Bitte versuchen Sie es erneut.',
  'AbortError': 'Die Anfrage wurde abgebrochen. Bitte versuchen Sie es erneut.',
  'TimeoutError': 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.',
  
  // Storage-Fehler
  'The resource already exists': 'Diese Datei existiert bereits.',
  'Bucket not found': 'Speicherbereich nicht gefunden. Bitte kontaktieren Sie den Support.',
  'Object not found': 'Die angeforderte Datei wurde nicht gefunden.',
  'Payload too large': 'Die Datei ist zu groß. Bitte wählen Sie eine kleinere Datei.',
  'new row violates row-level security': 'Sie haben keine Berechtigung für diese Aktion. Bitte melden Sie sich an.',
  
  // Server/Infrastruktur-Fehler
  'Service temporarily unavailable': 'Der Service ist vorübergehend nicht erreichbar. Bitte versuchen Sie es in wenigen Sekunden erneut.',
  'Service Unavailable': 'Der Service ist vorübergehend nicht erreichbar. Bitte versuchen Sie es in wenigen Sekunden erneut.',
  '503': 'Der Service ist vorübergehend nicht erreichbar. Bitte versuchen Sie es in wenigen Sekunden erneut.',

  // Edge Function Fehler
  'FunctionsFetchError': 'Der Server ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.',
  'FunctionsHttpError': 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
  'Edge Function returned a non-2xx status code': 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
  'FunctionsRelayError': 'Verbindungsfehler zum Server. Bitte versuchen Sie es erneut.',
};

// ============================================================================
// Geschäftslogik-Fehler auf Deutsch
// ============================================================================

const BUSINESS_ERROR_MAP: Record<string, string> = {
  'Auction has ended': 'Diese Auktion ist bereits beendet.',
  'Auction is not active': 'Diese Auktion ist nicht mehr aktiv.',
  'Bid must be higher than current bid': 'Ihr Gebot muss höher sein als das aktuelle Höchstgebot.',
  'Bid must be at least': 'Ihr Gebot muss mindestens den Mindestbetrag erreichen.',
  'Cannot bid on your own auction': 'Sie können nicht auf Ihre eigene Auktion bieten.',
  'Insufficient permissions': 'Sie haben keine Berechtigung für diese Aktion.',
  'Dealer not approved': 'Ihr Händlerkonto wurde noch nicht freigeschaltet.',
  'Dealer suspended': 'Ihr Händlerkonto wurde gesperrt. Bitte kontaktieren Sie den Support.',
  'User suspended': 'Ihr Konto wurde gesperrt. Bitte kontaktieren Sie den Support.',
  'Payment required': 'Eine Zahlung ist erforderlich, um fortzufahren.',
  'Already purchased': 'Dieses Fahrzeug wurde bereits gekauft.',
  'Stock not available': 'Dieses Fahrzeug ist nicht mehr verfügbar.',
};

// ============================================================================
// Übersetzungsfunktionen
// ============================================================================

/**
 * Übersetzt eine englische Fehlermeldung ins Deutsche.
 * Prüft zuerst exakte Übereinstimmungen, dann Teilübereinstimmungen.
 */
export function translateError(englishMessage: string): GermanError {
  if (!englishMessage) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Ein unbekannter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
      category: 'unknown',
      severity: 'medium',
    };
  }

  const trimmed = englishMessage.trim();

  // 1. Prüfe Zod/Validierungsfehler
  for (const [pattern, german] of Object.entries(ZOD_ERROR_MAP)) {
    if (trimmed === pattern || trimmed.startsWith(pattern)) {
      return {
        code: `VALIDATION_${pattern.replace(/\s+/g, '_').toUpperCase().slice(0, 40)}`,
        message: german,
        category: 'validation',
        severity: 'low',
      };
    }
  }

  // 2. Prüfe Auth-Fehler
  for (const [pattern, german] of Object.entries(AUTH_ERROR_MAP)) {
    if (trimmed.includes(pattern)) {
      return {
        code: `AUTH_${pattern.replace(/\s+/g, '_').toUpperCase().slice(0, 40)}`,
        message: german,
        category: 'auth',
        severity: 'medium',
      };
    }
  }

  // 3. Prüfe API/DB-Fehler
  for (const [pattern, german] of Object.entries(API_ERROR_MAP)) {
    if (trimmed.includes(pattern)) {
      return {
        code: `API_${pattern.replace(/\s+/g, '_').toUpperCase().slice(0, 40)}`,
        message: german,
        category: 'api',
        severity: 'medium',
      };
    }
  }

  // 4. Prüfe Geschäftslogik-Fehler
  for (const [pattern, german] of Object.entries(BUSINESS_ERROR_MAP)) {
    if (trimmed.includes(pattern)) {
      return {
        code: `BIZ_${pattern.replace(/\s+/g, '_').toUpperCase().slice(0, 40)}`,
        message: german,
        category: 'business',
        severity: 'low',
      };
    }
  }

  // 5. Prüfe ob die Nachricht bereits auf Deutsch ist
  if (isGerman(trimmed)) {
    return {
      code: 'DE_MESSAGE',
      message: trimmed,
      category: 'unknown',
      severity: 'low',
    };
  }

  // 6. Fallback: Generische deutsche Fehlermeldung
  return {
    code: 'UNTRANSLATED',
    message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie unseren Support.',
    category: 'unknown',
    severity: 'medium',
  };
}

/**
 * Prüft ob ein Text wahrscheinlich bereits auf Deutsch ist
 */
function isGerman(text: string): boolean {
  const lowerText = text.toLowerCase();
  const germanIndicators = [
    'bitte', 'fehler', 'erforderlich', 'ungültig', 'mindestens',
    'maximal', 'nicht', 'pflicht', 'muss', 'darf', 'zeichen',
    'passwort', 'e-mail', 'eingabe', 'überprüfen', 'erneut',
    'aufgetreten', 'versuchen', 'wählen', 'geben', 'ist ein',
    'hersteller', 'modell', 'baujahr', 'zustand', 'beschreibung',
    'sitzplätze', 'schlafplätze', 'fotos', 'verkaufsweg',
    'kilometerstand', 'aufbauart', 'mängel', 'ankaufstation',
    'plz', 'ziffern', 'postleitzahl', 'firmenname', 'adresse',
    'telefonnummer', 'stadt', 'marke', 'akzeptieren',
    'anmelden', 'registrieren', 'straße', 'hausnummer',
  ];
  return germanIndicators.some(indicator => lowerText.includes(indicator));
}

/**
 * Übersetzt eine Fehlermeldung und gibt nur den deutschen Text zurück
 */
export function getGermanErrorMessage(error: unknown): string {
  if (!error) {
    return 'Ein unbekannter Fehler ist aufgetreten.';
  }

  // String direkt
  if (typeof error === 'string') {
    return translateError(error).message;
  }

  // Error-Objekt
  if (error instanceof Error) {
    return translateError(error.message).message;
  }

  // Supabase-Fehler mit code
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    
    // Supabase PostgrestError hat ein 'code' Feld
    if (err.code && typeof err.code === 'string' && API_ERROR_MAP[err.code]) {
      return API_ERROR_MAP[err.code];
    }
    
    if (err.message && typeof err.message === 'string') {
      return translateError(err.message).message;
    }
    
    if (err.error_description && typeof err.error_description === 'string') {
      return translateError(err.error_description).message;
    }
  }

  return 'Ein unbekannter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
}

/**
 * Erstellt eine benutzerdefinierte Zod-Fehlerkarte für deutsche Meldungen.
 * Wird als globale errorMap in Zod gesetzt.
 */
export const germanZodErrorMap: z.ZodErrorMap = (issue, ctx) => {
  let message: string;

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        message = 'Dieses Feld ist ein Pflichtfeld.';
      } else if (issue.expected === 'number') {
        message = 'Bitte geben Sie eine gültige Zahl ein.';
      } else if (issue.expected === 'string') {
        message = 'Bitte geben Sie einen Text ein.';
      } else if (issue.expected === 'boolean') {
        message = 'Bitte wählen Sie eine Option aus.';
      } else {
        message = `Ungültiger Wert. Erwartet: ${issue.expected}.`;
      }
      break;

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        if (issue.minimum === 1) {
          message = 'Dieses Feld darf nicht leer sein.';
        } else {
          message = `Mindestens ${issue.minimum} Zeichen erforderlich.`;
        }
      } else if (issue.type === 'number') {
        message = `Der Wert muss mindestens ${issue.minimum} sein.`;
      } else if (issue.type === 'array') {
        message = `Mindestens ${issue.minimum} Einträge erforderlich.`;
      } else {
        message = `Der Wert ist zu klein. Minimum: ${issue.minimum}.`;
      }
      break;

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        message = `Maximal ${issue.maximum} Zeichen erlaubt.`;
      } else if (issue.type === 'number') {
        message = `Der Wert darf maximal ${issue.maximum} sein.`;
      } else if (issue.type === 'array') {
        message = `Maximal ${issue.maximum} Einträge erlaubt.`;
      } else {
        message = `Der Wert ist zu groß. Maximum: ${issue.maximum}.`;
      }
      break;

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        message = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
      } else if (issue.validation === 'url') {
        message = 'Bitte geben Sie eine gültige URL ein.';
      } else if (issue.validation === 'uuid') {
        message = 'Ungültige ID.';
      } else {
        message = 'Ungültiger Text.';
      }
      break;

    case z.ZodIssueCode.invalid_enum_value:
      message = `Bitte wählen Sie einen gültigen Wert aus: ${issue.options.join(', ')}.`;
      break;

    case z.ZodIssueCode.invalid_date:
      message = 'Bitte geben Sie ein gültiges Datum ein.';
      break;

    case z.ZodIssueCode.custom:
      message = issue.message || 'Ungültige Eingabe.';
      break;

    default:
      message = ctx.defaultError;
      // Versuche den Default-Error zu übersetzen
      if (message && !isGerman(message)) {
        const translated = translateError(message);
        if (translated.code !== 'UNTRANSLATED') {
          message = translated.message;
        }
      }
      break;
  }

  return { message };
};

// ============================================================================
// Seitennamen-Mapping für das Fehler-Log
// ============================================================================

export function getPageTitle(path: string): string {
  const pageMap: Record<string, string> = {
    '/': 'Startseite',
    '/login': 'Anmeldung',
    '/login/haendler': 'Anmeldung (Weiterleitung)',
    '/register': 'Registrierung (Privatkunde)',
    '/register/haendler': 'Registrierung (Händler)',
    '/forgot-password': 'Passwort vergessen',
    '/reset-password': 'Passwort zurücksetzen',
    '/verkaufen': 'Verkaufen',
    '/verkaufen/wizard': 'Verkaufen-Assistent',
    '/kaufen': 'Kaufen / Marktplatz',
    '/ratgeber': 'Ratgeber',
    '/ueber-uns': 'Über uns',
    '/kontakt': 'Kontakt',
    '/haendler': 'Für Händler',
    '/ankaufstationen': 'Ankaufstationen',
    '/wertermittlung': 'Wertermittlung',
    '/wertrechner': 'Wertrechner',
    '/impressum': 'Impressum',
    '/datenschutz': 'Datenschutz',
    '/agb': 'AGB',
    '/faq': 'FAQ',
    '/preise': 'Preise',
    '/blog': 'Blog',
    '/dashboard': 'Dashboard',
    '/dashboard/listings': 'Meine Inserate',
    '/dashboard/bids': 'Meine Gebote',
    '/dashboard/favorites': 'Favoriten',
    '/dashboard/messages': 'Nachrichten',
    '/dashboard/profile': 'Profil',
    '/dashboard/contracts': 'Kaufverträge',
    '/dashboard/invoices': 'Rechnungen',
    '/dashboard/appointments': 'Termine',
    '/dashboard/kaufchancen': 'Kaufchancen',
    '/admin': 'Admin-Übersicht',
    '/admin/analytics': 'Admin-Analytics',
    '/admin/auctions': 'Admin-Auktionen',
    '/admin/motorhomes': 'Admin-Wohnmobile',
    '/admin/users': 'Admin-Benutzer',
    '/admin/dealers': 'Admin-Händler',
    '/admin/settings': 'Admin-Einstellungen',
    '/admin/commissions': 'Admin-Provisionen',
    '/admin/financials': 'Admin-Finanzen',
    '/admin/stations': 'Admin-Ankaufstationen',
    '/admin/appointments': 'Admin-Termine',
    '/admin/blog': 'Admin-Blog',
    '/admin/legal': 'Admin-Rechtliches',
    '/admin/questions': 'Admin-Fahrzeugfragen',
    '/admin/messages': 'Admin-Nachrichten',
    '/admin/error-logs': 'Admin-Fehlerprotokoll',
    // SEO Landing Pages
    '/wohnmobil-verkaufen': 'LP: Wohnmobil verkaufen',
    '/wohnwagen-verkaufen': 'LP: Wohnwagen verkaufen',
    '/was-ist-mein-wohnmobil-wert': 'LP: Was ist mein Wohnmobil wert?',
    '/wohnmobil-wertermittlung-kostenlos': 'LP: Wertermittlung kostenlos',
    '/wir-kaufen-dein-wohnmobil': 'LP: Wir kaufen dein Wohnmobil',
    '/wieviel-ist-mein-wohnmobil-wert': 'LP: Wieviel ist mein Wohnmobil wert?',
  };

  // Exakter Match
  if (pageMap[path]) return pageMap[path];

  // Dynamische Routen
  if (path.startsWith('/auktion/')) return 'Auktionsdetail';
  if (path.startsWith('/blog/')) return 'Blog-Artikel';
  if (path.startsWith('/ratgeber/')) return 'Ratgeber-Artikel';
  if (path.startsWith('/admin/auctions/')) return 'Admin-Auktionsdetail';
  if (path.startsWith('/admin/motorhomes/')) return 'Admin-Wohnmobildetail';
  if (path.startsWith('/admin/users/')) return 'Admin-Benutzerdetail';
  if (path.startsWith('/admin/dealers/')) return 'Admin-Händlerdetail';
  if (path.startsWith('/admin/appointments/')) return 'Admin-Termindetail';
  if (path.startsWith('/dashboard/listings/')) return 'Inseratdetail';

  return path;
}
