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
  1: "Fahrzeugdetails",
  2: "Technik",
  3: "Abmessungen",
  4: "Innenraum",
  5: "Ausstattung",
  6: "Fotos",
  7: "Mängel",
  8: "Verkaufsweg",
  9: "Termin / Überprüfung",
  10: "Überprüfung / Anmeldung",
  11: "Anmeldung",
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

interface UseWizardSessionReturn {
  sessionId: string | null;
  saveProgress: (currentStep: number, formData: WizardFormData, totalSteps: number) => Promise<void>;
  markCompleted: () => Promise<void>;
  loadSession: () => Promise<{ formData: Record<string, unknown>; currentStep: number } | null>;
  isLoading: boolean;
}

export const useWizardSession = (): UseWizardSessionReturn => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const maxStepRef = useRef(1);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const anonymousId = getAnonymousId();

        // Check for existing in-progress session
        let existingSession = null;

        if (user) {
          const { data } = await supabase
            .from("wizard_sessions")
            .select("id, current_step, max_step_reached")
            .eq("user_id", user.id)
            .eq("status", "in_progress")
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();
          existingSession = data;
        }

        if (!existingSession) {
          // Also check by anonymous_id
          const { data } = await supabase
            .from("wizard_sessions")
            .select("id, current_step, max_step_reached")
            .eq("anonymous_id", anonymousId)
            .eq("status", "in_progress")
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();
          existingSession = data;
        }

        if (existingSession) {
          setSessionId(existingSession.id);
          maxStepRef.current = existingSession.max_step_reached || 1;

          // If user is now logged in, link the session
          if (user && existingSession) {
            await supabase
              .from("wizard_sessions")
              .update({ user_id: user.id })
              .eq("id", existingSession.id);
          }
        } else {
          // Create new session
          const { data: newSession, error } = await supabase
            .from("wizard_sessions")
            .insert({
              user_id: user?.id || null,
              anonymous_id: anonymousId,
              current_step: 1,
              max_step_reached: 1,
              status: "in_progress",
            })
            .select("id")
            .single();

          if (error) {
            logger.error("Failed to create wizard session:", error);
            return;
          }

          if (newSession) {
            setSessionId(newSession.id);
          }
        }
      } catch (error) {
        logger.error("Failed to initialize wizard session:", error);
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
   * Save wizard progress to DB (debounced)
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

          const { error } = await supabase
            .from("wizard_sessions")
            .update(updatePayload)
            .eq("id", sessionId);

          if (error) {
            logger.error("Failed to save wizard progress:", error);
          }
        } catch (error) {
          logger.error("Failed to save wizard progress:", error);
        }
      }, 1000); // 1 second debounce
    },
    [sessionId]
  );

  /**
   * Mark session as completed (called after successful submission)
   */
  const markCompleted = useCallback(async () => {
    if (!sessionId) return;

    try {
      await supabase
        .from("wizard_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch (error) {
      logger.error("Failed to mark wizard session as completed:", error);
    }
  }, [sessionId]);

  /**
   * Load existing session data for resume
   */
  const loadSession = useCallback(async (): Promise<{
    formData: Record<string, unknown>;
    currentStep: number;
  } | null> => {
    if (!sessionId) return null;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("wizard_sessions")
        .select("form_data, current_step, max_step_reached")
        .eq("id", sessionId)
        .single();

      if (error || !data) return null;

      return {
        formData: data.form_data as Record<string, unknown>,
        currentStep: data.current_step,
      };
    } catch (error) {
      logger.error("Failed to load wizard session:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  return {
    sessionId,
    saveProgress,
    markCompleted,
    loadSession,
    isLoading,
  };
};
