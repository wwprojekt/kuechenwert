import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession, invokeWithAuth } from "@/lib/sessionGuard";

export type MessageSource = "contact" | "support";
export type MessageStatus = "open" | "in_progress" | "resolved";

export interface AdminMessage {
  id: string;
  source: MessageSource;
  subject: string;
  message: string;
  status: MessageStatus;
  adminResponse: string | null;
  respondedAt: string | null;
  createdAt: string | null;
  sender: {
    name: string | null;
    email: string | null;
    phone: string | null;
    customerNumber: string | null;
    userId: string | null;
  };
}

export const STATUS_OPTIONS: Record<MessageSource, MessageStatus[]> = {
  // contact_messages kennt nur 'new' und 'resolved' (siehe toContactStatus).
  contact: ["open", "resolved"],
  support: ["open", "in_progress", "resolved"],
};

export const STATUS_LABELS: Record<MessageStatus, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Erledigt",
};

const LIST_LIMIT = 500;

function normalizeStatus(status: string | null): MessageStatus {
  if (status === "resolved" || status === "in_progress") return status;
  return "open";
}

function toContactStatus(status: MessageStatus): "new" | "resolved" {
  return status === "resolved" ? "resolved" : "new";
}

export async function fetchAdminMessages(): Promise<AdminMessage[]> {
  const sessionValid = await ensureValidRLSSession();
  if (!sessionValid) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");

  const [contactRes, supportRes] = await Promise.all([
    supabase
      .from("contact_messages")
      .select("id, name, email, phone, subject, message, status, admin_response, responded_at, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("support_messages")
      .select("id, user_id, subject, message, status, admin_response, responded_at, created_at")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
  ]);
  if (contactRes.error) throw contactRes.error;
  if (supportRes.error) throw supportRes.error;

  const userIds = [...new Set((supportRes.data || []).map((m) => m.user_id).filter((id): id is string => !!id))];
  const profiles = new Map<string, { first_name: string | null; last_name: string | null; email: string; phone: string | null; customer_number: string | null }>();
  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, customer_number")
      .in("id", userIds);
    if (error) throw error;
    for (const p of data || []) profiles.set(p.id, p);
  }

  const contacts: AdminMessage[] = (contactRes.data || []).map((c) => ({
    id: c.id,
    source: "contact",
    subject: c.subject,
    message: c.message,
    status: normalizeStatus(c.status),
    adminResponse: c.admin_response,
    respondedAt: c.responded_at,
    createdAt: c.created_at,
    sender: { name: c.name, email: c.email, phone: c.phone, customerNumber: null, userId: null },
  }));

  const support: AdminMessage[] = (supportRes.data || []).map((m) => {
    const profile = m.user_id ? profiles.get(m.user_id) : undefined;
    const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : "";
    return {
      id: m.id,
      source: "support",
      subject: m.subject,
      message: m.message,
      status: normalizeStatus(m.status),
      adminResponse: m.admin_response,
      respondedAt: m.responded_at,
      createdAt: m.created_at,
      sender: {
        name: name || null,
        email: profile?.email ?? null,
        phone: profile?.phone ?? null,
        customerNumber: profile?.customer_number ?? null,
        userId: m.user_id,
      },
    };
  });

  return [...contacts, ...support];
}

export async function updateMessageStatus(message: Pick<AdminMessage, "id" | "source">, status: MessageStatus): Promise<void> {
  const sessionValid = await ensureValidRLSSession();
  if (!sessionValid) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");

  const query =
    message.source === "contact"
      ? supabase.from("contact_messages").update({ status: toContactStatus(status) }).eq("id", message.id).select("id")
      : supabase.from("support_messages").update({ status }).eq("id", message.id).select("id");
  const { data, error } = await query;
  if (error) throw error;
  // RLS verwirft Updates ohne Fehler – dann kommt keine Zeile zurück.
  if (!data || data.length === 0) throw new Error("Keine Berechtigung, den Status zu ändern.");
}

/** Kontaktnachrichten werden nur als gelöscht markiert, Support-Nachrichten endgültig gelöscht. */
export async function deleteMessages(messages: Pick<AdminMessage, "id" | "source">[]): Promise<void> {
  const sessionValid = await ensureValidRLSSession();
  if (!sessionValid) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");

  const contactIds = messages.filter((m) => m.source === "contact").map((m) => m.id);
  const supportIds = messages.filter((m) => m.source === "support").map((m) => m.id);

  if (contactIds.length > 0) {
    const { error } = await supabase
      .from("contact_messages")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", contactIds);
    if (error) throw error;
  }
  if (supportIds.length > 0) {
    const { error } = await supabase.from("support_messages").delete().in("id", supportIds);
    if (error) throw error;
  }
}

function toHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
}

/** Versendet die Antwort per E-Mail; send-admin-email setzt die Nachricht dabei auf „resolved“. */
export async function sendMessageReply(message: AdminMessage, reply: string): Promise<string> {
  const recipient = message.sender.email?.trim();
  if (!recipient) {
    throw new Error("Für diese Nachricht ist keine Empfänger-E-Mail hinterlegt.");
  }
  const subject = message.subject?.toLowerCase().startsWith("re:")
    ? message.subject
    : `Re: ${message.subject || "Ihre Anfrage"}`;

  const { error } = await invokeWithAuth("send-admin-email", {
    body: {
      to: recipient,
      subject,
      body_html: toHtml(reply.trim()),
      recipient_name: message.sender.name || undefined,
      reply_to_message_id: message.id,
      reply_to_message_type: message.source,
    },
  });
  if (error) throw error;
  return recipient;
}
