import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  try {
    // Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: isAdmin } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { 
      appointment_id, 
      payment_method,
      payment_amount,
      protocol_data 
    } = await req.json();

    // Input validation
    if (!appointment_id || typeof appointment_id !== 'string') {
      throw new Error('Valid appointment_id is required');
    }
    
    if (!payment_method || typeof payment_method !== 'string') {
      throw new Error('Valid payment_method is required');
    }
    
    if (!payment_amount || typeof payment_amount !== 'number' || payment_amount <= 0) {
      throw new Error('Valid positive payment_amount is required');
    }

    // Fetch appointment with related data
    const { data: appointment, error: fetchError } = await supabaseClient
      .from('appointments')
      .select('*, motorhomes(*), purchase_stations(*)')
      .eq('id', appointment_id)
      .single();

    if (fetchError) throw fetchError;

    // Generate handover protocol data (used for record keeping)
    const _protocol = {
      appointment_id,
      date: new Date().toISOString(),
      station: appointment.purchase_stations.name,
      motorhome: `${appointment.motorhomes.manufacturer} ${appointment.motorhomes.model}`,
      payment_method,
      payment_amount,
      seller_confirmation: true,
      ...protocol_data
    };

    // Generate PDF protocol
    let protocolUrl = null;
    try {
      const pdfResponse = await supabaseClient.functions.invoke('generate-handover-pdf', {
        body: { appointment_id }
      });

      if (!pdfResponse.error && pdfResponse.data?.protocol_url) {
        protocolUrl = pdfResponse.data.protocol_url;
      }
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      // Continue even if PDF generation fails
    }
    
    // Update appointment
    const { error: updateError } = await supabaseClient
      .from('appointments')
      .update({
        status: 'completed',
        payment_method,
        payment_amount,
        payment_status: 'completed',
        handover_protocol_url: protocolUrl,
      })
      .eq('id', appointment_id);

    if (updateError) throw updateError;

    // Update motorhome status
    const { error: motorhomeError } = await supabaseClient
      .from('motorhomes')
      .update({ 
        status: 'sold',
        sold_at: new Date().toISOString()
      })
      .eq('id', appointment.motorhome_id);

    if (motorhomeError) throw motorhomeError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Übergabe erfolgreich abgeschlossen',
        protocol_url: protocolUrl,
      }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
