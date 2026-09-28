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
/** Fehlercodes, die an unserer Konfiguration oder an Cloudflare liegen, nicht am Nutzer. */
const NOT_USER_ERRORS = new Set(['missing-input-secret', 'invalid-input-secret', 'bad-request', 'internal-error']);

interface TurnstileVerifyResult {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

type SiteverifyOutcome = { kind: 'passed' } | { kind: 'failed'; codes: string[] } | { kind: 'unavailable' };

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

async function siteverify(secret: string, token: string, remoteIp?: string): Promise<SiteverifyOutcome> {
  try {
    const formData = new FormData();
    formData.append('secret', secret);
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
      return { kind: 'unavailable' };
    }

    const result: TurnstileVerifyResult = await response.json();
    if (result.success) return { kind: 'passed' };

    const codes = result['error-codes'] ?? [];
    console.warn('Turnstile: Token verification failed:', codes.join(', '));
    return codes.some((c) => NOT_USER_ERRORS.has(c)) ? { kind: 'unavailable' } : { kind: 'failed', codes };
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return { kind: 'unavailable' };
  }
}

/**
 * Verifiziert ein Cloudflare Turnstile Token für Formulare, die ohne gültige
 * Prüfung abgelehnt werden sollen. Fehlt das Token, ist die Prüfung nicht
 * bestanden; nur wenn kein Secret konfiguriert oder Cloudflare nicht
 * erreichbar ist, wird zugelassen.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<{ valid: boolean; error?: string }> {
  const secretKey = await turnstileSecret();

  if (!secretKey) {
    console.warn('Turnstile: kein Secret konfiguriert, Prüfung übersprungen');
    return { valid: true };
  }

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { valid: false, error: 'Turnstile-Token fehlt' };
  }

  const outcome = await siteverify(secretKey, token, remoteIp);
  if (outcome.kind === 'failed') {
    return { valid: false, error: `Turnstile-Verifizierung fehlgeschlagen: ${outcome.codes.join(', ')}` };
  }
  return { valid: true };
}

export type BotCheck = 'passed' | 'unverified' | 'skipped';

/**
 * Prüfung für Lead-Formulare, lehnt nie ab: Ohne gültiges Token (fehlt,
 * abgelaufen, schon verwendet) ist der Lead „unverified“ und wird nicht
 * automatisch an Studios veröffentlicht. „skipped“: kein Secret oder
 * Cloudflare nicht erreichbar.
 */
export async function checkTurnstile(token: unknown, remoteIp?: string): Promise<BotCheck> {
  const secretKey = await turnstileSecret();
  if (!secretKey) return 'skipped';
  if (typeof token !== 'string' || token.trim().length === 0) return 'unverified';
  const outcome = await siteverify(secretKey, token, remoteIp);
  if (outcome.kind === 'passed') return 'passed';
  return outcome.kind === 'failed' ? 'unverified' : 'skipped';
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
