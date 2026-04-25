/**
 * Audio Notification Hook
 * Provides browser-based audio notifications for dealers
 *
 * Respects per-user preferences from `user_notification_preferences`:
 *   - `audio_enabled` gates ALL tones (master switch)
 *   - `audio_volume` sets the amplitude
 *   - `audio_new_bid` / `audio_outbid` / `audio_auction_won` gate the
 *     respective sub-types. A missing prefs row defaults to "play" so
 *     users who never opened the settings still hear the default tones.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AudioNotificationOptions {
  enabled: boolean;
  volume: number; // 0-1
  sound: 'default' | 'success' | 'warning' | 'error';
}

const DEFAULT_OPTIONS: AudioNotificationOptions = {
  enabled: true,
  volume: 0.7,
  sound: 'default',
};

type SoundType = 'bid' | 'outbid' | 'won' | 'general';

interface TypedAudioPrefs {
  audio_enabled: boolean | null;
  audio_volume: number | null;
  audio_new_bid: boolean | null;
  audio_outbid: boolean | null;
  audio_auction_won: boolean | null;
}

export const useAudioNotification = (options: Partial<AudioNotificationOptions> = {}) => {
  const _audioRef = useRef<HTMLAudioElement | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const { user } = useAuth();

  const { data: prefs } = useQuery<TypedAudioPrefs | null>({
    queryKey: ['audio-prefs', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('audio_enabled, audio_volume, audio_new_bid, audio_outbid, audio_auction_won')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        logger.warn('[useAudioNotification] prefs fetch failed, defaulting to PLAY:', error);
        return null;
      }
      return (data as TypedAudioPrefs | null) ?? null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Explicit caller-overrides (options arg) take priority over DB prefs; the DB
  // row is the per-user persistent default. A missing prefs row => play with
  // the hardcoded DEFAULT_OPTIONS (never silently opts users out).
  const config = {
    ...DEFAULT_OPTIONS,
    ...(prefs?.audio_enabled != null ? { enabled: prefs.audio_enabled } : {}),
    ...(prefs?.audio_volume != null ? { volume: prefs.audio_volume } : {}),
    ...options,
  };

  const isTypeAllowed = useCallback(
    (type: SoundType): boolean => {
      if (!prefs) return true; // no prefs loaded yet / anonymous user => play
      switch (type) {
        case 'bid':
          return prefs.audio_new_bid !== false;
        case 'outbid':
          return prefs.audio_outbid !== false;
        case 'won':
          return prefs.audio_auction_won !== false;
        case 'general':
        default:
          return true;
      }
    },
    [prefs]
  );

  useEffect(() => {
    // Check if audio is supported
    setIsSupported('Audio' in window);
    
    // Check notification permission
    if ('Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
    }
  }, []);

  /**
   * Play notification sound
   */
  const playNotification = useCallback(async (type: SoundType = 'general') => {
    if (!config.enabled || !isSupported) return;
    if (!isTypeAllowed(type)) return;

    try {
      // Create audio context for better browser support
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Generate different tones for different notification types
      const frequencies = {
        bid: [800, 1000], // Pleasant ascending tone
        outbid: [400, 300], // Warning descending tone  
        won: [523, 659, 784], // Success chord
        general: [600], // Simple tone
      };

      const freq = frequencies[type];
      const duration = type === 'won' ? 1000 : 300;
      
      for (let i = 0; i < freq.length; i++) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq[i], audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(config.volume * 0.3, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime + i * 0.1);
        oscillator.stop(audioContext.currentTime + duration / 1000 + i * 0.1);
      }

    } catch (error) {
      logger.warn('Could not play audio notification:', error);
    }
  }, [config.enabled, config.volume, isSupported, isTypeAllowed]);

  /**
   * Request permission for notifications
   */
  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setHasPermission(permission === 'granted');
      return permission === 'granted';
    }
    return hasPermission;
  }, [hasPermission]);

  /**
   * Show browser notification with audio
   */
  const showNotification = useCallback(async (
    title: string,
    options: NotificationOptions & { playSound?: boolean; soundType?: 'bid' | 'outbid' | 'won' | 'general' } = {}
  ) => {
    const { playSound = true, soundType = 'general', ...notificationOptions } = options;

    // Play audio notification
    if (playSound) {
      await playNotification(soundType);
    }

    // Show browser notification if permitted
    if (hasPermission && 'Notification' in window) {
      const notification = new Notification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...notificationOptions,
      });
      
      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }, [hasPermission, playNotification]);

  /**
   * Auction-specific notifications
   */
  const notifyNewBid = useCallback(async (amount: number, bidderName: string) => {
    await showNotification(
      'Neues Gebot eingegangen!',
      {
        body: `€${amount.toLocaleString('de-DE')} von ${bidderName}`,
        soundType: 'bid',
        tag: 'new-bid',
      }
    );
  }, [showNotification]);

  const notifyOutbid = useCallback(async (amount: number) => {
    await showNotification(
      'Sie wurden überboten! 🚨',
      {
        body: `Neues Höchstgebot: €${amount.toLocaleString('de-DE')}`,
        soundType: 'outbid',
        tag: 'outbid',
        requireInteraction: true,
      }
    );
  }, [showNotification]);

  const notifyAuctionWon = useCallback(async (vehicleName: string, amount: number) => {
    await showNotification(
      'Auktion gewonnen! 🎉',
      {
        body: `${vehicleName} für €${amount.toLocaleString('de-DE')}`,
        soundType: 'won',
        tag: 'auction-won',
        requireInteraction: true,
      }
    );
  }, [showNotification]);

  /**
   * Test notification
   */
  const testNotification = useCallback(async () => {
    await showNotification(
      'Test-Benachrichtigung',
      {
        body: 'Audio-Benachrichtigungen sind aktiv!',
        soundType: 'general',
      }
    );
  }, [showNotification]);

  return {
    // State
    isSupported,
    hasPermission,
    
    // Actions
    playNotification,
    showNotification,
    requestPermission,
    testNotification,
    
    // Specialized notifications
    notifyNewBid,
    notifyOutbid,
    notifyAuctionWon,
    
    // Config
    enabled: config.enabled,
  };
};
