/**
 * LiveRegion Component for Accessibility
 * 
 * Announces dynamic content changes to screen readers.
 * Use this to notify users of real-time updates like new bids,
 * form submissions, or status changes.
 * 
 * @example
 * // Basic usage
 * <LiveRegion message={`Neues Gebot: €${amount}`} />
 * 
 * @example
 * // With assertive priority (interrupts current announcement)
 * <LiveRegion message="Auktion beendet!" assertive />
 */

import { useEffect, useState } from 'react';

interface LiveRegionProps {
  /** The message to announce to screen readers */
  message: string;
  /** If true, interrupts current screen reader announcement (use sparingly) */
  assertive?: boolean;
  /** Clear the message after this many milliseconds (default: 5000) */
  clearAfter?: number;
}

export const LiveRegion = ({ 
  message, 
  assertive = false,
  clearAfter = 5000 
}: LiveRegionProps) => {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    setCurrentMessage(message);
    
    // Clear message after delay to allow re-announcement of same message
    if (message && clearAfter > 0) {
      const timer = setTimeout(() => {
        setCurrentMessage('');
      }, clearAfter);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div 
      role="status" 
      aria-live={assertive ? "assertive" : "polite"} 
      aria-atomic="true"
      className="sr-only"
    >
      {currentMessage}
    </div>
  );
};

/**
 * Hook for managing live region announcements
 * 
 * @example
 * const { announce, LiveRegionPortal } = useLiveAnnouncer();
 * 
 * // In your handler:
 * announce(`Neues Gebot: €${amount}`);
 * 
 * // In your JSX:
 * return <>{content}<LiveRegionPortal /></>
 */
export const useLiveAnnouncer = () => {
  const [message, setMessage] = useState('');
  const [key, setKey] = useState(0);

  const announce = (newMessage: string) => {
    setMessage(newMessage);
    setKey(k => k + 1); // Force re-render to announce same message again
  };

  const LiveRegionPortal = () => (
    <LiveRegion key={key} message={message} />
  );

  return { announce, LiveRegionPortal };
};

export default LiveRegion;
