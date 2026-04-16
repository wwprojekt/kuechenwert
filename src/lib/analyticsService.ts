/**
 * DSGVO-Compliant Analytics Service
 * 
 * This service handles all analytics tracking in a privacy-first manner:
 * - Only tracks when user has given analytics consent
 * - Stores data in Supabase for the admin dashboard
 * - Supports Google Analytics with consent mode
 * - Anonymizes data where possible
 */

import { supabase } from '@/integrations/supabase/client';
import { hasAnalyticsConsent, getConsentId, type CookieConsent } from '@/components/CookieBanner';
import { logger } from './logger';

interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
}

interface SessionData {
  sessionId: string;
  consentId: string;
  userId?: string;
  deviceInfo: DeviceInfo;
  referrer?: string;
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  landingPage: string;
  startedAt: Date;
}

class AnalyticsService {
  private sessionId: string | null = null;
  private sessionCreated: boolean = false;
  // Mutex gegen parallele createSession()-Aufrufe (z.B. consent-update
  // + flushQueues-Interval gleichzeitig), die sonst zwei parallele INSERTs
  // mit identischer session_id auslösen und 23505 (duplicate_key) triggern.
  private createSessionPromise: Promise<void> | null = null;
  private pageViewQueue: Array<{
    pagePath: string;
    pageTitle: string;
    referrerPath?: string;
    timestamp: Date;
  }> = [];
  private eventQueue: Array<{
    eventName: string;
    eventCategory?: string;
    eventAction?: string;
    eventLabel?: string;
    eventValue?: number;
    properties?: Record<string, unknown>;
    pagePath: string;
    timestamp: Date;
  }> = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private lastPagePath: string = '';

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Generate session ID
    this.sessionId = this.generateSessionId();
    
    // Bind once so we can remove the same reference later
    this.handleConsentUpdate = this.handleConsentUpdate.bind(this);
    window.addEventListener('consent-updated', this.handleConsentUpdate);
    
    // Start flush interval (every 30 seconds)
    this.flushInterval = setInterval(() => this.flushQueues(), 30000);
    
    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flushQueues());
    
    // Initial page view wird durch usePageTracking() in App.tsx getrackt
    // Kein doppeltes Tracking hier im Konstruktor

    logger.log('Analytics service initialized');
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private handleConsentUpdate(event: Event) {
    const consent = (event as CustomEvent<CookieConsent>).detail;
    
    if (consent.analytics && !this.sessionCreated) {
      // User just gave consent - create session and flush queued data
      this.createSession();
      this.flushQueues();
    }
  }

  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    
    // Detect device type
    let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (/Mobi|Android/i.test(ua)) {
      type = /Tablet|iPad/i.test(ua) ? 'tablet' : 'mobile';
    }

    // Parse browser
    let browser = 'Unknown';
    let browserVersion = '';
    
    if (ua.includes('Firefox/')) {
      browser = 'Firefox';
      browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Chrome/')) {
      browser = 'Chrome';
      browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      browser = 'Safari';
      browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Edge/') || ua.includes('Edg/')) {
      browser = 'Edge';
      browserVersion = ua.match(/Edg[e]?\/([\d.]+)/)?.[1] || '';
    }

    // Parse OS
    let os = 'Unknown';
    let osVersion = '';
    
    if (ua.includes('Windows')) {
      os = 'Windows';
      osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Mac OS X')) {
      os = 'macOS';
      osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
    } else if (ua.includes('Linux')) {
      os = 'Linux';
    } else if (ua.includes('Android')) {
      os = 'Android';
      osVersion = ua.match(/Android ([\d.]+)/)?.[1] || '';
    } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
      os = 'iOS';
      osVersion = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
    }

    return { type, browser, browserVersion, os, osVersion };
  }

  private getUTMParams(): SessionData['utm'] {
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source') || undefined,
      medium: params.get('utm_medium') || undefined,
      campaign: params.get('utm_campaign') || undefined,
      term: params.get('utm_term') || undefined,
      content: params.get('utm_content') || undefined,
    };
  }

  private async createSession(): Promise<void> {
    if (this.sessionCreated || !hasAnalyticsConsent()) return;

    // Wenn bereits ein createSession-Aufruf läuft, warte nur darauf – kein
    // zweiter Insert mit gleicher session_id.
    if (this.createSessionPromise) {
      return this.createSessionPromise;
    }

    this.createSessionPromise = (async () => {
      const consentId = getConsentId();
      if (!consentId || !this.sessionId) return;

      try {
        const deviceInfo = this.getDeviceInfo();
        const utm = this.getUTMParams();

        const { error } = await supabase.from('analytics_sessions').insert({
          session_id: this.sessionId,
          consent_id: consentId,
          device_type: deviceInfo.type,
          browser: deviceInfo.browser,
          browser_version: deviceInfo.browserVersion,
          os: deviceInfo.os,
          os_version: deviceInfo.osVersion,
          referrer_url: document.referrer || null,
          referrer_domain: (() => {
            let referrerDomain: string | null = null;
            try {
              referrerDomain = document.referrer ? new URL(document.referrer).hostname : null;
            } catch { referrerDomain = null; }
            return referrerDomain;
          })(),
          utm_source: utm.source,
          utm_medium: utm.medium,
          utm_campaign: utm.campaign,
          utm_term: utm.term,
          utm_content: utm.content,
          landing_page: window.location.pathname,
        });

        if (error) {
          // Table doesn't exist – non-fatal
          if (error.code === '42P01' || error.code === 'PGRST205') {
            logger.warn('Analytics tables not yet created');
          } else if (error.code === '23505') {
            // Duplicate key – session bereits von parallelem Tab/Aufruf angelegt.
            // Als "erstellt" markieren und weiter flushen.
            this.sessionCreated = true;
            logger.log('Analytics session already existed (deduped)');
          } else {
            throw error;
          }
        } else {
          this.sessionCreated = true;
          logger.log('Analytics session created');
        }
      } catch (error) {
        logger.error('Failed to create analytics session:', error);
      }
    })();

    try {
      await this.createSessionPromise;
    } finally {
      this.createSessionPromise = null;
    }
  }

  /**
   * Track a page view
   */
  trackPageView(pagePath: string, pageTitle?: string): void {
    const referrerPath = this.lastPagePath || undefined;
    const isFirstPageView = !this.lastPagePath;
    this.lastPagePath = pagePath;

    // Queue the page view for Supabase analytics DB
    this.pageViewQueue.push({
      pagePath,
      pageTitle: pageTitle || document.title,
      referrerPath,
      timestamp: new Date(),
    });

    // GA4: Manuell page_view Event senden für SPA-Navigationen.
    // index.html hat send_page_view: true, was den INITIALEN Page View sendet.
    // Bei einer SPA (React Router) werden nachfolgende Route-Wechsel NICHT
    // automatisch an GA4 gemeldet – ohne dieses Event wäre GA4 blind für
    // alle Seiten nach dem ersten Ladevorgang.
    // Consent Mode wird automatisch von gtag respektiert (denied → anonymer Ping).
    if (!isFirstPageView && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_path: pagePath,
        page_title: pageTitle || document.title,
        page_location: window.location.origin + pagePath,
      });
    }

    // Flush if consent is given and session exists
    if (hasAnalyticsConsent() && this.sessionCreated) {
      this.flushQueues();
    }
  }

  /**
   * Track a custom event
   */
  trackEvent(
    eventName: string,
    options?: {
      category?: string;
      action?: string;
      label?: string;
      value?: number;
      properties?: Record<string, unknown>;
    }
  ): void {
    this.eventQueue.push({
      eventName,
      eventCategory: options?.category,
      eventAction: options?.action,
      eventLabel: options?.label,
      eventValue: options?.value,
      properties: options?.properties,
      pagePath: window.location.pathname,
      timestamp: new Date(),
    });

    // Also track in Google Analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag && hasAnalyticsConsent()) {
      (window as any).gtag('event', eventName, {
        event_category: options?.category,
        event_label: options?.label,
        value: options?.value,
        ...options?.properties,
      });
    }

    // Flush if consent is given and session exists
    if (hasAnalyticsConsent() && this.sessionCreated) {
      this.flushQueues();
    }
  }

  /**
   * Flush queued data to the database
   */
  private async flushQueues(): Promise<void> {
    if (!hasAnalyticsConsent()) return;

    // Create session if not exists
    if (!this.sessionCreated) {
      await this.createSession();
      if (!this.sessionCreated) return;
    }

    const consentId = getConsentId();
    if (!consentId || !this.sessionId) return;

    const deviceInfo = this.getDeviceInfo();

    // Flush page views
    if (this.pageViewQueue.length > 0) {
      const pageViews = this.pageViewQueue.splice(0, this.pageViewQueue.length);
      
      try {
        const { error } = await supabase.from('analytics_page_views').insert(
          pageViews.map(pv => ({
            session_id: this.sessionId,
            consent_id: consentId,
            page_path: pv.pagePath,
            page_title: pv.pageTitle,
            page_url: window.location.href,
            referrer_path: pv.referrerPath,
            device_type: deviceInfo.type,
            created_at: pv.timestamp.toISOString(),
          }))
        );

        if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
          logger.error('Failed to insert page views:', error);
          // Re-queue on error
          this.pageViewQueue.unshift(...pageViews);
        }
      } catch (error) {
        logger.error('Failed to flush page views:', error);
        this.pageViewQueue.unshift(...pageViews);
      }
    }

    // Flush events
    if (this.eventQueue.length > 0) {
      const events = this.eventQueue.splice(0, this.eventQueue.length);
      
      try {
        const { error } = await supabase.from('analytics_events').insert(
          events.map(ev => ({
            session_id: this.sessionId,
            consent_id: consentId,
            event_name: ev.eventName,
            event_category: ev.eventCategory,
            event_action: ev.eventAction,
            event_label: ev.eventLabel,
            event_value: ev.eventValue,
            properties: ev.properties || {},
            page_path: ev.pagePath,
            created_at: ev.timestamp.toISOString(),
          }))
        );

        if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
          logger.error('Failed to insert events:', error);
          // Re-queue on error
          this.eventQueue.unshift(...events);
        }
      } catch (error) {
        logger.error('Failed to flush events:', error);
        this.eventQueue.unshift(...events);
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    window.removeEventListener('consent-updated', this.handleConsentUpdate);
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

// Export convenience functions
export const trackPageView = (pagePath: string, pageTitle?: string) =>
  analyticsService.trackPageView(pagePath, pageTitle);

export const trackEvent = (
  eventName: string,
  options?: {
    category?: string;
    action?: string;
    label?: string;
    value?: number;
    properties?: Record<string, unknown>;
  }
) => analyticsService.trackEvent(eventName, options);

// Business event tracking
export const trackBusinessEvent = (
  eventName: 'vehicle_listed' | 'bid_placed' | 'auction_won' | 'appointment_booked' | 'user_registered' | 'search_performed',
  properties?: Record<string, unknown>
) => {
  analyticsService.trackEvent(eventName, {
    category: 'business',
    properties,
  });
};
