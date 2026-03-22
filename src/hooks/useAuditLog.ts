import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "email_sent"
  | "email_broadcast"
  | "bid_placed"
  | "auction_created"
  | "auction_closed"
  | "auction_activated"
  | "user_suspended"
  | "user_unsuspended"
  | "dealer_approved"
  | "dealer_rejected"
  | "invoice_created"
  | "payment_received"
  | "settings_changed"
  | "push_notification_sent";

export type AuditEntityType =
  | "user"
  | "auction"
  | "bid"
  | "motorhome"
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
      console.warn("Audit log failed:", error);
    }
  }, []);

  return { logEvent };
}
