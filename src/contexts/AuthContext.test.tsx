/**
 * Authentication Context Tests
 * Tests for the AuthContext and useAuth hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from './AuthContext';

type AuthCallback = (event: string, session: unknown) => Promise<void> | void;

const mockSupabase = vi.hoisted(() => ({
  auth: {
    onAuthStateChange: vi.fn(),
    getSession: vi.fn(),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const mockUser = { id: 'test-user-id', email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };

describe('AuthContext', () => {
  beforeEach(() => {
    mockSupabase.auth.onAuthStateChange.mockReset().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSupabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
    mockSupabase.auth.refreshSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    mockSupabase.auth.signOut.mockReset().mockResolvedValue({ error: null });
  });

  function captureAuthCallback(): () => AuthCallback {
    let callback: AuthCallback | undefined;
    mockSupabase.auth.onAuthStateChange.mockImplementation((cb: AuthCallback) => {
      callback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    return () => {
      if (!callback) throw new Error('onAuthStateChange was not subscribed');
      return callback;
    };
  }

  it('should initialize with no user and loading state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
    expect(result.current.loading).toBe(true);
  });

  it('should update state when auth state changes', async () => {
    const mockSession = { user: mockUser, access_token: 'test-token' };
    const authCallback = captureAuthCallback();

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBe(null);

    await act(async () => {
      await authCallback()('SIGNED_IN', mockSession);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.loading).toBe(false);
  });

  it('should keep the user object stable when only the token is refreshed', async () => {
    const authCallback = captureAuthCallback();
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser, access_token: 'a' } } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));
    const userBefore = result.current.user;

    await act(async () => {
      await authCallback()('TOKEN_REFRESHED', { user: { ...mockUser }, access_token: 'b' });
    });

    expect(result.current.session).toMatchObject({ access_token: 'b' });
    expect(result.current.user).toBe(userBefore);
  });

  it('should handle existing session on mount', async () => {
    const mockSession = { user: mockUser, access_token: 'test-token' };
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should sign out and clear the query cache', async () => {
    const clearSpy = vi.spyOn(queryClient, 'clear');
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
    clearSpy.mockRestore();
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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
    consoleError.mockRestore();
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
