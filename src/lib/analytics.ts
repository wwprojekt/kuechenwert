/**
 * Performance Monitoring and Analytics
 * Tracks user interactions, performance metrics, and business events
 */

import { logger } from './logger';

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  pageLoadTime?: number;
  interactionTime?: number;
  errorCount?: number;
  
  // Context
  url: string;
  userAgent: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
}

export interface UserEvent {
  type: 'click' | 'view' | 'form_submit' | 'error' | 'custom';
  category: 'navigation' | 'auction' | 'form' | 'auth' | 'business';
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  
  // Context
  url: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
}

export interface BusinessEvent {
  type: 'vehicle_listed' | 'bid_placed' | 'auction_won' | 'appointment_booked' | 'user_registered';
  userId?: string;
  value?: number; // Monetary value if applicable
  metadata: Record<string, unknown>;
  timestamp: number;
}

class AnalyticsManager {
  private sessionId: string;
  private userId?: string;
  private isProduction = import.meta.env.PROD;
  private gaId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;
  private performanceObserver?: PerformanceObserver;
  
  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializePerformanceTracking();
    this.initializeUserTracking();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set user context for analytics
   */
  setUser(userId: string, email?: string): void {
    this.userId = userId;
    
    // Set user in Google Analytics
    if (this.gaId && window.gtag) {
      window.gtag('config', this.gaId, {
        user_id: userId,
        custom_map: { user_email: email },
      });
    }
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    this.userId = undefined;
  }

  /**
   * Initialize performance tracking
   */
  private initializePerformanceTracking(): void {
    // Track Core Web Vitals
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry);
        }
      });

      // Observe different performance entry types
      try {
        this.performanceObserver.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
      } catch (error) {
        logger.warn('Performance Observer not fully supported:', error);
      }
    }

    // Track page load time
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      this.trackPerformance({
        pageLoadTime: loadTime,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
      });
    });
  }

  /**
   * Handle performance entries
   */
  private handlePerformanceEntry(entry: PerformanceEntry): void {
    const metrics: Partial<PerformanceMetrics> = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    switch (entry.entryType) {
      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = entry.startTime;
        }
        break;
        
      case 'largest-contentful-paint':
        metrics.lcp = entry.startTime;
        break;
        
      case 'first-input':
        metrics.fid = (entry as any).processingStart - entry.startTime;
        break;
        
      case 'layout-shift':
        if (!(entry as any).hadRecentInput) {
          metrics.cls = (metrics.cls || 0) + (entry as any).value;
        }
        break;
        
      case 'navigation': {
        const navEntry = entry as PerformanceNavigationTiming;
        metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        break;
      }
    }

    if (Object.keys(metrics).length > 5) { // More than just context fields
      this.trackPerformance(metrics as PerformanceMetrics);
    }
  }

  /**
   * Initialize user interaction tracking
   */
  private initializeUserTracking(): void {
    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Track button clicks
      if (target.matches('button, [role="button"]')) {
        this.trackEvent({
          type: 'click',
          category: 'navigation',
          action: 'button_click',
          label: target.textContent?.trim() || target.getAttribute('aria-label') || 'unknown',
          url: window.location.href,
          timestamp: Date.now(),
          sessionId: this.sessionId,
          userId: this.userId,
        });
      }
      
      // Track link clicks
      if (target.matches('a[href]')) {
        const href = target.getAttribute('href');
        this.trackEvent({
          type: 'click',
          category: 'navigation',
          action: 'link_click',
          label: href || 'unknown',
          url: window.location.href,
          timestamp: Date.now(),
          sessionId: this.sessionId,
          userId: this.userId,
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      const formName = form.getAttribute('name') || form.id || 'unknown';
      
      this.trackEvent({
        type: 'form_submit',
        category: 'form',
        action: 'submit',
        label: formName,
        url: window.location.href,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
      });
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metrics: PerformanceMetrics): void {
    if (!this.isProduction) {
      logger.log('Performance Metrics:', metrics);
    }

    // Send to Google Analytics
    if (this.gaId && window.gtag) {
      window.gtag('event', 'performance_metric', {
        event_category: 'performance',
        event_label: metrics.url,
        value: Math.round(metrics.pageLoadTime || 0),
        custom_map: {
          fcp: metrics.fcp,
          lcp: metrics.lcp,
          cls: metrics.cls,
          fid: metrics.fid,
        },
      });
    }

    // Send to custom analytics endpoint
    this.sendToAnalytics('performance', metrics);
  }

  /**
   * Track user events
   */
  trackEvent(event: UserEvent): void {
    if (!this.isProduction) {
      logger.log('User Event:', event);
    }

    // Send to Google Analytics
    if (this.gaId && window.gtag) {
      window.gtag('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
      });
    }

    // Send to custom analytics
    this.sendToAnalytics('event', event);
  }

  /**
   * Track business events
   */
  trackBusinessEvent(event: BusinessEvent): void {
    if (!this.isProduction) {
      logger.log('Business Event:', event);
    }

    // Send to Google Analytics
    if (this.gaId && window.gtag) {
      window.gtag('event', event.type, {
        event_category: 'business',
        value: event.value,
        user_id: event.userId,
      });
    }

    // Send to custom analytics
    this.sendToAnalytics('business', event);
  }

  /**
   * Track page views
   * HINWEIS: Kein gtag('config') Aufruf hier - index.html hat send_page_view: true
   * und analyticsService.ts trackt Page Views für die Supabase-Datenbank.
   * Ein zusätzlicher gtag('config') Aufruf würde doppelte Page Views erzeugen.
   */
  trackPageView(path: string, title?: string): void {
    if (!this.isProduction) {
      logger.log('Page View:', { path, title });
    }

    // Nur als internes Event tracken, NICHT an GA4 senden
    // GA4 Page Views werden automatisch über index.html gehandelt
    this.sendToAnalytics('pageview', {
      path,
      title,
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
    });
  }

  /**
   * Send data to custom analytics endpoint
   */
  private async sendToAnalytics(type: string, data: any): Promise<void> {
    try {
      // In production, you would send this to your analytics service
      const payload = {
        type,
        data,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
      };

      // For now, just log it
      if (this.isProduction) {
        logger.log('Analytics:', payload);
      }

      // Example: send to your own analytics endpoint
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });

    } catch (error) {
      logger.error('Failed to send analytics:', error);
    }
  }

  /**
   * Get current session metrics
   */
  getSessionMetrics(): {
    sessionId: string;
    userId?: string;
    startTime: number;
    pageViews: number;
    events: number;
  } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      startTime: Date.now(),
      pageViews: 0, // Would track in real implementation
      events: 0, // Would track in real implementation
    };
  }
}

// Export singleton instance
export const analytics = new AnalyticsManager();

// Export convenience functions
export const trackEvent = (event: Omit<UserEvent, 'url' | 'timestamp' | 'sessionId'>) =>
  analytics.trackEvent({
    ...event,
    url: window.location.href,
    timestamp: Date.now(),
    sessionId: analytics.getSessionMetrics().sessionId,
    userId: analytics.getSessionMetrics().userId,
  });

export const trackBusinessEvent = (event: Omit<BusinessEvent, 'timestamp'>) =>
  analytics.trackBusinessEvent({
    ...event,
    timestamp: Date.now(),
  });

export const trackPageView = (path: string, title?: string) =>
  analytics.trackPageView(path, title);

export const setAnalyticsUser = (userId: string, email?: string) =>
  analytics.setUser(userId, email);

export const clearAnalyticsUser = () =>
  analytics.clearUser();

// Google Analytics type declarations
// HINWEIS: Die vollständige window.gtag-Deklaration befindet sich in
// gadsConversionService.ts (unterstützt alle gtag-Befehle inkl. consent, set, js).
// Hier keine eigene Declaration, um TypeScript-Konflikte zu vermeiden.

// Initialize analytics services
class AnalyticsInitializer {
  private static instance: AnalyticsInitializer;
  
  private constructor() {
    this.initializeGoogleAnalytics();
    this.initializeMetaPixel();
    this.initializeMouseflow();
  }

  static getInstance(): AnalyticsInitializer {
    if (!AnalyticsInitializer.instance) {
      AnalyticsInitializer.instance = new AnalyticsInitializer();
    }
    return AnalyticsInitializer.instance;
  }

  private initializeGoogleAnalytics(): void {
    const gaId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;
    if (!gaId) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    window.gtag = function() {
      (window as any).dataLayer = (window as any).dataLayer || [];
      // eslint-disable-next-line prefer-rest-params
      (window as any).dataLayer.push(arguments);
    };

    window.gtag('config', gaId, {
      send_page_view: false, // We'll handle page views manually
      custom_map: {
        'custom_parameter_1': 'user_type',
        'custom_parameter_2': 'auction_id',
      },
    });

    logger.log('Google Analytics initialized');
  }

  private initializeMetaPixel(): void {
    const pixelId = import.meta.env.VITE_META_PIXEL_ID;
    if (!pixelId) return;

    // Meta Pixel initialization (standard FB snippet, disable ESLint rules)
    /* eslint-disable prefer-rest-params, prefer-spread, @typescript-eslint/no-unused-expressions */
    (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function() {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable prefer-rest-params, prefer-spread, @typescript-eslint/no-unused-expressions */

    (window as any).fbq('init', pixelId);
    (window as any).fbq('track', 'PageView');

    logger.log('Meta Pixel initialized');
  }

  private initializeMouseflow(): void {
    const mouseflowId = import.meta.env.VITE_MOUSEFLOW_ID;
    if (!mouseflowId) return;

    (window as any)._mfq = (window as any)._mfq || [];
    (function() {
      const mf = document.createElement('script');
      mf.type = 'text/javascript';
      mf.defer = true;
      mf.src = `//cdn.mouseflow.com/projects/${mouseflowId}.js`;
      document.getElementsByTagName('head')[0].appendChild(mf);
    })();

    logger.log('Mouseflow initialized');
  }
}

// DEAKTIVIERT: AnalyticsInitializer lädt ein zweites gtag.js Script
// und überschreibt window.gtag, was den Consent Mode Default zurücksetzt.
// gtag.js wird bereits korrekt in index.html geladen mit Consent Mode v2.
// Meta Pixel und Mouseflow werden ebenfalls dort oder über separate Dienste geladen.
// if (import.meta.env.PROD) {
//   AnalyticsInitializer.getInstance();
// }

// Enhanced tracking functions
export const trackMetaPixelEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, parameters);
  }
};

export const trackMouseflowEvent = (eventName: string, data?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any)._mfq) {
    (window as any)._mfq.push(['setVariable', eventName, data]);
  }
};

// Enhanced business event tracking
export const trackEnhancedBusinessEvent = (event: BusinessEvent) => {
  // Track in Google Analytics
  if (window.gtag) {
    window.gtag('event', event.type, {
      event_category: 'business',
      event_label: event.type,
      value: event.value,
      user_id: event.userId,
      custom_parameter_1: event.metadata?.user_type || 'unknown',
      custom_parameter_2: event.metadata?.auction_id || '',
    });
  }

  // Track in Meta Pixel
  const metaEventMap: Record<string, string> = {
    'vehicle_listed': 'AddToCart',
    'bid_placed': 'AddToCart',
    'auction_won': 'Purchase',
    'appointment_booked': 'Schedule',
    'user_registered': 'CompleteRegistration',
  };

  const metaEvent = metaEventMap[event.type];
  if (metaEvent) {
    trackMetaPixelEvent(metaEvent, {
      value: event.value,
      currency: 'EUR',
      content_type: 'motorhome',
      content_ids: [event.metadata?.motorhome_id || ''],
    });
  }

  // Track in Mouseflow
  trackMouseflowEvent(event.type, {
    value: event.value,
    userId: event.userId,
    timestamp: event.timestamp,
    ...event.metadata,
  });

  // Original tracking
  trackBusinessEvent(event);
};
