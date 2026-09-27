/**
 * Cloudflare Turnstile serverseitige Token-Verifizierung.
 *
 * Secret: Edge-Secret CLOUDFLARE_TURNSTILE_SECRET, sonst Supabase Vault
 * (Eintrag „cloudflare_turnstile_secret“ über RPC kw_turnstile_secret).
 * Ohne Secret wird nicht geprüft.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SECRET_CACHE_MS = 5 * 60 * 1000;

interface TurnstileVerifyResult {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

let cachedSecret: { value: string | null; at: number } | null = null;

async function turnstileSecret(): Promise<string | null> {
  const fromEnv = Deno.env.get('CLOUDFLARE_TURNSTILE_SECRET');
  if (fromEnv) return fromEnv;
  if (cachedSecret && Date.now() - cachedSecret.at < SECRET_CACHE_MS) return cachedSecret.value;

  let value: string | null = null;
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await sb.rpc('kw_turnstile_secret');
      value = typeof data === 'string' && data.trim() ? data.trim() : null;
    }
  } catch (err) {
    console.error('Turnstile: Secret aus Vault nicht lesbar', err);
  }
  cachedSecret = { value, at: Date.now() };
  return value;
}

/**
 * Verifiziert ein Cloudflare Turnstile Token.
 *
 * requireToken: Bei gesetztem Secret gilt ein fehlendes Token als ungültig
 * (Formulare mit Widget). Ohne die Option wird ein fehlendes Token toleriert.
 * Ausfälle bei Cloudflare lassen die Anfrage in beiden Fällen durch.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
  opts: { requireToken?: boolean } = {},
): Promise<{ valid: boolean; error?: string }> {
  const secretKey = await turnstileSecret();

  if (!secretKey) {
    console.warn('Turnstile: kein Secret konfiguriert, Prüfung übersprungen');
    return { valid: true };
  }

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    if (opts.requireToken) {
      console.warn('Turnstile: Token fehlt – abgelehnt');
      return { valid: false, error: 'Turnstile-Token fehlt' };
    }
    console.warn('Turnstile: Token fehlt – zugelassen');
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
      return { valid: true };
    }

    const result: TurnstileVerifyResult = await response.json();

    if (result.success) {
      return { valid: true };
    }

    const errorCodes = result['error-codes'] || [];
    console.warn('Turnstile: Token verification failed:', errorCodes.join(', '));

    // internal-error liegt bei Cloudflare, nicht beim Nutzer
    if (errorCodes.includes('internal-error')) {
      return { valid: true };
    }

    return { valid: false, error: `Turnstile-Verifizierung fehlgeschlagen: ${errorCodes.join(', ')}` };
  } catch (err) {
    console.error('Turnstile verification error:', err);
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
