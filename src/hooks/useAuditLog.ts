import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { logger } from "@/lib/logger";

export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "email_sent"
  | "email_broadcast"
  | "user_suspended"
  | "user_unsuspended"
  | "dealer_approved"
  | "dealer_rejected"
  | "invoice_created"
  | "payment_received"
  | "settings_changed";

export type AuditEntityType =
  | "user"
  | "dealer"
  | "invoice"
  | "email"
  | "settings"
  | "notification"
  | "lead";

interface LogEventParams {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  details?: Record<string, any>;
}

export function useAuditLog() {
  const logEvent = useCallback(async ({ action, entityType, entityId, details }: LogEventParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      await supabase.from("audit_logs" as any).insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        details: details || {},
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      // Silently fail - audit logging should never break the app
      logger.warn("Audit log failed:", error);
    }
  }, []);

  return { logEvent };
}
