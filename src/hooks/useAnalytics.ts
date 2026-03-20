/**
 * useAnalytics Hook
 * 
 * React hook for integrating analytics tracking with the application.
 * Automatically tracks page views on route changes.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, trackEvent, trackBusinessEvent } from '@/lib/analyticsService';

/**
 * Hook to automatically track page views on route changes
 */
export function usePageTracking() {
  const location = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    // Only track if path actually changed
    if (previousPath.current !== location.pathname) {
      trackPageView(location.pathname, document.title);
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
}

/**
 * Hook to get analytics tracking functions
 */
export function useAnalytics() {
  return {
    trackPageView,
    trackEvent,
    trackBusinessEvent,
  };
}

export { trackPageView, trackEvent, trackBusinessEvent };
