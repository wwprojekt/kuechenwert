import { describe, expect, it } from "vitest";
import { buildAuthMails, redactSecrets } from "../../../supabase/functions/_shared/auth-email.ts";

const BASE = "https://kuechenwert24.de";
const HASH = "7d5b7b1964cf5d388340a7f04f1dbb5eeb6c7b52ef8270e1737a58d0";
const HASH_NEW = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c";
const user = { id: "8484b834-f29e-4af2-bf42-80644d154f76", email: "kunde@example.de" };

const linkIn = (text: string) => text.match(/https?:\/\/\S+\/auth\/confirm\?\S+/)?.[0] ?? null;
const params = (link: string) => new URL(link).searchParams;

describe("buildAuthMails", () => {
  it("schickt die Registrierungsbestätigung mit token_hash-Link auf /auth/confirm", () => {
    const [mail, ...rest] = buildAuthMails(user, { email_action_type: "signup", token: "305805", token_hash: HASH, redirect_to: `${BASE}/` });
    expect(rest).toHaveLength(0);
    expect(mail.to).toBe(user.email);
    expect(mail.emailType).toBe("auth_signup");
    const link = linkIn(mail.text)!;
    expect(link.startsWith(`${BASE}/auth/confirm?`)).toBe(true);
    expect(params(link).get("token_hash")).toBe(HASH);
    expect(params(link).get("type")).toBe("signup");
    expect(params(link).has("redirect_to")).toBe(false);
    expect(mail.html).toContain(`token_hash=${HASH}&amp;type=signup`);
    expect(mail.html).toContain("Guten Tag,");
  });

  it("übernimmt nur eigene Zielseiten als redirect_to", () => {
    const link = (redirect_to: string) =>
      linkIn(buildAuthMails(user, { email_action_type: "recovery", token_hash: HASH, redirect_to })[0].text)!;

    expect(params(link(`${BASE}/reset-password`)).get("redirect_to")).toBe("/reset-password");
    expect(params(link("https://www.kuechenwert24.de/dashboard?tab=1")).get("redirect_to")).toBe("/dashboard?tab=1");
    expect(params(link(`${BASE}/auth/confirm?type=recovery`)).has("redirect_to")).toBe(false);
    expect(params(link(`${BASE}//evil.example/x`)).has("redirect_to")).toBe(false);

    const foreign = link("https://evil.example/steal");
    expect(foreign.startsWith(`${BASE}/auth/confirm?`)).toBe(true);
    expect(params(foreign).has("redirect_to")).toBe(false);

    const local = link("http://localhost:8080/dashboard");
    expect(local.startsWith("http://localhost:8080/auth/confirm?")).toBe(true);
    expect(params(local).get("redirect_to")).toBe("/dashboard");
  });

  it("verschickt bei sicherer E-Mail-Änderung zwei Mails mit den vertauscht benannten Hashes", () => {
    const mails = buildAuthMails(
      { ...user, new_email: "neu@example.de" },
      { email_action_type: "email_change", token: "111111", token_hash: HASH, token_new: "222222", token_hash_new: HASH_NEW },
    );
    const current = mails.find((m) => m.to === user.email)!;
    const next = mails.find((m) => m.to === "neu@example.de")!;
    expect(mails).toHaveLength(2);
    expect(params(linkIn(current.text)!).get("token_hash")).toBe(HASH_NEW);
    expect(params(linkIn(next.text)!).get("token_hash")).toBe(HASH);
    expect(params(linkIn(next.text)!).get("type")).toBe("email_change");
  });

  it("verschickt ohne sichere E-Mail-Änderung nur die Mail an die neue Adresse", () => {
    const mails = buildAuthMails(
      { ...user, new_email: "neu@example.de" },
      { email_action_type: "email_change", token: "111111", token_hash: HASH, token_new: "", token_hash_new: "" },
    );
    expect(mails.map((m) => m.to)).toEqual(["neu@example.de"]);
    expect(params(linkIn(mails[0].text)!).get("token_hash")).toBe(HASH);
  });

  it("maskiert Adressen im HTML", () => {
    const [current] = buildAuthMails(
      { ...user, new_email: "<b>x</b>@example.de" },
      { email_action_type: "email_change", token_hash: HASH, token_hash_new: HASH_NEW },
    );
    expect(current.html).toContain("&lt;b&gt;x&lt;/b&gt;@example.de");
    expect(current.html).not.toContain("<b>x</b>");
  });

  it("zeigt bei reauthentication nur den Code, ohne Link", () => {
    const [mail] = buildAuthMails(user, { email_action_type: "reauthentication", token: "482913" });
    expect(mail.emailType).toBe("auth_reauthentication");
    expect(mail.text).toContain("Bestätigungscode: 482913");
    expect(linkIn(mail.text)).toBeNull();
    expect(redactSecrets(mail.html, mail.secrets)).not.toContain("482913");
  });

  it("schickt Sicherheitshinweise ohne Token, die Adressänderung an die bisherige Adresse", () => {
    const [changed] = buildAuthMails({ ...user, email: "neu@example.de" }, { email_action_type: "email_changed_notification", old_email: "alt@example.de" });
    expect(changed.to).toBe("alt@example.de");
    expect(changed.emailType).toBe("auth_notification");
    expect(changed.text).toContain("von alt@example.de auf neu@example.de");
    expect(changed.secrets).toEqual([]);

    const [password] = buildAuthMails(user, { email_action_type: "password_changed_notification" });
    expect(password.to).toBe(user.email);
    expect(password.text).toContain(`${BASE}/forgot-password`);
  });

  it("lehnt unbekannte Typen und fehlende Daten ab", () => {
    expect(() => buildAuthMails(user, { email_action_type: "something_new" })).toThrow(/Unbekannter/);
    expect(() => buildAuthMails(user, { email_action_type: "recovery" })).toThrow(/token_hash/);
    expect(() => buildAuthMails({ id: user.id }, { email_action_type: "signup", token_hash: HASH })).toThrow(/Empfänger/);
  });
});

describe("redactSecrets", () => {
  it("entfernt Tokens und Hashes aus dem Protokoll", () => {
    const [mail] = buildAuthMails(user, { email_action_type: "magiclink", token: "305805", token_hash: HASH });
    const logged = redactSecrets(mail.html, mail.secrets);
    expect(mail.html).toContain(HASH);
    expect(logged).not.toContain(HASH);
    expect(logged).toContain("[entfernt]");
  });
});
