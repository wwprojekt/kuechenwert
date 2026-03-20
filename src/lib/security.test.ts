/**
 * Security Utilities Tests
 * Tests for CSRF, input sanitization, file validation, and rate limiting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  security, 
  generateCSRFToken, 
  validateCSRFToken, 
  sanitizeInput, 
  validateFileUpload 
} from './security';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('CSRF Token Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should generate a CSRF token', () => {
    const token = generateCSRFToken();
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64); // 32 bytes = 64 hex characters
  });

  it('should generate unique tokens', () => {
    const token1 = generateCSRFToken();
    const token2 = generateCSRFToken();
    
    expect(token1).not.toBe(token2);
  });

  it('should validate a valid token', () => {
    const token = generateCSRFToken();
    const isValid = validateCSRFToken(token);
    
    expect(isValid).toBe(true);
  });

  it('should invalidate token after single use', () => {
    const token = generateCSRFToken();
    
    // First validation should succeed
    expect(validateCSRFToken(token)).toBe(true);
    
    // Second validation should fail (token consumed)
    expect(validateCSRFToken(token)).toBe(false);
  });

  it('should reject invalid tokens', () => {
    expect(validateCSRFToken('invalid-token')).toBe(false);
    expect(validateCSRFToken('')).toBe(false);
  });
});

describe('Input Sanitization', () => {
  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
    expect(sanitizeInput('\n\ttest\n')).toBe('test');
  });

  it('should remove dangerous characters', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeInput('Hello <world>')).toBe('Hello world');
    expect(sanitizeInput("Test's \"quoted\"")).toBe('Tests quoted');
  });

  it('should limit input length', () => {
    const longInput = 'a'.repeat(2000);
    const sanitized = sanitizeInput(longInput);
    
    expect(sanitized.length).toBe(1000);
  });

  it('should handle non-string input', () => {
    expect(sanitizeInput(123 as unknown as string)).toBe('');
    expect(sanitizeInput(null as unknown as string)).toBe('');
    expect(sanitizeInput(undefined as unknown as string)).toBe('');
  });
});

describe('File Upload Validation', () => {
  it('should accept valid image files', () => {
    const validFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(validFile, 'size', { value: 1024 * 1024 }); // 1MB
    
    const result = validateFileUpload(validFile);
    
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept PDF files', () => {
    const pdfFile = new File([''], 'document.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfFile, 'size', { value: 1024 * 1024 }); // 1MB
    
    const result = validateFileUpload(pdfFile);
    
    expect(result.valid).toBe(true);
  });

  it('should reject files that are too large', () => {
    const largeFile = new File([''], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 }); // 15MB
    
    const result = validateFileUpload(largeFile);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  it('should reject disallowed file types', () => {
    const exeFile = new File([''], 'virus.exe', { type: 'application/x-executable' });
    Object.defineProperty(exeFile, 'size', { value: 1024 }); // 1KB
    
    const result = validateFileUpload(exeFile);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('type not allowed');
  });

  it('should reject suspicious file names', () => {
    const suspiciousFile = new File([''], 'script.php', { type: 'image/jpeg' });
    Object.defineProperty(suspiciousFile, 'size', { value: 1024 }); // 1KB
    
    const result = validateFileUpload(suspiciousFile);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Suspicious');
  });
});

describe('JWT Structure Validation', () => {
  it('should validate a valid JWT structure', () => {
    // Create a mock JWT with valid structure (header.payload.signature)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'user123', exp: Date.now() + 3600000 }));
    const signature = 'mock-signature';
    const validJWT = `${header}.${payload}.${signature}`;
    
    expect(security.validateJWTStructure(validJWT)).toBe(true);
  });

  it('should reject invalid JWT structures', () => {
    expect(security.validateJWTStructure('')).toBe(false);
    expect(security.validateJWTStructure('not.a.jwt.token')).toBe(false);
    expect(security.validateJWTStructure('invalid')).toBe(false);
    expect(security.validateJWTStructure('a.b')).toBe(false);
  });

  it('should reject JWT with missing required fields', () => {
    // Missing 'alg' in header
    const header = btoa(JSON.stringify({ typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'user123', exp: Date.now() }));
    const invalidJWT = `${header}.${payload}.signature`;
    
    expect(security.validateJWTStructure(invalidJWT)).toBe(false);
  });
});

describe('Rate Limiting', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should allow requests within limit', () => {
    const result1 = security.checkClientRateLimit('test', 3, 60000);
    const result2 = security.checkClientRateLimit('test', 3, 60000);
    const result3 = security.checkClientRateLimit('test', 3, 60000);
    
    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(true);
  });

  it('should block requests exceeding limit', () => {
    // Make 3 requests (limit)
    security.checkClientRateLimit('test', 3, 60000);
    security.checkClientRateLimit('test', 3, 60000);
    security.checkClientRateLimit('test', 3, 60000);
    
    // 4th request should be blocked
    const result = security.checkClientRateLimit('test', 3, 60000);
    
    expect(result).toBe(false);
  });

  it('should use separate limits for different keys', () => {
    // Fill up limit for key1
    security.checkClientRateLimit('key1', 2, 60000);
    security.checkClientRateLimit('key1', 2, 60000);
    
    // key1 is at limit
    expect(security.checkClientRateLimit('key1', 2, 60000)).toBe(false);
    
    // key2 should still work
    expect(security.checkClientRateLimit('key2', 2, 60000)).toBe(true);
  });
});

describe('Encoded Storage', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should store and retrieve values', () => {
    const testData = { name: 'Test', value: 123 };
    
    security.encodedStorage.set('test', testData);
    const retrieved = security.encodedStorage.get<typeof testData>('test');
    
    expect(retrieved).toEqual(testData);
  });

  it('should return null for non-existent keys', () => {
    const result = security.encodedStorage.get('nonexistent');
    
    expect(result).toBeNull();
  });

  it('should remove stored values', () => {
    security.encodedStorage.set('test', 'value');
    expect(security.encodedStorage.get('test')).toBe('value');
    
    security.encodedStorage.remove('test');
    expect(security.encodedStorage.get('test')).toBeNull();
  });

  it('should clear all encoded storage items', () => {
    security.encodedStorage.set('item1', 'value1');
    security.encodedStorage.set('item2', 'value2');
    
    security.encodedStorage.clear();
    
    expect(security.encodedStorage.get('item1')).toBeNull();
    expect(security.encodedStorage.get('item2')).toBeNull();
  });

  it('should not clear non-encoded localStorage items', () => {
    localStorage.setItem('regular_item', 'regular_value');
    security.encodedStorage.set('encoded_item', 'encoded_value');
    
    security.encodedStorage.clear();
    
    expect(localStorage.getItem('regular_item')).toBe('regular_value');
    expect(security.encodedStorage.get('encoded_item')).toBeNull();
  });
});

describe('Content Security Policy', () => {
  it('should generate valid CSP string', () => {
    const csp = security.generateCSP();
    
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('should include all security headers', () => {
    const headers = security.getSecurityHeaders();
    
    expect(headers['Content-Security-Policy']).toBeDefined();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBeDefined();
  });
});
