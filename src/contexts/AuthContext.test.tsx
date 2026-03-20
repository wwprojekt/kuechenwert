/**
 * Authentication Context Tests
 * Tests for the AuthContext and useAuth hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import React from 'react';

// Mock Supabase
const mockSupabase = {
  auth: {
    onAuthStateChange: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
  },
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });
  });

  it('should initialize with no user and loading state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
    expect(result.current.loading).toBe(true);
  });

  it('should update state when auth state changes', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };
    const mockSession = {
      user: mockUser,
      access_token: 'test-token',
    };

    // Mock auth state change callback
    let authStateCallback: (event: string, session: any) => void;
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Trigger auth state change
    act(() => {
      authStateCallback('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle existing session on mount', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };
    const mockSession = {
      user: mockUser,
      access_token: 'test-token',
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle sign out correctly', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    // Start with authenticated user
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    // Sign out
    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
  });

  it('should handle auth errors gracefully', async () => {
    mockSupabase.auth.getSession.mockRejectedValue(new Error('Auth error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
    });
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });

  it('should clean up subscription on unmount', () => {
    const mockUnsubscribe = vi.fn();
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    const { unmount } = renderHook(() => useAuth(), { wrapper });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
