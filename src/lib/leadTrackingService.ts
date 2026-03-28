/**
 * Lead Tracking Service
 * Erfasst Leads sofort bei Kontaktdaten-Eingabe und trackt den Wizard-Fortschritt.
 * Jeder Lead wird unabhängig davon gespeichert, ob der Nutzer den Wizard abschließt.
 * 
 * WICHTIG: Verwendet sowohl localStorage als auch eine In-Memory-Variable,
 * um Race Conditions bei schnellen aufeinanderfolgenden Aufrufen zu vermeiden.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const LEAD_ID_KEY = "caravanwert_lead_id";

// In-Memory Cache der Lead-ID um Race Conditions zu vermeiden
let cachedLeadId: string | null = null;

// Mutex um parallele Inserts zu verhindern
let pendingInsert: Promise<string | null> | null = null;

export interface LeadData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  bodyType?: string | null;
  saleChannel?: string | null;
  source: string;
  pageUrl?: string;
}

export interface WizardStepData {
  step: number;
  formData: Record<string, unknown>;
}

/**
 * Gibt die aktuelle Lead-ID zurück (aus Memory oder localStorage).
 */
function getLeadId(): string | null {
  if (cachedLeadId) return cachedLeadId;
  const stored = localStorage.getItem(LEAD_ID_KEY);
  if (stored) {
    cachedLeadId = stored;
  }
  return stored;
}

/**
 * Speichert die Lead-ID in Memory und localStorage.
 */
function setLeadId(id: string): void {
  cachedLeadId = id;
  localStorage.setItem(LEAD_ID_KEY, id);
}

/**
 * Entfernt die Lead-ID aus Memory und localStorage.
 */
function clearLeadId(): void {
  cachedLeadId = null;
  localStorage.removeItem(LEAD_ID_KEY);
}

/**
 * Speichert oder aktualisiert einen Lead in der Datenbank.
 * Verwendet einen Mutex um zu verhindern, dass parallele Aufrufe
 * mehrere Leads erstellen.
 * 
 * Gibt die Lead-ID zurück.
 */
export async function captureOrUpdateLead(data: LeadData): Promise<string | null> {
  // Wenn bereits ein Insert läuft, warte darauf und update dann
  if (pendingInsert) {
    await pendingInsert;
  }

  try {
    const existingLeadId = getLeadId();
    
    // Bestimme Lead-Qualität
    const hasContact = !!(data.name && data.email);
    const leadQuality = hasContact ? "warm" : "cold";

    if (existingLeadId) {
      // Update bestehenden Lead mit neuen Daten
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      // Nur nicht-leere Felder updaten
      if (data.name) updateData.name = data.name;
      if (data.email) updateData.email = data.email.toLowerCase().trim();
      if (data.phone) updateData.phone = data.phone;
      if (data.manufacturer) updateData.manufacturer = data.manufacturer;
      if (data.model) updateData.model = data.model;
      if (data.bodyType) updateData.body_type = data.bodyType;
      if (data.saleChannel) updateData.sale_channel = data.saleChannel;
      if (data.source) updateData.source = data.source;
      if (data.pageUrl) updateData.page_url = data.pageUrl;
      if (hasContact) updateData.lead_quality = leadQuality;

      const { error } = await supabase
        .from("quick_leads")
        .update(updateData)
        .eq("id", existingLeadId);

      if (error) {
        logger.error("Lead update error:", error);
        // Falls der Lead nicht mehr existiert, neuen erstellen
        clearLeadId();
        return captureOrUpdateLead(data);
      }

      return existingLeadId;
    }

    // Neuen Lead erstellen - mit Mutex um Duplikate zu verhindern
    const insertPromise = (async (): Promise<string | null> => {
      const { data: newLead, error } = await supabase
        .from("quick_leads")
        .insert({
          name: data.name || null,
          email: data.email ? data.email.toLowerCase().trim() : null,
          phone: data.phone || null,
          manufacturer: data.manufacturer || null,
          model: data.model || null,
          body_type: data.bodyType || null,
          sale_channel: data.saleChannel || null,
          source: data.source,
          page_url: data.pageUrl || window.location.pathname,
          lead_quality: leadQuality,
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
        })
        .select("id")
        .single();

      if (error) {
        logger.error("Lead capture error:", error);
        return null;
      }

      if (newLead?.id) {
        setLeadId(newLead.id);
        return newLead.id;
      }

      return null;
    })();

    pendingInsert = insertPromise;
    const result = await insertPromise;
    pendingInsert = null;
    return result;
  } catch (error) {
    pendingInsert = null;
    logger.error("Lead tracking error:", error);
    return null;
  }
}

/**
 * Aktualisiert den Wizard-Fortschritt für einen bestehenden Lead.
 * Speichert den aktuellen Schritt und einen Snapshot der Formulardaten.
 */
export async function updateLeadWizardProgress(stepData: WizardStepData): Promise<void> {
  try {
    const leadId = getLeadId();
    if (!leadId) return;

    // Sensible Daten aus dem Snapshot entfernen
    const sanitizedFormData = { ...stepData.formData };
    delete sanitizedFormData.photos;

    const { error } = await supabase
      .from("quick_leads")
      .update({
        last_wizard_step: stepData.step,
        max_wizard_step: stepData.step,
        form_data_snapshot: sanitizedFormData,
        updated_at: new Date().toISOString(),
        // Lead-Qualität auf "hot" setzen wenn Wizard fortgeschritten
        ...(stepData.step >= 4 ? { lead_quality: "hot" } : {}),
      })
      .eq("id", leadId);

    if (error) {
      logger.error("Wizard progress update error:", error);
    }

    // max_wizard_step nur erhöhen, nie verringern
    await supabase.rpc("update_max_wizard_step" as never, {
      p_lead_id: leadId,
      p_step: stepData.step,
    } as never).catch(() => {
      // Fallback: Ignoriere wenn die RPC-Funktion nicht existiert
    });
  } catch (error) {
    logger.error("Wizard progress tracking error:", error);
  }
}

/**
 * Markiert einen Lead als "Wizard abgeschlossen".
 */
export async function markLeadWizardCompleted(): Promise<void> {
  try {
    const leadId = getLeadId();
    if (!leadId) return;

    const { error } = await supabase
      .from("quick_leads")
      .update({
        wizard_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (error) {
      logger.error("Lead completion update error:", error);
    }

    // Lead-ID aus localStorage entfernen nach Abschluss
    clearLeadId();
  } catch (error) {
    logger.error("Lead completion error:", error);
  }
}

/**
 * Gibt die aktuelle Lead-ID zurück (falls vorhanden).
 */
export function getCurrentLeadId(): string | null {
  return getLeadId();
}

/**
 * Setzt die Lead-Tracking-Session zurück (z.B. nach Wizard-Abschluss).
 */
export function resetLeadTracking(): void {
  clearLeadId();
}
