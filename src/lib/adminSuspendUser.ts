import { invokeWithAuth, ensureValidRLSSession } from "@/lib/sessionGuard";

/**
 * Atomic admin suspend/unsuspend.
 *
 * Wraps the `admin-suspend-user` Edge Function which:
 *   - updates `profiles.is_suspended` (+ suspended_at, suspended_reason, suspended_by)
 *   - sends a notification email to the affected user
 *   - writes audit_logs + admin_emails entries
 *   - persists email failures to error_logs
 *
 * Intended replacement for the previous inline `supabase.from('profiles').update(...)`
 * calls in AdminUsers, AdminDealers, AdminDealerDetail, UserEditDialog.
 */

export interface AdminSuspendResult {
  success: boolean;
  userId: string;
  suspend: boolean;
  isDealer?: boolean;
  noChange?: boolean;
  mailSent: boolean;
  mailError: string | null;
  message: string;
}

export async function adminSuspendUser(
  userId: string,
  suspend: boolean,
  options: { reason?: string; sendEmail?: boolean } = {},
): Promise<AdminSuspendResult> {
  const sessionValid = await ensureValidRLSSession();
  if (!sessionValid) throw new Error("Session abgelaufen");

  const { data, error } = await invokeWithAuth("admin-suspend-user", {
    body: {
      userId,
      suspend,
      reason: options.reason ?? null,
      sendEmail: options.sendEmail !== false,
    },
  });

  if (error) {
    const msg = (error as { message?: string }).message || "Status konnte nicht geändert werden";
    throw new Error(msg);
  }

  const result = data as Partial<AdminSuspendResult> & { error?: string };
  if (result?.error) throw new Error(result.error);

  return {
    success: result.success ?? true,
    userId: result.userId ?? userId,
    suspend: result.suspend ?? suspend,
    isDealer: result.isDealer,
    noChange: result.noChange,
    mailSent: result.mailSent ?? false,
    mailError: result.mailError ?? null,
    message: result.message ?? (suspend ? "Konto wurde gesperrt" : "Konto wurde wieder freigegeben"),
  };
}
