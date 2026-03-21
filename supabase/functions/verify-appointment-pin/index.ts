import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 60;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  try {
    const { appointment_id, pin } = await req.json();

    // Input validation
    if (!appointment_id || typeof appointment_id !== 'string') {
      throw new Error('Valid appointment_id is required');
    }
    
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      throw new Error('Valid 6-digit PIN is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check for rate limiting
    const { data: attemptRecord, error: _attemptError } = await supabaseClient
      .from('pin_attempts')
      .select('*')
      .eq('appointment_id', appointment_id)
      .single();

    const now = new Date();
    
    // Check if locked
    if (attemptRecord?.locked_until) {
      const lockedUntil = new Date(attemptRecord.locked_until);
      if (now < lockedUntil) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'PIN ist gesperrt. Bitte kontaktieren Sie den Support.',
            locked_until: lockedUntil.toISOString()
          }),
          {
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            status: 429,
          }
        );
      }
    }

    // Check attempt count
    if (attemptRecord && attemptRecord.attempt_count >= MAX_ATTEMPTS) {
      // Lock the PIN
      const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60000);
      await supabaseClient
        .from('pin_attempts')
        .update({ locked_until: lockedUntil.toISOString() })
        .eq('appointment_id', appointment_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Zu viele fehlgeschlagene Versuche. PIN gesperrt für ${LOCKOUT_DURATION_MINUTES} Minuten.`
        }),
        {
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    // Fetch appointment
    const { data: appointment, error: fetchError } = await supabaseClient
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .single();

    if (fetchError) throw fetchError;

    // Verify PIN
    if (appointment.release_pin !== pin) {
      // Increment failed attempt counter
      if (attemptRecord) {
        await supabaseClient
          .from('pin_attempts')
          .update({ 
            attempt_count: attemptRecord.attempt_count + 1,
            last_attempt_at: now.toISOString()
          })
          .eq('appointment_id', appointment_id);
      } else {
        await supabaseClient
          .from('pin_attempts')
          .insert({ 
            appointment_id,
            attempt_count: 1,
            last_attempt_at: now.toISOString()
          });
      }

      const remainingAttempts = MAX_ATTEMPTS - (attemptRecord?.attempt_count || 0) - 1;
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Ungültige PIN. ${remainingAttempts} Versuche verbleibend.`,
          remaining_attempts: remainingAttempts
        }),
        {
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Check PIN expiration (24 hours)
    const pinGeneratedAt = new Date(appointment.pin_generated_at);
    const hoursDiff = (now.getTime() - pinGeneratedAt.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'PIN ist abgelaufen' 
        }),
        {
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Clear failed attempts on successful verification
    if (attemptRecord) {
      await supabaseClient
        .from('pin_attempts')
        .delete()
        .eq('appointment_id', appointment_id);
    }

    // Update appointment status
    const { error: updateError } = await supabaseClient
      .from('appointments')
      .update({ status: 'verified' })
      .eq('id', appointment_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PIN erfolgreich verifiziert',
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
