/**
 * Security Utilities
 * CSRF protection, input sanitization, and security headers
 */

import { logger } from './logger';

export interface CSRFToken {
  token: string;
  timestamp: number;
  expires: number;
}

class SecurityManager {
  private csrfTokens = new Map<string, CSRFToken>();
  private readonly TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

  /**
   * Generate CSRF token for forms
   */
  generateCSRFToken(): string {
    const token = this.generateRandomToken();
    const now = Date.now();
    
    this.csrfTokens.set(token, {
      token,
      timestamp: now,
      expires: now + this.TOKEN_EXPIRY,
    });

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    return token;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string): boolean {
    const storedToken = this.csrfTokens.get(token);
    
    if (!storedToken) {
      return false;
    }

    const now = Date.now();
    if (now > storedToken.expires) {
      this.csrfTokens.delete(token);
      return false;
    }

    // Token is valid, remove it (one-time use)
    this.csrfTokens.delete(token);
    return true;
  }

  /**
   * Generate cryptographically secure random token
   */
  private generateRandomToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Clean up expired CSRF tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, data] of this.csrfTokens.entries()) {
      if (now > data.expires) {
        this.csrfTokens.delete(token);
      }
    }
  }

  /**
   * Sanitize HTML content to prevent XSS
   */
  sanitizeHTML(html: string): string {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.textContent = html; // This escapes HTML automatically
    return temp.innerHTML;
  }

  /**
   * Sanitize user input for database queries
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>"]/g, '')
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate file upload security
   */
  validateFileUpload(file: File): { valid: boolean; error?: string } {
    // Check file size (max 25MB for documents, images are auto-compressed)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, error: 'File too large (max 25MB)' };
    }

    // Check file type
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'File type not allowed' };
    }

    // Check file name for suspicious patterns
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.php$/i,
      /\.js$/i,
      /\.html$/i,
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
      return { valid: false, error: 'Suspicious file name' };
    }

    return { valid: true };
  }

  /**
   * Generate Content Security Policy
   */
  generateCSP(): string {
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self' https:",
      "object-src 'none'",
      "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ];

    return directives.join('; ');
  }

  /**
   * Set security headers (for use in index.html or server configuration)
   */
  getSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': this.generateCSP(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    };
  }

  /**
   * Validate JWT token structure (basic validation)
   */
  validateJWTStructure(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    try {
      // Try to decode the header and payload
      const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      // Basic structure validation
      return !!(header.alg && payload.sub && payload.exp);
    } catch {
      return false;
    }
  }

  /**
   * Rate limit check for client-side operations
   */
  checkClientRateLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create rate limit data
    let rateLimitData: { timestamps: number[] };
    try {
      rateLimitData = JSON.parse(
        localStorage.getItem(`rate_limit_${key}`) || '{"timestamps": []}'
      );
      if (!Array.isArray(rateLimitData?.timestamps)) {
        rateLimitData = { timestamps: [] };
      }
    } catch {
      rateLimitData = { timestamps: [] };
    }

    // Filter out old timestamps
    rateLimitData.timestamps = rateLimitData.timestamps.filter(
      (timestamp: number) => timestamp > windowStart
    );

    // Check if limit exceeded
    if (rateLimitData.timestamps.length >= limit) {
      return false;
    }

    // Add current timestamp
    rateLimitData.timestamps.push(now);
    
    // Store updated data
    localStorage.setItem(`rate_limit_${key}`, JSON.stringify(rateLimitData));
    
    return true;
  }

  /**
   * Encoded Storage Utility
   * 
   * WARNING: This uses base64 encoding, NOT encryption!
   * Base64 is easily reversible and provides NO security.
   * 
   * DO NOT use this for:
   * - Passwords or authentication tokens
   * - Personal Identifiable Information (PII)
   * - Financial data
   * - Any sensitive information
   * 
   * Use only for:
   * - Non-sensitive preferences
   * - UI state that should survive page reloads
   * - Data that is already public
   */
  encodedStorage = {
    set: (key: string, value: unknown): void => {
      try {
        const encoded = btoa(JSON.stringify(value));
        localStorage.setItem(`encoded_${key}`, encoded);
      } catch (error) {
        logger.error('Encoded storage set failed:', error);
      }
    },

    get: <T = unknown>(key: string): T | null => {
      try {
        const encoded = localStorage.getItem(`encoded_${key}`);
        if (!encoded) return null;
        return JSON.parse(atob(encoded)) as T;
      } catch (error) {
        logger.error('Encoded storage get failed:', error);
        return null;
      }
    },

    remove: (key: string): void => {
      localStorage.removeItem(`encoded_${key}`);
    },

    clear: (): void => {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('encoded_')) {
          localStorage.removeItem(key);
        }
      });
    },
  };

  /**
   * @deprecated Use encodedStorage instead. secureStorage is misleading as it doesn't encrypt data.
   */
  secureStorage = this.encodedStorage;
}

// Export singleton instance
export const security = new SecurityManager();

// Export convenience functions
export const generateCSRFToken = () => security.generateCSRFToken();
export const validateCSRFToken = (token: string) => security.validateCSRFToken(token);
export const sanitizeHTML = (html: string) => security.sanitizeHTML(html);
export const sanitizeInput = (input: string) => security.sanitizeInput(input);
export const validateFileUpload = (file: File) => security.validateFileUpload(file);
export const checkClientRateLimit = (key: string, limit: number, windowMs: number) =>
  security.checkClientRateLimit(key, limit, windowMs);
export const encodedStorage = security.encodedStorage;
/** @deprecated Use encodedStorage instead. secureStorage is misleading as it doesn't encrypt data. */
export const secureStorage = security.secureStorage;
