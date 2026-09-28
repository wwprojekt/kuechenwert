import { beforeAll, describe, expect, it } from "vitest";

type TokenModule = {
  createUnsubscribeToken: (userId: string, scope: "werbung" | "hinweise") => Promise<string>;
  verifyUnsubscribeToken: (token: string) => Promise<{ userId: string; scope: string } | null>;
  unsubscribeUrls: (token: string) => { page: string; oneClick: string };
};
let mod: TokenModule;

const USER = "3f0c7a52-1b2d-4c3e-9f10-aabbccddeeff";

beforeAll(async () => {
  const env: Record<string, string> = {
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    SUPABASE_URL: "https://example.supabase.co",
  };
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => env[k] } };
  mod = await import("../../../../supabase/functions/_shared/unsubscribe-token.ts");
});

describe("Abmelde-Token", () => {
  it("prüft ein selbst erzeugtes Token", async () => {
    const token = await mod.createUnsubscribeToken(USER, "werbung");
    await expect(mod.verifyUnsubscribeToken(token)).resolves.toEqual({ userId: USER, scope: "werbung" });
  });

  it("lehnt veränderte Tokens ab", async () => {
    const token = await mod.createUnsubscribeToken(USER, "hinweise");
    const [payload, signature] = token.split(".");
    const otherPayload = btoa(`${USER}.werbung`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await expect(mod.verifyUnsubscribeToken(`${otherPayload}.${signature}`)).resolves.toBeNull();
    await expect(mod.verifyUnsubscribeToken(`${payload}.${signature.slice(0, -2)}AA`)).resolves.toBeNull();
    await expect(mod.verifyUnsubscribeToken(`${token}.extra`)).resolves.toBeNull();
    await expect(mod.verifyUnsubscribeToken("kaputt")).resolves.toBeNull();
  });

  it("baut Seiten- und One-Click-URL", async () => {
    const token = await mod.createUnsubscribeToken(USER, "werbung");
    const urls = mod.unsubscribeUrls(token);
    expect(urls.page).toBe(`https://kuechenwert24.de/abmelden?t=${token}`);
    expect(urls.oneClick).toBe(`https://example.supabase.co/functions/v1/kw-unsubscribe?t=${token}`);
  });
});
