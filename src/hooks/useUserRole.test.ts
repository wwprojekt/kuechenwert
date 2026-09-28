import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';

type RoleResult = { data: { role: string } | null; error: null };

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  maybeSingle: vi.fn<() => Promise<RoleResult>>(),
  refreshSession: vi.fn(),
  ensureValidRLSSession: vi.fn<() => Promise<boolean>>(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, session: null, loading: false, signOut: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
    })),
    auth: { refreshSession: mocks.refreshSession },
  },
}));

vi.mock('@/lib/sessionGuard', () => ({
  ensureValidRLSSession: mocks.ensureValidRLSSession,
  isLockError: () => false,
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function renderUserRole() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(() => useUserRole(), { wrapper });
}

function roleRow(role: string | null): RoleResult {
  return { data: role ? { role } : null, error: null };
}

describe('useUserRole', () => {
  beforeEach(() => {
    mocks.user = { id: 'user-1' };
    mocks.maybeSingle.mockReset();
    mocks.refreshSession.mockReset().mockResolvedValue({ error: null });
    mocks.ensureValidRLSSession.mockReset().mockResolvedValue(true);
  });

  it('returns empty role data without querying when nobody is logged in', () => {
    mocks.user = null;
    const { result } = renderUserRole();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.primaryRole).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isDealer).toBe(false);
    expect(result.current.isSeller).toBe(false);
    expect(result.current.getDashboardRoute()).toBe('/dashboard');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it.each([
    ['admin', { isAdmin: true, isDealer: false, isSeller: false }, '/admin'],
    ['dealer', { isAdmin: false, isDealer: true, isSeller: false }, '/dashboard'],
    ['seller', { isAdmin: false, isDealer: false, isSeller: true }, '/dashboard'],
    ['consumer', { isAdmin: false, isDealer: false, isSeller: false }, '/dashboard'],
  ])('resolves the %s role', async (role, flags, route) => {
    mocks.maybeSingle.mockResolvedValue(roleRow(role));
    const { result } = renderUserRole();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.primaryRole).toBe(role));
    expect(result.current).toMatchObject({ ...flags, isLoading: false });
    expect(result.current.getDashboardRoute()).toBe(route);
    expect(supabase.from).toHaveBeenCalledWith('user_roles');
  });

  it('re-queries after a session refresh when no role row is found', async () => {
    mocks.maybeSingle.mockResolvedValueOnce(roleRow(null)).mockResolvedValueOnce(roleRow('dealer'));
    const { result } = renderUserRole();

    await waitFor(() => expect(result.current.primaryRole).toBe('dealer'));
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('falls back to seller when the user has no role row at all', async () => {
    mocks.maybeSingle.mockResolvedValue(roleRow(null));
    const { result } = renderUserRole();

    await waitFor(() => expect(result.current.primaryRole).toBe('seller'));
    expect(result.current.isSeller).toBe(true);
  });

  it('reports an expired session instead of guessing a role', async () => {
    mocks.ensureValidRLSSession.mockResolvedValue(false);
    const { result } = renderUserRole();

    await waitFor(() => expect(result.current.error?.message).toBe('SESSION_EXPIRED'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.primaryRole).toBeNull();
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });
});
