/**
 * User Role Management Hook
 * Provides consistent role detection and management across components
 * 
 * IMPORTANT: This is the single source of truth for user role data.
 * All components that need role information MUST use this hook or usePermissions().
 * The canonical queryKey is ['userRoles', userId] — do NOT create separate role queries.
 * 
 * Each user has exactly ONE role (user_roles has a unique user_id): admin,
 * dealer (Küchenstudio), seller (default at sign-up) or consumer.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';
import { isLockError, ensureValidRLSSession } from '@/lib/sessionGuard';

export type UserRole = Database['public']['Enums']['app_role'];

/**
 * Canonical query key factory for user roles.
 * All role-related queries MUST use this key to ensure cache consistency.
 */
export const userRolesQueryKey = (userId: string | undefined) => ['userRoles', userId] as const;

export interface UserRoleData {
  role: UserRole;
  isAdmin: boolean;
  isDealer: boolean;
  isSeller: boolean;
}

/**
 * Get dashboard route based on role
 */
function getDashboardRoute(role: UserRole): string {
  switch (role) {
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

/**
 * Hook for managing user roles and permissions
 */
export const useUserRole = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: roleData, isLoading: queryLoading, error } = useQuery({
    queryKey: userRolesQueryKey(user?.id),
    queryFn: async (): Promise<UserRoleData> => {
      if (!user) {
        return {
          role: 'seller',
          isAdmin: false,
          isDealer: false,
          isSeller: false,
        };
      }

      // Session-Validierung VOR der RLS-Query: user_roles hat
      // USING(auth.uid()=user_id). Bei abgelaufener Session → auth.uid()=NULL
      // → 0 Zeilen → isDealer=false → Studio-Portal verschwindet still.
      // KRITISCH: getSession() gibt auch abgelaufene Tokens aus dem Cache zurück!
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) {
        logger.error('[useUserRole] Session nicht wiederherstellbar');
        throw new Error('SESSION_EXPIRED');
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (rolesError) {
        logger.error('Error fetching user role:', rolesError);
        throw rolesError;
      }

      // Wenn user eingeloggt aber keine Rolle gefunden: könnte Session-Problem sein.
      // Verifiziere mit einem 2. Versuch nach explizitem Refresh.
      if (!rolesData) {
        logger.warn('[useUserRole] Keine Rolle gefunden für eingeloggten User, verifiziere Session...');
        try {
          const { error: refreshErr } = await supabase.auth.refreshSession();
          if (!refreshErr) {
            const { data: retryData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .limit(1)
              .maybeSingle();
            if (retryData) {
              const role = retryData.role as UserRole;
              logger.log(`[useUserRole] Rolle nach Refresh gefunden: ${role}`);
              return { role, isAdmin: role === 'admin', isDealer: role === 'dealer', isSeller: role === 'seller' };
            }
          }
        } catch (e) {
          if (!isLockError(e)) logger.warn('[useUserRole] Retry nach Refresh fehlgeschlagen:', e);
        }
      }

      // Default to 'seller' if no role entry exists yet (new/unverified user)
      const role = (rolesData?.role as UserRole) || 'seller';

      return {
        role,
        isAdmin: role === 'admin',
        isDealer: role === 'dealer',
        isSeller: role === 'seller',
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      // Don't retry session-expired errors (show dialog instead)
      if (error?.message === 'SESSION_EXPIRED') return false;
      return failureCount < 2;
    },
  });

  // React Query v5: isLoading = isPending && isFetching.
  // When enabled=false (user is null), isPending=true but isFetching=false → isLoading=false.
  // This creates a race condition gap where user just resolved but query hasn't started yet,
  // causing SmartDashboard to see isLoading=false + primaryRole=undefined → wrong dashboard.
  // Fix: treat as loading whenever user exists but roleData hasn't been fetched yet.
  // IMPORTANT: Don't override isLoading when there's an error, otherwise SmartDashboard
  // gets stuck on loading forever because it checks roleLoading before error.
  const isLoading = queryLoading || (!!user && !roleData && !error);

  return {
    // Keep primaryRole as alias for backward compatibility
    primaryRole: roleData?.role ?? null,
    role: roleData?.role ?? null,
    isAdmin: roleData?.isAdmin ?? false,
    isDealer: roleData?.isDealer ?? false,
    isSeller: roleData?.isSeller ?? false,
    isLoading,
    error,
    getDashboardRoute: () => getDashboardRoute(roleData?.role || 'seller'),
    /**
     * Force refetch roles by invalidating the React Query cache.
     * This ensures all components using useUserRole() get updated data.
     */
    refetchRoles: () => {
      return queryClient.invalidateQueries({ queryKey: userRolesQueryKey(user?.id) });
    },
  };
};

export default useUserRole;
