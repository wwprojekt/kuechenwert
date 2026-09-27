import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { resolveEmailPreferences, toEmailPreferenceRow, type EmailPreferences } from "./email-preferences";

async function guard() {
  const ok = await ensureValidRLSSession();
  if (!ok) throw new Error("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.");
}

export async function fetchEmailPreferences(userId: string): Promise<EmailPreferences> {
  await guard();
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("broadcast_emails_enabled, newsletter_enabled, promotional_emails")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return resolveEmailPreferences(data);
}

export async function saveEmailPreferences(userId: string, prefs: EmailPreferences): Promise<void> {
  await guard();
  const { error } = await supabase
    .from("user_notification_preferences")
    .upsert(toEmailPreferenceRow(userId, prefs), { onConflict: "user_id" });
  if (error) throw error;
}
