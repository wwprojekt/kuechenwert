/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare-Turnstile-Site-Key für kuechenwert24.de; ohne Wert bleibt Turnstile aus. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
