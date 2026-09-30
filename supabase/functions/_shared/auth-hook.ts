/** Signaturprüfung der Supabase-Auth-Hooks (Standard Webhooks). */

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

/**
 * secret im Format aus dem Dashboard (Authentication → Hooks): "v1,whsec_<base64>".
 * Wirft bei falscher Signatur oder einem Zeitstempel außerhalb von fünf Minuten.
 */
export function verifyAuthHook<T>(payload: string, headers: Headers, secret: string): T {
  return new Webhook(secret.replace(/^v1,whsec_/, "")).verify(payload, Object.fromEntries(headers)) as T;
}
