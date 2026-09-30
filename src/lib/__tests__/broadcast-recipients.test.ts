import { describe, expect, it } from "vitest";
import { getBroadcastRecipients } from "../../../supabase/functions/_shared/broadcast-recipients.ts";

type Row = Record<string, unknown>;

/** Nachbau der PostgREST-Abfragen, die broadcast-recipients.ts nutzt. */
function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          rows = rows.filter((r) => r[column] === value);
          return query;
        },
        not: (column: string, _op: "is", value: null) => {
          rows = rows.filter((r) => r[column] !== value);
          return query;
        },
        in: (column: string, values: unknown[]) => {
          rows = rows.filter((r) => values.includes(r[column]));
          return Promise.resolve({ data: rows, error: null });
        },
        order: () => query,
        range: (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
      };
      return query;
    },
  };
}

const profile = (id: string, extra: Row = {}): Row => ({
  id,
  email: `${id}@example.de`,
  first_name: id,
  last_name: null,
  company_name: null,
  account_type: "private",
  is_verified: false,
  ...extra,
});

const db = fakeSupabase({
  profiles: [
    profile("kundin"),
    profile("studio", { account_type: "business", company_name: "Studio GmbH", is_verified: true }),
    profile("neues-studio", { account_type: "business", company_name: "Neu GmbH" }),
    profile("abgemeldet", { account_type: "business" }),
    profile("admin"),
  ],
  user_roles: [
    { user_id: "kundin", role: "seller" },
    { user_id: "studio", role: "dealer" },
    { user_id: "neues-studio", role: "dealer" },
    { user_id: "abgemeldet", role: "dealer" },
    { user_id: "admin", role: "admin" },
  ],
  user_notification_preferences: [
    { user_id: "abgemeldet", broadcast_emails_enabled: false, promotional_emails: null, newsletter_enabled: null },
    { user_id: "studio", broadcast_emails_enabled: true, promotional_emails: true, newsletter_enabled: null },
    { user_id: "kundin", broadcast_emails_enabled: null, promotional_emails: null, newsletter_enabled: true },
  ],
});

const ids = (recipients: { id: string | null }[]) => recipients.map((r) => r.id).sort();

describe("getBroadcastRecipients", () => {
  it("erkennt Küchenstudios an der Rolle, nicht am Kontotyp", async () => {
    const dealers = await getBroadcastRecipients(db, "dealers");
    expect(ids(dealers)).toEqual(["neues-studio", "studio"]);
    expect(dealers.find((r) => r.id === "studio")?.name).toBe("Studio GmbH");
    expect(ids(await getBroadcastRecipients(db, "verified_dealers"))).toEqual(["studio"]);
  });

  it("schickt Werbung nur mit Einwilligung und respektiert Abmeldungen", async () => {
    expect(ids(await getBroadcastRecipients(db, "dealers", { isPromotional: true }))).toEqual(["studio"]);
    expect(ids(await getBroadcastRecipients(db, "all"))).not.toContain("abgemeldet");
    expect(ids(await getBroadcastRecipients(db, "newsletter"))).toEqual(["kundin"]);
  });

  it("grenzt Kund:innen über den privaten Kontotyp ab", async () => {
    expect(ids(await getBroadcastRecipients(db, "customers"))).toEqual(["admin", "kundin"]);
  });
});
