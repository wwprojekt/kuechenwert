/**
 * Cloudflare Turnstile serverseitige Token-Verifizierung.
 * 
 * Wird von Edge Functions aufgerufen um Turnstile-Tokens zu validieren.
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResult {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

/**
 * Verifiziert ein Cloudflare Turnstile Token.
 * 
 * @param token - Das Turnstile-Token vom Frontend
 * @param remoteIp - Die IP-Adresse des Clients (optional, verbessert Sicherheit)
 * @returns true wenn das Token gültig ist, false wenn nicht
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<{ valid: boolean; error?: string }> {
  const secretKey = Deno.env.get('CLOUDFLARE_TURNSTILE_SECRET');

  // Wenn kein Secret Key konfiguriert ist, Turnstile überspringen (graceful degradation)
  if (!secretKey) {
    console.warn('CLOUDFLARE_TURNSTILE_SECRET not set, skipping Turnstile verification');
    return { valid: true };
  }

  // Wenn kein Token vorhanden ist: Graceful Degradation
  // Echte Nutzer mit AdBlocker oder langsamer Verbindung haben möglicherweise kein Token.
  // Nur bei VORHANDENEM aber UNGÜLTIGEM Token blockieren (= Bot der ein Fake-Token sendet).
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    console.warn('Turnstile: No token provided (AdBlocker or slow connection?) - allowing request');
    return { valid: true };
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('Turnstile API error:', response.status, response.statusText);
      // Bei API-Fehler: graceful degradation (erlauben)
      return { valid: true };
    }

    const result: TurnstileVerifyResult = await response.json();

    if (result.success) {
      console.log('Turnstile: Token verified successfully');
      return { valid: true };
    }

    const errorCodes = result['error-codes'] || [];
    console.warn('Turnstile: Token verification failed:', errorCodes.join(', '));

    // Bekannte Fehlercodes:
    // - missing-input-secret: Secret Key fehlt
    // - invalid-input-secret: Secret Key ungültig
    // - missing-input-response: Token fehlt
    // - invalid-input-response: Token ungültig/abgelaufen
    // - bad-request: Ungültige Anfrage
    // - timeout-or-duplicate: Token abgelaufen oder bereits verwendet
    // - internal-error: Cloudflare interner Fehler

    // Bei internem Cloudflare-Fehler: graceful degradation
    if (errorCodes.includes('internal-error')) {
      return { valid: true };
    }

    return { valid: false, error: `Turnstile-Verifizierung fehlgeschlagen: ${errorCodes.join(', ')}` };
  } catch (err) {
    console.error('Turnstile verification error:', err);
    // Bei Netzwerkfehler: graceful degradation (erlauben)
    return { valid: true };
  }
}

/**
 * Extrahiert die Client-IP aus dem Request.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '';
}
