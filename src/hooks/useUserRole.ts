/**
 * User Role Management Hook
 * Provides consistent role detection and management across components
 * 
 * IMPORTANT: This is the single source of truth for user role data.
 * All components that need role information MUST use this hook or usePermissions().
 * The canonical queryKey is ['userRoles', userId] — do NOT create separate role queries.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type UserRole = 'admin' | 'dealer' | 'seller';

/**
 * Canonical query key factory for user roles.
 * All role-related queries MUST use this key to ensure cache consistency.
 */
export const userRolesQueryKey = (userId: string | undefined) => ['userRoles', userId] as const;

export interface UserRoleData {
  primaryRole: UserRole;
  allRoles: UserRole[];
  isAdmin: boolean;
  isDealer: boolean;
  isSeller: boolean;
  hasMultipleRoles: boolean;
}

/**
 * Determine primary role based on hierarchy
 * Admin > Dealer > Seller
 */
function getPrimaryRole(roles: UserRole[]): UserRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('dealer')) return 'dealer';
  return 'seller';
}

/**
 * Get dashboard route based on primary role
 */
function getDashboardRoute(primaryRole: UserRole): string {
  switch (primaryRole) {
    case 'admin':
      return '/admin';
    case 'dealer':
      return '/dashboard'; // Will render dealer dashboard
    case 'seller':
      return '/dashboard'; // Will render user dashboard
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
          primaryRole: 'seller',
          allRoles: [],
          isAdmin: false,
          isDealer: false,
          isSeller: false,
          hasMultipleRoles: false,
        };
      }

      // Fetch all roles for the user
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesError) {
        logger.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }

      const roles = rolesData?.map(r => r.role as UserRole) || ['seller'];
      const primaryRole = getPrimaryRole(roles);

      return {
        primaryRole,
        allRoles: roles,
        isAdmin: roles.includes('admin'),
        isDealer: roles.includes('dealer'),
        isSeller: roles.includes('seller'),
        hasMultipleRoles: roles.length > 1,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true,
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
    primaryRole: roleData?.primaryRole ?? null,
    allRoles: roleData?.allRoles ?? [],
    isAdmin: roleData?.isAdmin ?? false,
    isDealer: roleData?.isDealer ?? false,
    isSeller: roleData?.isSeller ?? false,
    hasMultipleRoles: roleData?.hasMultipleRoles ?? false,
    isLoading,
    error,
    getDashboardRoute: () => getDashboardRoute(roleData?.primaryRole || 'seller'),
    /**
     * Force refetch roles by invalidating the React Query cache.
     * This ensures all components using useUserRole() get updated data.
     */
    refetchRoles: () => {
      return queryClient.invalidateQueries({ queryKey: userRolesQueryKey(user?.id) });
    },
  };
};

/**
 * Hook for checking specific permissions
 */
export const usePermissions = () => {
  const { primaryRole, allRoles, isAdmin, isDealer, isSeller } = useUserRole();

  const canAccessAdmin = isAdmin;
  const canAccessDealer = isDealer || isAdmin;
  const canAccessUser = isSeller || isDealer || isAdmin;

  const canManageAuctions = isAdmin;
  const canBidOnAuctions = isDealer || isAdmin;
  const canCreateListings = isSeller || isAdmin;
  const canManageFinancials = isAdmin;
  const canViewCommissions = isDealer || isAdmin;

  return {
    // Role checks
    primaryRole,
    allRoles,
    isAdmin,
    isDealer,
    isSeller,
    
    // Permission checks
    canAccessAdmin,
    canAccessDealer,
    canAccessUser,
    canManageAuctions,
    canBidOnAuctions,
    canCreateListings,
    canManageFinancials,
    canViewCommissions,
    
    // Utility functions
    hasPermission: (permission: string) => {
      switch (permission) {
        case 'admin':
          return isAdmin;
        case 'dealer':
          return isDealer || isAdmin;
        case 'seller':
          return isSeller || isDealer || isAdmin;
        default:
          return false;
      }
    },
    
    hasAnyRole: (requiredRoles: UserRole[]) => {
      return requiredRoles.some(role => allRoles?.includes(role));
    },
  };
};

export default useUserRole;
