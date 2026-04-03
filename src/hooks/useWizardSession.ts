import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { WizardFormData } from "./useWizardForm";

const ANONYMOUS_ID_KEY = "caravanwert_anonymous_id";

/**
 * Generates or retrieves a persistent anonymous ID for tracking
 * wizard sessions before the user is logged in.
 */
function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(ANONYMOUS_ID_KEY, id);
  }
  return id;
}

/**
 * Step names for display in admin panel
 */
const STEP_NAMES: Record<number, string> = {
  1: "Fahrzeugtyp",
  2: "Fahrzeugdaten",
  3: "Details & Technik",
  4: "Ausstattung",
  5: "Kontakt",
  6: "Fotos",
  7: "Verkaufsweg",
  8: "Standort & Konto",
};

/**
 * Builds a short vehicle summary string for admin quick view
 */
function buildVehicleSummary(formData: WizardFormData): string {
  const parts: string[] = [];
  if (formData.manufacturer) parts.push(formData.manufacturer);
  if (formData.model) parts.push(formData.model);
  if (formData.year) parts.push(`(${formData.year})`);
  if (formData.bodyType) parts.push(`- ${formData.bodyType}`);
  if (formData.mileage) parts.push(`- ${formData.mileage.toLocaleString()} km`);
  return parts.join(" ") || "Noch keine Fahrzeugdaten";
}

/**
 * Serializes form data for DB storage (removes File objects)
 */
function serializeFormData(formData: WizardFormData): Record<string, unknown> {
  const serialized = { ...formData } as Record<string, unknown>;
  // Photos are File objects and can't be serialized to JSON
  // Store only the count
  serialized.photos_count = (formData.photos || []).length;
  delete serialized.photos;
  return serialized;
}

/**
 * Extracts contact data from URL search params (set by QuickAuctionForm)
 */
function getContactFromUrl(): {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
} {
  if (typeof window === "undefined") {
    return { customerName: null, customerEmail: null, customerPhone: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    customerName: params.get("customerName") || null,
    customerEmail: params.get("customerEmail") || null,
    customerPhone: params.get("customerPhone") || null,
  };
}

interface UseWizardSessionReturn {
  sessionId: string | null;
  isReady: boolean;
  saveProgress: (currentStep: number, formData: WizardFormData, totalSteps: number) => Promise<void>;
  markCompleted: () => Promise<void>;
  updateContactFromAuth: (authData: { email?: string; firstName?: string; lastName?: string; phone?: string }) => Promise<void>;
}

export const useWizardSession = (): UseWizardSessionReturn => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const maxStepRef = useRef(1);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string>("");

  // Initialize session on mount - immediately capture contact data from URL
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const anonymousId = getAnonymousId();
        const urlContact = getContactFromUrl();

        // Check for existing in-progress session
        let existingSession = null;

        if (user) {
          // Authenticated users can query directly via RLS (user_id = auth.uid())
          const { data } = await supabase
            .from("wizard_sessions")
            .select("id, current_step, max_step_reached, customer_name, customer_email, customer_phone")
            .eq("user_id", user.id)
            .eq("status", "in_progress")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          existingSession = data;
        }

        if (!existingSession) {
          // Anonymous users: Use secure RPC function instead of direct table access
          // This bypasses RLS safely and only returns the session matching this anonymous_id
          const { data } = await supabase
            .rpc("find_wizard_session_by_anonymous_id", { p_anonymous_id: anonymousId });
          
          if (data && Array.isArray(data) && data.length > 0) {
            existingSession = data[0];
          } else if (data && !Array.isArray(data)) {
            existingSession = data;
          }
        }

        if (existingSession) {
          setSessionId(existingSession.id);
          maxStepRef.current = existingSession.max_step_reached || 1;

          // Update session with contact data from URL if not already set
          const updatePayload: Record<string, unknown> = {};
          
          if (user) {
            updatePayload.user_id = user.id;
          }
          
          // Fill in contact data from URL params if session doesn't have them yet
          if (!existingSession.customer_name && urlContact.customerName) {
            updatePayload.customer_name = urlContact.customerName;
          }
          if (!existingSession.customer_email && urlContact.customerEmail) {
            updatePayload.customer_email = urlContact.customerEmail;
          }
          if (!existingSession.customer_phone && urlContact.customerPhone) {
            updatePayload.customer_phone = urlContact.customerPhone;
          }

          if (Object.keys(updatePayload).length > 0) {
            if (user) {
              // Authenticated users update directly
              await supabase
                .from("wizard_sessions")
                .update(updatePayload)
                .eq("id", existingSession.id);
            } else {
              // Anonymous users update via secure RPC
              await supabase.rpc("update_wizard_session_by_anonymous_id", {
                p_anonymous_id: anonymousId,
                p_session_id: existingSession.id,
                p_updates: updatePayload,
              });
            }
          }
        } else {
          // Create new session via SECURITY DEFINER RPC function
          // This bypasses RLS so anonymous users can create sessions and get the ID back
          const { data: newSessionId, error } = await supabase
            .rpc("create_wizard_session", {
              p_anonymous_id: anonymousId,
              p_user_id: user?.id || null,
              p_customer_name: urlContact.customerName || null,
              p_customer_email: urlContact.customerEmail || null,
              p_customer_phone: urlContact.customerPhone || null,
              p_total_steps: 8,
            });

          if (error) {
            logger.error("Failed to create wizard session:", error);
            setIsReady(true);
            return;
          }

          if (newSessionId) {
            setSessionId(newSessionId);
          }
        }
      } catch (error) {
        logger.error("Failed to initialize wizard session:", error);
      } finally {
        setIsReady(true);
      }
    };

    initSession();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Save wizard progress to DB (debounced).
   * Skips save if data hasn't changed to avoid unnecessary writes.
   */
  const saveProgress = useCallback(
    async (currentStep: number, formData: WizardFormData, totalSteps: number) => {
      if (!sessionId) return;

      // Track max step reached
      if (currentStep > maxStepRef.current) {
        maxStepRef.current = currentStep;
      }

      // Debounce saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const serializedData = serializeFormData(formData);

          // Build a fingerprint to skip duplicate saves
          const fingerprint = JSON.stringify({
            step: currentStep,
            name: formData.customerName,
            email: formData.customerEmail,
            phone: formData.customerPhone,
            manufacturer: formData.manufacturer,
            model: formData.model,
            photos_count: (formData.photos || []).length,
          });

          if (fingerprint === lastSavedDataRef.current) {
            return; // No meaningful change, skip save
          }

          const updatePayload: Record<string, unknown> = {
            current_step: currentStep,
            max_step_reached: maxStepRef.current,
            total_steps: totalSteps,
            step_name: STEP_NAMES[currentStep] || `Schritt ${currentStep}`,
            form_data: serializedData,
            vehicle_summary: buildVehicleSummary(formData),
            customer_name: formData.customerName || null,
            customer_email: formData.customerEmail || null,
            customer_phone: formData.customerPhone || null,
          };

          // Link user if now logged in
          if (user) {
            updatePayload.user_id = user.id;
            // Try to get email from auth if not in form
            if (!formData.customerEmail && user.email) {
              updatePayload.customer_email = user.email;
            }
          }

          if (user) {
            // Authenticated users update directly via RLS
            const { error } = await supabase
              .from("wizard_sessions")
              .update(updatePayload)
              .eq("id", sessionId);

            if (error) {
              logger.error("Failed to save wizard progress:", error);
            } else {
              lastSavedDataRef.current = fingerprint;
            }
          } else {
            // Anonymous users update via secure RPC
            const anonymousId = getAnonymousId();
            const { error } = await supabase.rpc("update_wizard_session_by_anonymous_id", {
              p_anonymous_id: anonymousId,
              p_session_id: sessionId,
              p_updates: updatePayload,
            });

            if (error) {
              logger.error("Failed to save wizard progress:", error);
            } else {
              lastSavedDataRef.current = fingerprint;
            }
          }
        } catch (error) {
          logger.error("Failed to save wizard progress:", error);
        }
      }, 1000); // 1 second debounce
    },
    [sessionId]
  );

  /**
   * Update wizard session with contact data from authenticated user.
   * Called after login/register in AuthenticationStep to ensure
   * contact data is persisted even when URL params were missing.
   */
  const updateContactFromAuth = useCallback(
    async (authData: { email?: string; firstName?: string; lastName?: string; phone?: string }) => {
      if (!sessionId) return;

      try {
        const updatePayload: Record<string, unknown> = {};

        // Build full name from first + last
        const fullName = [authData.firstName, authData.lastName].filter(Boolean).join(' ');
        if (fullName) {
          updatePayload.customer_name = fullName;
        }
        if (authData.email) {
          updatePayload.customer_email = authData.email;
        }
        if (authData.phone) {
          updatePayload.customer_phone = authData.phone;
        }

        // Also link user_id if now logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          updatePayload.user_id = user.id;
          // Fallback: use auth email if not provided
          if (!updatePayload.customer_email && user.email) {
            updatePayload.customer_email = user.email;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          if (user) {
            // Authenticated user: direct update via RLS
            const { error } = await supabase
              .from("wizard_sessions")
              .update(updatePayload)
              .eq("id", sessionId);

            if (error) {
              logger.error("Failed to update wizard session contact from auth:", error);
            }
          } else {
            // Anonymous user: update via secure RPC
            const anonymousId = getAnonymousId();
            const { error } = await supabase.rpc("update_wizard_session_by_anonymous_id", {
              p_anonymous_id: anonymousId,
              p_session_id: sessionId,
              p_updates: updatePayload,
            });

            if (error) {
              logger.error("Failed to update wizard session contact from auth:", error);
            }
          }
        }
      } catch (error) {
        logger.error("Failed to update wizard session contact from auth:", error);
      }
    },
    [sessionId]
  );

  /**
   * Mark session as completed (called after successful submission)
   */
  const markCompleted = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("wizard_sessions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      } else {
        const anonymousId = getAnonymousId();
        await supabase.rpc("update_wizard_session_by_anonymous_id", {
          p_anonymous_id: anonymousId,
          p_session_id: sessionId,
          p_updates: {
            status: "completed",
            completed_at: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      logger.error("Failed to mark wizard session as completed:", error);
    }
  }, [sessionId]);



  return {
    sessionId,
    isReady,
    saveProgress,
    markCompleted,
    updateContactFromAuth,

  };
};
