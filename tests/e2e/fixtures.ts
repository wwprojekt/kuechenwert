import { test as base } from '@playwright/test';

// Muss zu CONSENT_VERSION in src/components/CookieBanner.tsx passen, sonst
// erscheint der Banner und kann Klickziele auf kleinen Viewports verdecken.
const ESSENTIAL_ONLY_CONSENT = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
  consentId: 'e2e-smoke',
  consentVersion: '1.0',
  timestamp: Date.now(),
};

const TRACKING_HOSTS = [
  'googletagmanager.com',
  'google-analytics.com',
  'doubleclick.net',
  'googleadservices.com',
  'facebook.net',
  'facebook.com',
  'bing.com',
  'clarity.ms',
];

const isTrackingHost = (url: URL) =>
  TRACKING_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));

/**
 * Jeder Test startet mit „nur notwendige Cookies“: kein Cookie-Banner, keine
 * Analytics-Einträge in Supabase. Tracker-Hosts werden zusätzlich blockiert,
 * damit Läufe gegen Production keine Besuche oder Conversions zählen.
 */
export const test = base.extend<{ essentialConsentOnly: void }>({
  essentialConsentOnly: [
    async ({ context }, use) => {
      await context.addInitScript((consent) => {
        window.localStorage.setItem('cookie-consent', JSON.stringify(consent));
      }, ESSENTIAL_ONLY_CONSENT);
      await context.route(isTrackingHost, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
