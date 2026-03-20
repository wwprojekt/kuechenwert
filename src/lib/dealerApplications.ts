/**
 * Dealer Applications Library
 * Direct database queries for dealer application management
 */

import { supabase } from '@/integrations/supabase/client';

export interface DealerApplicationData {
  id: string;
  user_id: string;
  company_name: string;
  company_address: string;
  company_postal_code: string;
  company_city: string;
  tax_id: string;
  trade_license_number: string;
  contact_person_name: string;
  contact_person_position?: string;
  phone: string;
  website?: string;
  business_description?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
}

/**
 * Fetch all dealer applications (admin only)
 */
export async function fetchDealerApplications(): Promise<DealerApplicationData[]> {
  // Check current user and admin status
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Not authenticated');
    }
    
    // Verify admin role
    const { data: roleCheck, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');
    
    if (roleError) {
      throw new Error(`Role check failed: ${roleError.message}`);
    }
    
    if (!roleCheck || roleCheck.length === 0) {
      throw new Error('Access denied: Admin role required');
    }
    
    // Fetch dealer applications and profiles separately, then join in code
    const { data: applicationsData, error: applicationsError } = await supabase
      .from('dealer_applications')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (applicationsError) {
      throw new Error(`Applications fetch error: ${applicationsError.message}`);
    }

    if (!applicationsData || applicationsData.length === 0) {
      return [];
    }

    // Get user IDs from applications
    const userIds = applicationsData.map(app => app.user_id);

    // Fetch corresponding profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', userIds);

    if (profilesError) {
      // Continue without profile data if profiles can't be fetched
    }

    // Join the data manually
    const data = applicationsData.map(application => ({
      ...application,
      profiles: profilesData?.find(profile => profile.id === application.user_id) || null
    }));
    
    return data;
}

/**
 * Approve dealer application
 */
export async function approveDealerApplication(applicationId: string): Promise<void> {
  // Get application details first
    const { data: application, error: fetchError } = await supabase
      .from('dealer_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError) {
      throw new Error(`Application fetch error: ${fetchError.message}`);
    }

    if (!application) {
      throw new Error('Application not found');
    }

    // Get profile data separately
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', application.user_id)
      .single();

    if (profileError) {
      throw new Error(`Profile fetch error: ${profileError.message}`);
    }

    // Use the database function for proper role assignment
    const { error: approvalError } = await supabase
      .rpc('approve_dealer_application', {
        application_id_param: applicationId
      });

    if (approvalError) throw approvalError;

  // Send approval email
  if (profile?.email) {
    await supabase.functions.invoke('send-dealer-notification', {
      body: {
        email: profile.email,
        name: `${profile.first_name} ${profile.last_name}`,
        type: 'approved',
        companyName: application.company_name,
      },
    });
  }
}

/**
 * Reject dealer application
 */
export async function rejectDealerApplication(applicationId: string, reason: string): Promise<void> {
  // Get application details first
    const { data: application, error: fetchError } = await supabase
      .from('dealer_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError) {
      throw new Error(`Application fetch error: ${fetchError.message}`);
    }

    if (!application) {
      throw new Error('Application not found');
    }

    // Get profile data separately
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', application.user_id)
      .single();

    if (profileError) {
      throw new Error(`Profile fetch error: ${profileError.message}`);
    }

    // Update application status
    const { error: updateError } = await supabase
      .from('dealer_applications')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateError) throw updateError;

  // Send rejection email
  if (profile?.email) {
    await supabase.functions.invoke('send-dealer-notification', {
      body: {
        email: profile.email,
        name: `${profile.first_name} ${profile.last_name}`,
        type: 'rejected',
        companyName: application.company_name,
        rejectionReason: reason,
      },
    });
  }
}
