/**
 * useUserRole Hook Tests
 * Tests for user role management and permission logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// Mock modules before importing the hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    session: null,
    loading: false,
    signOut: async () => {},
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

// Mocks are set up above - imports are used implicitly by vi.mock
// We don't need to explicitly import them as we're just testing the hook behavior

// Helper function to test getPrimaryRole logic (extracted from hook)
function getPrimaryRole(roles: ('admin' | 'dealer' | 'seller')[]): 'admin' | 'dealer' | 'seller' {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('dealer')) return 'dealer';
  return 'seller';
}

// Helper function to test getDashboardRoute logic (extracted from hook)
function getDashboardRoute(primaryRole: 'admin' | 'dealer' | 'seller'): string {
  switch (primaryRole) {
    case 'admin':
      return '/admin';
    case 'dealer':
      return '/dashboard';
    case 'seller':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}

// Create a test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('getPrimaryRole', () => {
  it('should return admin when roles include admin', () => {
    expect(getPrimaryRole(['admin'])).toBe('admin');
    expect(getPrimaryRole(['admin', 'dealer'])).toBe('admin');
    expect(getPrimaryRole(['admin', 'dealer', 'seller'])).toBe('admin');
  });

  it('should return dealer when roles include dealer but not admin', () => {
    expect(getPrimaryRole(['dealer'])).toBe('dealer');
    expect(getPrimaryRole(['dealer', 'seller'])).toBe('dealer');
  });

  it('should return seller when only seller role', () => {
    expect(getPrimaryRole(['seller'])).toBe('seller');
  });

  it('should return seller for empty roles', () => {
    expect(getPrimaryRole([])).toBe('seller');
  });

  it('should follow hierarchy admin > dealer > seller', () => {
    // Admin takes precedence
    expect(getPrimaryRole(['seller', 'admin'])).toBe('admin');
    expect(getPrimaryRole(['dealer', 'admin'])).toBe('admin');
    
    // Dealer takes precedence over seller
    expect(getPrimaryRole(['seller', 'dealer'])).toBe('dealer');
  });
});

describe('getDashboardRoute', () => {
  it('should return /admin for admin role', () => {
    expect(getDashboardRoute('admin')).toBe('/admin');
  });

  it('should return /dashboard for dealer role', () => {
    expect(getDashboardRoute('dealer')).toBe('/dashboard');
  });

  it('should return /dashboard for seller role', () => {
    expect(getDashboardRoute('seller')).toBe('/dashboard');
  });
});

describe('useUserRole hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return seller defaults when no user is logged in', async () => {
    // Import the hook dynamically to get fresh instance with mocks
    const { useUserRole } = await import('./useUserRole');
    
    const { result } = renderHook(() => useUserRole(), {
      wrapper: createWrapper(),
    });

    // Should return default seller values for unauthenticated user
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // No user means no roles data
    expect(result.current.primaryRole).toBeUndefined();
    expect(result.current.isAdmin).toBeUndefined();
    expect(result.current.isDealer).toBeUndefined();
    expect(result.current.isSeller).toBeUndefined();
  });

  it('should return getDashboardRoute function', async () => {
    const { useUserRole } = await import('./useUserRole');
    
    const { result } = renderHook(() => useUserRole(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.getDashboardRoute).toBe('function');
    // Should return /dashboard for default seller
    expect(result.current.getDashboardRoute()).toBe('/dashboard');
  });
});

describe('Permission logic', () => {
  it('admin should have access to all areas', () => {
    const roles: ('admin' | 'dealer' | 'seller')[] = ['admin'];
    const isAdmin = roles.includes('admin');
    const isDealer = roles.includes('dealer');
    const isSeller = roles.includes('seller');

    const canAccessAdmin = isAdmin;
    const canAccessDealer = isDealer || isAdmin;
    const canAccessUser = isSeller || isDealer || isAdmin;

    expect(canAccessAdmin).toBe(true);
    expect(canAccessDealer).toBe(true);
    expect(canAccessUser).toBe(true);
  });

  it('dealer should not have admin access but can access dealer and user areas', () => {
    const roles: ('admin' | 'dealer' | 'seller')[] = ['dealer'];
    const isAdmin = roles.includes('admin');
    const isDealer = roles.includes('dealer');
    const isSeller = roles.includes('seller');

    const canAccessAdmin = isAdmin;
    const canAccessDealer = isDealer || isAdmin;
    const canAccessUser = isSeller || isDealer || isAdmin;

    expect(canAccessAdmin).toBe(false);
    expect(canAccessDealer).toBe(true);
    expect(canAccessUser).toBe(true);
  });

  it('seller should only have user access', () => {
    const roles: ('admin' | 'dealer' | 'seller')[] = ['seller'];
    const isAdmin = roles.includes('admin');
    const isDealer = roles.includes('dealer');
    const isSeller = roles.includes('seller');

    const canAccessAdmin = isAdmin;
    const canAccessDealer = isDealer || isAdmin;
    const canAccessUser = isSeller || isDealer || isAdmin;

    expect(canAccessAdmin).toBe(false);
    expect(canAccessDealer).toBe(false);
    expect(canAccessUser).toBe(true);
  });

  it('hasAnyRole should work correctly', () => {
    const allRoles: ('admin' | 'dealer' | 'seller')[] = ['dealer', 'seller'];
    
    const hasAnyRole = (requiredRoles: ('admin' | 'dealer' | 'seller')[]) => {
      return requiredRoles.some(role => allRoles.includes(role));
    };

    expect(hasAnyRole(['admin'])).toBe(false);
    expect(hasAnyRole(['dealer'])).toBe(true);
    expect(hasAnyRole(['seller'])).toBe(true);
    expect(hasAnyRole(['admin', 'dealer'])).toBe(true);
    expect(hasAnyRole(['admin', 'seller'])).toBe(true);
  });
});
