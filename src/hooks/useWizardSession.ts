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
  7: "Verkaufsweg & Telefon",
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
 * Extracts contact data from URL search params (set by QuickAuctionForm) and
 * any cross-device-resume parameters from recovery emails.
 *
 * `tokenParam` is the canonical, unguessable resume_token (256 bit) used by
 * the recovery email flow. `sessionParam` is the older `?session=<uuid>`
 * fallback for emails that were sent before the resume_token migration
 * (2026-04-21). New emails ALWAYS use the token path.
 */
function getContactFromUrl(): {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  sessionParam: string | null;
  tokenParam: string | null;
} {
  if (typeof window === "undefined") {
    return {
      customerName: null,
      customerEmail: null,
      customerPhone: null,
      sessionParam: null,
      tokenParam: null,
    };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    customerName: params.get("customerName") || null,
    customerEmail: params.get("customerEmail") || null,
    customerPhone: params.get("customerPhone") || null,
    sessionParam: params.get("session") || null,
    tokenParam: params.get("token") || null,
  };
}

/**
 * Returns the highest wizard step that the current `formData` validly
 * supports. Mirrors the step-guard in VerkaufenWizard.tsx.
 *
 * Used in `saveProgress` to prevent `max_step_reached` being inflated by
 * URL-driven step jumps before the user actually has the corresponding
 * data — the bug that produced the "Geister-Sessions" mit max_step=7,
 * customer_*=NULL, vehicle_summary='Noch keine Fahrzeugdaten' im Admin-
 * Lead-Funnel (siehe Migration 20260421140000_wizard_resume_token.sql).
 */
function effectiveMaxStep(currentStep: number, formData: WizardFormData): number {
  if (!formData.bodyType) return 1;
  if (!formData.manufacturer || !formData.model || !formData.year) {
    return Math.min(currentStep, 2);
  }
  if (!formData.customerName || !formData.customerEmail) {
    return Math.min(currentStep, 5);
  }
  if (!formData.saleChannel) {
    return Math.min(currentStep, 7);
  }
  return currentStep;
}

interface UseWizardSessionReturn {
  sessionId: string | null;
  anonymousId: string;
  /** The step the session was on when loaded (null if new session). Let the caller restore to this step. */
  initialStep: number | null;
  /**
   * Form data persisted from a previous wizard run (null if new session or
   * if the row had no form_data). The caller should merge this into the
   * `useWizardForm` state BEFORE the step-guard runs, otherwise the user
   * gets bounced back to step 2 with an empty form on resume.
   */
  restoredFormData: Partial<WizardFormData> | null;
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
  const [restoredFormData, setRestoredFormData] = useState<Partial<WizardFormData> | null>(null);
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
        let anon = getAnonymousId();
        setAnonymousId(anon);
        const urlContact = getContactFromUrl();

        // Check for existing in-progress session
        let existingSession: {
          id: string;
          anonymous_id?: string | null;
          current_step?: number | null;
          max_step_reached?: number | null;
          customer_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          form_data?: Record<string, unknown> | null;
        } | null = null;

        // 1. HIGHEST priority: resume_token from URL (cross-device resume).
        //    Recovery-Emails (send-wizard-resume-email + process-abandoned-
        //    wizards) verlinken seit 2026-04-21 mit ?token=<resume_token>.
        //    Der Token ist unguessable (256 bit Entropie) und identifiziert
        //    die Session unabhaengig von Geraet/Browser/localStorage.
        //
        //    Wenn der Token matcht, ADOPTIEREN wir die anonymous_id der
        //    geladenen Session in unseren localStorage. Damit funktionieren
        //    alle nachfolgenden update_wizard_session_by_anonymous_id-Calls
        //    ohne weitere Sonderbehandlung -- der User uebernimmt einfach
        //    die Identitaet der Original-Session auf diesem Geraet.
        if (urlContact.tokenParam) {
          try {
            const { data } = await supabase
              .rpc("find_wizard_session_by_resume_token", { p_resume_token: urlContact.tokenParam });
            const sessionRow = Array.isArray(data) && data.length > 0 ? data[0] : (data && !Array.isArray(data) ? data : null);
            if (sessionRow) {
              existingSession = sessionRow;
              // anonymous_id der Original-Session adoptieren — alle weiteren
              // Updates laufen ueber update_wizard_session_by_anonymous_id
              // und brauchen denselben Wert wie in der DB-Row.
              if (sessionRow.anonymous_id && sessionRow.anonymous_id !== anon) {
                localStorage.setItem(ANONYMOUS_ID_KEY, sessionRow.anonymous_id);
                anon = sessionRow.anonymous_id;
                setAnonymousId(anon);
              }
              // Falls Status `abandoned` war (>2h Inaktivitaet, Recovery-Mail
              // bereits raus), reaktivieren — der User ist offensichtlich
              // wieder zurueck.
              await supabase.rpc("reactivate_wizard_session_by_resume_token", {
                p_resume_token: urlContact.tokenParam,
              });
            }
          } catch (e) {
            logger.warn("Resume-Token-Lookup fehlgeschlagen, Fallback auf Standard-Flow:", e);
          }
        }

        // 2. Legacy fallback: ?session=<uuid> from old recovery emails sent
        //    before the resume_token migration. Only honored when it matches
        //    the device's anonymous_id (or the auth user) — sonst koennte
        //    ein gestohlener Link Daten leaken.
        if (!existingSession && urlContact.sessionParam) {
          try {
            const { data } = await supabase
              .rpc("find_wizard_session_by_anonymous_id", { p_anonymous_id: anon });
            const fromAnon = Array.isArray(data) && data.length > 0 ? data[0] : (data && !Array.isArray(data) ? data : null);
            if (user) {
              const { data: byId } = await supabase
                .from("wizard_sessions")
                .select("id, anonymous_id, current_step, max_step_reached, customer_name, customer_email, customer_phone, form_data, user_id")
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
              .select("id, current_step, max_step_reached, customer_name, customer_email, customer_phone, form_data")
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

          // Restore form_data so we don't bounce the user back to step 2 with
          // empty fields. Photos are File objects and can't be serialized to
          // JSON; the count is kept under photos_count for admin display.
          // We strip both before merging into the form so the photo state stays
          // an empty File[] (re-uploads happen client-side anyway).
          if (existingSession.form_data && typeof existingSession.form_data === "object") {
            const formDataCopy = { ...(existingSession.form_data as Record<string, unknown>) };
            delete formDataCopy.photos;
            delete formDataCopy.photos_count;

            // Defense-in-depth: nur Felder mit echtem Inhalt durchreichen.
            // Andernfalls würde ein naiver Konsument (`updateFormData(restored)`)
            // User-Eingaben mit "" überschreiben, sobald der Server-Restore
            // nach dem ersten Klick eintrudelt — siehe Bug-Report 2026-04-21
            // („Bitte wählen Sie eine Aufbauart" trotz Auswahl). `useWizardForm`
            // hat zusätzlich `hydrateFormData` als zweite Verteidigungslinie.
            const usefulFields: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(formDataCopy)) {
              if (value === null || value === undefined || value === "") continue;
              if (Array.isArray(value) && value.length === 0) continue;
              usefulFields[key] = value;
            }

            if (Object.keys(usefulFields).length > 0) {
              setRestoredFormData(usefulFields as Partial<WizardFormData>);
            }
          }

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

      // max_step_reached darf nur dann auf `currentStep` wachsen, wenn die
      // Daten dort auch wirklich vorhanden sind. Sonst entstehen die alten
      // Geister-Sessions mit max=7 + customer_*=NULL (siehe Migration
      // 20260421140000). `effectiveMaxStep` spiegelt die Step-Guard-Logik
      // aus VerkaufenWizard.tsx und schneidet currentStep auf das ab, was
      // formData tatsaechlich stuetzt.
      const effective = effectiveMaxStep(currentStep, formData);
      if (effective > maxStepRef.current) {
        maxStepRef.current = effective;
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

          // P3 Tracking-Fix (2026-04-21): step_name wird jetzt anhand von
          // `max_step_reached` gesetzt — nicht mehr `current_step`. Vorher
          // hat ein User, der zur\u00fcck zu Step 1 navigiert ist, im Admin-
          // Funnel als "Fahrzeugtyp"-Drop-off gez\u00e4hlt, obwohl er real
          // bereits bei Step 7 war. Funnel-Analyse braucht den weitest
          // erreichten Step, nicht die gerade angezeigte Position.
          const trackedStep = Math.max(maxStepRef.current, currentStep);
          const updatePayload: Record<string, unknown> = {
            current_step: currentStep,
            max_step_reached: maxStepRef.current,
            total_steps: totalSteps,
            step_name: STEP_NAMES[trackedStep] || `Schritt ${trackedStep}`,
            form_data: serializedData,
            vehicle_summary: buildVehicleSummary(formData),
          };

          // WICHTIG: customer_* nur dann ins Payload, wenn ein nicht-leerer
          // Wert vorliegt. Sonst wuerde der direkte Supabase-Update-Pfad
          // (auth'd user) bestehende Werte mit NULL ueberschreiben — der
          // Anon-RPC ist via COALESCE geschuetzt, der RLS-Pfad nicht. Genau
          // diese Race produzierte die Geister-Sessions, in denen Resume-
          // Mails fuer eine Adresse rausgingen, bei der die DB-Row schon
          // wieder customer_email=NULL war.
          if (formData.customerName)  updatePayload.customer_name  = formData.customerName;
          if (formData.customerEmail) updatePayload.customer_email = formData.customerEmail;
          if (formData.customerPhone) updatePayload.customer_phone = formData.customerPhone;

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
    restoredFormData,
    isReady,
    saveProgress,
    markCompleted,
    updateContactFromAuth,
  };
};
