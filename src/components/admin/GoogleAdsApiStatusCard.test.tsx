import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ invokeWithAuth: vi.fn() }));
vi.mock("@/lib/sessionGuard", () => guard);

import GoogleAdsApiStatusCard from "./GoogleAdsApiStatusCard";

const status = {
  ok: true,
  apiVersion: "v25",
  managerId: "9746508145",
  loginCustomerId: "9746508145",
  credentials: {
    developer_token: "vault",
    oauth_client_id: "vault",
    oauth_client_secret: "vault",
    oauth_refresh_token: "vault",
  },
  account: {
    id: "7603767237",
    name: "Küchenwert24.de",
    status: "ENABLED",
    autoTagging: true,
    finalUrlSuffixOk: true,
    acceptedCustomerDataTerms: false,
  },
  managerLinks: [{ managerId: "9746508145", status: "ACTIVE" }],
  conversionActions: [
    {
      id: "7700000001",
      name: "Küchenanfrage",
      status: "ENABLED",
      type: "WEBPAGE",
      category: "SUBMIT_LEAD_FORM",
      primaryForGoal: true,
      sendTo: "AW-111222333/AbC-d_1",
    },
  ],
  tracking: { enabled: false, configured: null, expected: "AW-111222333/AbC-d_1", matches: false },
};

describe("GoogleAdsApiStatusCard", () => {
  beforeEach(() => guard.invokeWithAuth.mockReset());

  it("zeigt Konto und Verknüpfung und übernimmt die Conversion aus Google Ads", async () => {
    guard.invokeWithAuth.mockResolvedValue({ data: status, error: null });
    const onApply = vi.fn();
    render(<GoogleAdsApiStatusCard onApplyTracking={onApply} />);

    fireEvent.click(screen.getByRole("button", { name: /Live-Check/ }));

    expect(await screen.findByText("Küchenwert24.de (760-376-7237)")).toBeInTheDocument();
    expect(guard.invokeWithAuth).toHaveBeenCalledWith("kw-google-ads", { body: { action: "status" } });
    expect(screen.getByText("974-650-8145")).toBeInTheDocument();
    expect(screen.getByText(/richtig: AW-111222333\/AbC-d_1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Werte übernehmen" }));
    expect(onApply).toHaveBeenCalledWith("AW-111222333", "AbC-d_1");
  });

  it("zeigt die Fehlermeldung der Function statt der Kontodaten", async () => {
    guard.invokeWithAuth.mockResolvedValue({
      data: { ...status, ok: false, error: "OAuth-Anmeldung bei Google abgelehnt (invalid_grant)" },
      error: null,
    });
    render(<GoogleAdsApiStatusCard onApplyTracking={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Live-Check/ }));

    expect(await screen.findByText(/invalid_grant/)).toBeInTheDocument();
    expect(screen.queryByText("Küchenwert24.de (760-376-7237)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Werte übernehmen" })).not.toBeInTheDocument();
  });
});
