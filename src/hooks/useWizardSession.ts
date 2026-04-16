import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { getStoredClickIds } from "@/lib/clickIdService";
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
  sessionParam: string | null;
} {
  if (typeof window === "undefined") {
    return { customerName: null, customerEmail: null, customerPhone: null, sessionParam: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    customerName: params.get("customerName") || null,
    customerEmail: params.get("customerEmail") || null,
    customerPhone: params.get("customerPhone") || null,
    sessionParam: params.get("session") || null,
  };
}

interface UseWizardSessionReturn {
  sessionId: string | null;
  anonymousId: string;
  /** The step the session was on when loaded (null if new session). Let the caller restore to this step. */
  initialStep: number | null;
  isReady: boolean;
  saveProgress: (
    currentStep: number,
    formData: WizardFormData,
    totalSteps: number,
    options?: { immediate?: boolean }
  ) => Promise<void>;
  markCompleted: () => Promise<void>;
  updateContactFromAuth: (authData: { email?: string; firstName?: string; lastName?: string; phone?: string }) => Promise<void>;
}

export const useWizardSession = (): UseWizardSessionReturn => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialStep, setInitialStep] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [anonymousId, setAnonymousId] = useState<string>(() => getAnonymousId());

  const maxStepRef = useRef(1);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);
  const lastSavedDataRef = useRef<string>("");

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const anon = getAnonymousId();
        setAnonymousId(anon);
        const urlContact = getContactFromUrl();

        // Check for existing in-progress session
        let existingSession: {
          id: string;
          current_step?: number | null;
          max_step_reached?: number | null;
          customer_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
        } | null = null;

        // 1. Highest priority: session ID from URL (cross-device resume link)
        //    We fetch via the SECURITY DEFINER find RPC so it works for anon users too.
        if (urlContact.sessionParam) {
          try {
            const { data } = await supabase
              .rpc("find_wizard_session_by_anonymous_id", { p_anonymous_id: anon });
            const fromAnon = Array.isArray(data) && data.length > 0 ? data[0] : (data && !Array.isArray(data) ? data : null);
            // Only accept the URL session if it matches our anon or our auth user;
            // else fall through to normal flow. This prevents a stolen link from
            // leaking another user's data onto this device.
            if (user) {
              const { data: byId } = await supabase
                .from("wizard_sessions")
                .select("id, current_step, max_step_reached, customer_name, customer_email, customer_phone, user_id")
                .eq("id", urlContact.sessionParam)
                .maybeSingle();
              if (byId && byId.user_id === user.id) {
                existingSession = byId;
              }
            } else if (fromAnon && fromAnon.id === urlContact.sessionParam) {
              existingSession = fromAnon;
            }
          } catch (_e) {
            // non-critical; fall through
          }
        }

        // 2. Authenticated user: own sessions via RLS
        if (!existingSession && user) {
          const sessionValid = await ensureValidRLSSession();
          if (sessionValid) {
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
        }

        // 3. Anonymous: secure RPC by anonymous_id
        if (!existingSession) {
          const { data } = await supabase
            .rpc("find_wizard_session_by_anonymous_id", { p_anonymous_id: anon });

          if (data && Array.isArray(data) && data.length > 0) {
            existingSession = data[0];
          } else if (data && !Array.isArray(data)) {
            existingSession = data;
          }
        }

        if (existingSession) {
          setSessionId(existingSession.id);
          maxStepRef.current = existingSession.max_step_reached || 1;
          // Restore position if the user had progressed beyond step 1.
          const restoreTo = existingSession.current_step && existingSession.current_step > 1
            ? existingSession.current_step
            : null;
          setInitialStep(restoreTo);

          // Update session with contact data from URL if not already set
          const updatePayload: Record<string, unknown> = {};

          if (user) {
            updatePayload.user_id = user.id;
          }

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
              const updateSessionValid = await ensureValidRLSSession();
              if (updateSessionValid) {
                await supabase
                  .from("wizard_sessions")
                  .update(updatePayload)
                  .eq("id", existingSession.id);
              }
            } else {
              await supabase.rpc("update_wizard_session_by_anonymous_id", {
                p_anonymous_id: anon,
                p_session_id: existingSession.id,
                p_updates: updatePayload,
              });
            }
          }
        } else {
          // Create new session via SECURITY DEFINER RPC.
          const { data: newSessionId, error } = await supabase
            .rpc("create_wizard_session", {
              p_anonymous_id: anon,
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
   * Save wizard progress to DB (debounced by default).
   * When options.immediate is true the pending save is flushed synchronously,
   * bypassing the 1s debounce (used by beforeunload).
   */
  const saveProgress = useCallback(
    async (
      currentStep: number,
      formData: WizardFormData,
      totalSteps: number,
      options?: { immediate?: boolean }
    ) => {
      if (!sessionId) return;

      if (currentStep > maxStepRef.current) {
        maxStepRef.current = currentStep;
      }

      // Cancel any pending debounced save; we'll either reschedule or run now.
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      const runSave = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const serializedData = serializeFormData(formData);

          // Fingerprint covers the entire serialized form_data + step.
          // Previously we only tracked a tiny subset which let dimension,
          // equipment and price changes slip through unsaved.
          const fingerprint = JSON.stringify({
            step: currentStep,
            max: maxStepRef.current,
            data: serializedData,
          });

          if (fingerprint === lastSavedDataRef.current) {
            return;
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

          const clickIds = getStoredClickIds();
          if (clickIds.gclid) updatePayload.gclid = clickIds.gclid;
          if (clickIds.gbraid) updatePayload.gbraid = clickIds.gbraid;
          if (clickIds.wbraid) updatePayload.wbraid = clickIds.wbraid;

          if (user) {
            updatePayload.user_id = user.id;
            if (!formData.customerEmail && user.email) {
              updatePayload.customer_email = user.email;
            }
          }

          if (user) {
            const saveSessionValid = await ensureValidRLSSession();
            if (!saveSessionValid) return;
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
            const anon = getAnonymousId();
            const { error } = await supabase.rpc("update_wizard_session_by_anonymous_id", {
              p_anonymous_id: anon,
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
        } finally {
          pendingSaveRef.current = null;
        }
      };

      pendingSaveRef.current = runSave;

      if (options?.immediate) {
        await runSave();
        return;
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (pendingSaveRef.current) {
          pendingSaveRef.current();
        }
      }, 1000);
    },
    [sessionId]
  );

  const updateContactFromAuth = useCallback(
    async (authData: { email?: string; firstName?: string; lastName?: string; phone?: string }) => {
      if (!sessionId) return;

      try {
        const updatePayload: Record<string, unknown> = {};

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

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          updatePayload.user_id = user.id;
          if (!updatePayload.customer_email && user.email) {
            updatePayload.customer_email = user.email;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          if (user) {
            const contactSessionValid = await ensureValidRLSSession();
            if (!contactSessionValid) return;
            const { error } = await supabase
              .from("wizard_sessions")
              .update(updatePayload)
              .eq("id", sessionId);

            if (error) {
              logger.error("Failed to update wizard session contact from auth:", error);
            }
          } else {
            const anon = getAnonymousId();
            const { error } = await supabase.rpc("update_wizard_session_by_anonymous_id", {
              p_anonymous_id: anon,
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

  const markCompleted = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const completeSessionValid = await ensureValidRLSSession();
        if (completeSessionValid) {
          await supabase
            .from("wizard_sessions")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", sessionId);
        }
      } else {
        const anon = getAnonymousId();
        await supabase.rpc("update_wizard_session_by_anonymous_id", {
          p_anonymous_id: anon,
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
    anonymousId,
    initialStep,
    isReady,
    saveProgress,
    markCompleted,
    updateContactFromAuth,
  };
};
