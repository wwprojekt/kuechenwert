import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../Login";

// Angemeldet als Kunde: Login leitet sofort weiter, auf das Ziel aus ?redirect= oder /dashboard.
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ primaryRole: "user", isLoading: false }) }));
vi.mock("@/components/PageLayout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

describe("Login: Rückweg nach der Anmeldung", () => {
  const navigate = vi.fn();
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(useNavigate).mockReturnValue(navigate);
  });

  const zielNach = (url: string) => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Login />
      </MemoryRouter>,
    );
    return navigate.mock.calls.at(-1)?.[0];
  };

  it("folgt einem eigenen Pfad", () => {
    expect(zielNach("/login?redirect=%2Fdashboard%2Fprojekte%3Ftab%3Doffen")).toBe("/dashboard/projekte?tab=offen");
  });

  it.each(["//fremd.de", "/\\fremd.de", "https://fremd.de", "javascript:alert(1)", "/%09/fremd.de"])(
    "nimmt bei %s das Startziel",
    (ziel) => {
      expect(zielNach(`/login?redirect=${encodeURIComponent(decodeURIComponent(ziel))}`)).toBe("/dashboard");
    },
  );
});
