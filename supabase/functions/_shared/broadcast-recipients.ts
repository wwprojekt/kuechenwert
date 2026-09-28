// Empfaengerermittlung fuer Admin-Rundmails. send-broadcast-email (Versand) und
// get-recipient-count (Vorschau im Admin) nutzen dieselbe Logik, damit die
// angezeigte Empfaengerzahl exakt dem Versand entspricht.

export type BroadcastGroup = 'all' | 'customers' | 'dealers' | 'verified_dealers' | 'newsletter' | 'custom';

export interface BroadcastRecipient {
  email: string;
  name: string | null;
  id: string | null;
}

export const BROADCAST_GROUP_LABELS: Record<BroadcastGroup, string> = {
  all: 'Alle Benutzer',
  customers: 'Alle Kunden',
  dealers: 'Alle Küchenstudios',
  verified_dealers: 'Verifizierte Küchenstudios',
  newsletter: 'Newsletter-Abonnenten',
  custom: 'Eigene Liste',
};

export function isBroadcastGroup(value: unknown): value is BroadcastGroup {
  return typeof value === 'string' && Object.hasOwn(BROADCAST_GROUP_LABELS, value);
}

const PAGE_SIZE = 1000;

// PostgREST liefert hoechstens max-rows Zeilen pro Anfrage; ohne Paging wuerden
// Abmeldungen jenseits davon stillschweigend ignoriert.
async function selectAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function userIdsWhere(supabase: any, column: string, value: boolean): Promise<Set<string>> {
  const rows = await selectAll((from, to) =>
    supabase.from('user_notification_preferences').select('user_id').eq(column, value).order('user_id').range(from, to),
  );
  return new Set(rows.map((r) => r.user_id as string));
}

function personName(p: { first_name: string | null; last_name: string | null }): string | null {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || null;
}

export async function getBroadcastRecipients(
  supabase: any,
  group: BroadcastGroup,
  options: { customEmails?: string[]; isPromotional?: boolean } = {},
): Promise<BroadcastRecipient[]> {
  // Eigene Listen umgehen bei Service-Hinweisen jeden Opt-out, weil der Admin
  // die Adressen explizit eintraegt (z. B. Wiederherstellungs-Mails nach
  // Bounce). Werbung geht auch hier nur an Konten mit Einwilligung.
  if (group === 'custom') {
    const emails = [...new Set((options.customEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!options.isPromotional) return emails.map((email) => ({ email, name: null, id: null }));
    const promoOptIn = await userIdsWhere(supabase, 'promotional_emails', true);
    const unsubscribed = await userIdsWhere(supabase, 'broadcast_emails_enabled', false);
    const matches: any[] = [];
    for (let i = 0; i < emails.length; i += 200) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('email', emails.slice(i, i + 200));
      if (error) throw new Error(error.message);
      matches.push(...(data ?? []));
    }
    return matches
      .filter((p) => promoOptIn.has(p.id) && !unsubscribed.has(p.id))
      .map((p) => ({ email: p.email, name: personName(p), id: p.id }));
  }

  const isDealerGroup = group === 'dealers' || group === 'verified_dealers';
  const profiles = await selectAll((from, to) => {
    let query = supabase
      .from('profiles')
      .select('id, email, first_name, last_name, company_name')
      .not('email', 'is', null);
    if (group === 'customers') query = query.eq('account_type', 'private');
    if (isDealerGroup) query = query.eq('account_type', 'dealer');
    if (group === 'verified_dealers') query = query.eq('is_verified', true);
    return query.order('id').range(from, to);
  });

  const newsletter = group === 'newsletter' ? await userIdsWhere(supabase, 'newsletter_enabled', true) : null;
  const unsubscribed = await userIdsWhere(supabase, 'broadcast_emails_enabled', false);
  // Werbung nur mit Opt-in (§ 7 Abs. 2 UWG, gilt auch gegenueber Unternehmen).
  const promoOptIn = options.isPromotional ? await userIdsWhere(supabase, 'promotional_emails', true) : null;

  return profiles
    .filter((p) => (!newsletter || newsletter.has(p.id)) && !unsubscribed.has(p.id) && (!promoOptIn || promoOptIn.has(p.id)))
    .map((p) => ({
      email: p.email,
      name: isDealerGroup ? p.company_name || personName(p) : personName(p),
      id: p.id,
    }));
}
