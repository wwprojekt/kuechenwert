/**
 * Service Worker Registration and Management
 * Handles SW lifecycle and provides cache management utilities
 */

import React from 'react';
import { logger } from './logger';

interface ServiceWorkerManager {
  register: () => Promise<ServiceWorkerRegistration | null>;
  unregister: () => Promise<boolean>;
  update: () => Promise<void>;
  clearCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;
  isSupported: () => boolean;
}

class ServiceWorkerManagerImpl implements ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isProduction = import.meta.env.PROD;

  /**
   * Check if service worker is supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Register the service worker
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      logger.warn('Service Worker not supported in this browser');
      return null;
    }

    // Only register in production or if explicitly enabled
    if (!this.isProduction && !import.meta.env.VITE_ENABLE_SW) {
      logger.log('Service Worker registration skipped in development');
      return null;
    }

    try {
      logger.log('Service Worker: Registering...');
      
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      logger.log('Service Worker: Registered successfully', this.registration);

      // Handle service worker updates
      this.handleUpdates();

      // Listen for messages from service worker
      this.setupMessageListener();

      return this.registration;
    } catch (error) {
      logger.error('Service Worker: Registration failed', error);
      return null;
    }
  }

  /**
   * Unregister the service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      logger.log('Service Worker: Unregistered', result);
      this.registration = null;
      return result;
    } catch (error) {
      logger.error('Service Worker: Unregistration failed', error);
      return false;
    }
  }

  /**
   * Check for and apply service worker updates
   */
  async update(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    try {
      logger.log('Service Worker: Checking for updates...');
      await this.registration.update();
      logger.log('Service Worker: Update check completed');
    } catch (error) {
      logger.error('Service Worker: Update check failed', error);
      throw error;
    }
  }

  /**
   * Clear all caches managed by service worker
   */
  async clearCache(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    return this.sendMessage({ type: 'CLEAR_CACHE' });
  }

  /**
   * Get total cache size
   */
  async getCacheSize(): Promise<number> {
    if (!this.registration) {
      return 0;
    }

    const response = await this.sendMessage({ type: 'GET_CACHE_SIZE' });
    return response.size || 0;
  }

  /**
   * Handle service worker updates
   */
  private handleUpdates(): void {
    if (!this.registration) return;

    // Handle waiting service worker
    if (this.registration.waiting) {
      this.showUpdateAvailable();
    }

    // Listen for new service worker
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.showUpdateAvailable();
        }
      });
    });

    // Listen for service worker control changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      logger.log('Service Worker: Controller changed, reloading page');
      window.location.reload();
    });
  }

  /**
   * Show update available notification
   */
  private showUpdateAvailable(): void {
    logger.log('Service Worker: Update available');
    
    // Dispatch custom event for UI to handle
    const event = new CustomEvent('sw-update-available', {
      detail: { registration: this.registration }
    });
    window.dispatchEvent(event);
  }

  /**
   * Apply waiting service worker update
   */
  applyUpdate(): void {
    if (!this.registration?.waiting) {
      logger.warn('Service Worker: No update waiting');
      return;
    }

    logger.log('Service Worker: Applying update...');
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  /**
   * Send message to service worker
   */
  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.registration?.active) {
        reject(new Error('No active service worker'));
        return;
      }

      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      this.registration.active.postMessage(message, [messageChannel.port2]);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Service Worker message timeout'));
      }, 10000);
    });
  }

  /**
   * Setup message listener for service worker events
   */
  private setupMessageListener(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      logger.log('Service Worker: Message received', event.data);
      
      // Handle different message types
      if (event.data?.type) {
        switch (event.data.type) {
          case 'CACHE_UPDATED':
            // Notify UI about cache updates
            window.dispatchEvent(new CustomEvent('sw-cache-updated', {
              detail: event.data
            }));
            break;
          
          case 'OFFLINE_READY':
            // Notify UI that app is ready for offline use
            window.dispatchEvent(new CustomEvent('sw-offline-ready'));
            break;
        }
      }
    });
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManagerImpl();

// Convenience functions
export const registerSW = () => serviceWorkerManager.register();
export const unregisterSW = () => serviceWorkerManager.unregister();
export const updateSW = () => serviceWorkerManager.update();
export const clearSWCache = () => serviceWorkerManager.clearCache();
export const getSWCacheSize = () => serviceWorkerManager.getCacheSize();
export const applySWUpdate = () => serviceWorkerManager.applyUpdate();

// Hook for React components
export function useServiceWorker() {
  const [isRegistered, setIsRegistered] = React.useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = React.useState(false);
  const [cacheSize, setCacheSize] = React.useState(0);

  React.useEffect(() => {
    // Register service worker
    registerSW().then((registration) => {
      setIsRegistered(!!registration);
    });

    // Listen for update available
    const handleUpdateAvailable = () => {
      setIsUpdateAvailable(true);
    };

    // Listen for cache updates
    const handleCacheUpdated = () => {
      getSWCacheSize().then(setCacheSize);
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);
    window.addEventListener('sw-cache-updated', handleCacheUpdated);

    // Initial cache size
    getSWCacheSize().then(setCacheSize);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
      window.removeEventListener('sw-cache-updated', handleCacheUpdated);
    };
  }, []);

  return {
    isRegistered,
    isUpdateAvailable,
    cacheSize,
    applyUpdate: applySWUpdate,
    clearCache: clearSWCache,
    updateSW,
  };
}

// Auto-register in production
if (import.meta.env.PROD) {
  registerSW();
}
