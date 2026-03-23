/**
 * Hook to check if the current user has a pending or rejected dealer application.
 *
 * Used by SmartDashboard, DealerDashboard, DealerSidebar, and other components
 * to show the dealer UI in a "locked" / read-only state while the application
 * is being reviewed.
 *
 * The query is only enabled when the user's role is 'seller' (pending dealers
 * start as sellers and get promoted to 'dealer' after admin approval).
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

export interface DealerApplication {
  id: string;
  status: string;
  company_name: string;
  company_address?: string;
  company_city?: string;
  company_postal_code?: string;
  contact_person_name?: string;
  phone?: string;
  submitted_at?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  legal_form?: string;
}

export function useDealerPending() {
  const { user } = useAuth();
  const { primaryRole, isLoading: roleLoading } = useUserRole();

  const { data: application, isLoading: appLoading, refetch } = useQuery({
    queryKey: ['dealerApplicationStatus', user?.id],
    queryFn: async (): Promise<DealerApplication | null> => {
      if (!user) return null;
      const { data } = await supabase
        .from('dealer_applications')
        .select('id, status, company_name, company_address, company_city, company_postal_code, contact_person_name, phone, submitted_at, reviewed_at, rejection_reason, legal_form')
        .eq('user_id', user.id)
        .in('status', ['pending', 'rejected'])
        .maybeSingle();
      return data as DealerApplication | null;
    },
    enabled: !!user && primaryRole === 'seller' && !roleLoading,
    staleTime: 2 * 60 * 1000,
  });

  const isPendingDealer = !!application && application.status === 'pending';
  const isRejectedDealer = !!application && application.status === 'rejected';
  const hasDealerApplication = !!application;

  return {
    /** The dealer application record (pending or rejected) */
    application,
    /** True while the query is still loading */
    isLoading: appLoading || roleLoading,
    /** True if user has a pending dealer application */
    isPendingDealer,
    /** True if user has a rejected dealer application */
    isRejectedDealer,
    /** True if user has any non-approved dealer application */
    hasDealerApplication,
    /** Refetch the application status */
    refetch,
  };
}
