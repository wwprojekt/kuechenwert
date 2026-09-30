import { fireEvent, render, screen } from "@testing-library/react";
import type * as RouterDom from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FunnelFooter } from "../funnel-footer";
import { FunnelHeader } from "../funnel-header";
import { FunnelShell } from "../funnel-shell";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof RouterDom>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("@/hooks/useSupportPhone", () => ({
  useSupportPhone: () => ({ display: "+49 511 51532476", href: "tel:+4951151532476" }),
}));
vi.mock("@/components/SiteLogo", () => ({ SiteLogo: () => <span>KüchenWert</span> }));

function renderAt(ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/funnel/a/raum"]}>
      <Routes>
        <Route path="/" element={<p>Startseite</p>} />
        <Route path="/funnel/a/raum" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FunnelHeader", () => {
  it("zeigt nur Logo und Telefon, keine Navigation", () => {
    renderAt(<FunnelHeader />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "tel:+4951151532476"]);
  });

  it("fragt mitten im Funnel nach, bevor es zur Startseite geht", () => {
    navigateMock.mockClear();
    renderAt(<FunnelHeader guardExit />);
    fireEvent.click(screen.getByText("KüchenWert"));
    expect(screen.getByRole("alertdialog", { name: "Anfrage unterbrechen?" })).toBeInTheDocument();
    expect(screen.queryByText("Startseite")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Weiter ausfüllen" }));
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("KüchenWert"));
    fireEvent.click(screen.getByRole("button", { name: "Zur Startseite" }));
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("geht ohne Fortschritt direkt zur Startseite", () => {
    renderAt(<FunnelHeader />);
    fireEvent.click(screen.getByText("KüchenWert"));
    expect(screen.getByText("Startseite")).toBeInTheDocument();
  });
});

describe("FunnelFooter", () => {
  it("verlinkt nur das Rechtliche, in einem neuen Tab", () => {
    renderAt(<FunnelFooter />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/impressum", "/datenschutz", "/agb", "/barrierefreiheit"]);
    for (const link of links) expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "Cookie-Einstellungen" })).toBeInTheDocument();
  });

  it("passt kompakt in die mobile Leiste", () => {
    renderAt(<FunnelFooter compact />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Cookies" })).toBeInTheDocument();
  });
});

describe("FunnelShell", () => {
  const shell = (props: Partial<React.ComponentProps<typeof FunnelShell>> = {}) => (
    <FunnelShell
      currentStep={1}
      totalSteps={18}
      question="Wo steht die Küche?"
      onBack={() => undefined}
      onNext={() => undefined}
      {...props}
    >
      <p>Inhalt</p>
    </FunnelShell>
  );

  it("zeigt nur einen Fortschrittsbalken in Prozent mit Vorsprung", () => {
    renderAt(shell());
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "15");
    expect(bar).toHaveAttribute("aria-valuetext", "15 % geschafft, Schritt 2 von 18");
    expect(screen.getByText("15 %")).toBeInTheDocument();
    expect(screen.queryByText(/Schritt 2 von 18/)).not.toBeInTheDocument();
  });

  it("sagt ohne Pflichtantwort, was fehlt, statt weiterzugehen", () => {
    const onNext = vi.fn();
    const onBlocked = vi.fn();
    renderAt(shell({ canProceed: false, onNext, onBlocked, blockedHint: "Bitte wählen Sie eine Antwort aus." }));
    const [desktopNext] = screen.getAllByRole("button", { name: /Weiter/ });
    fireEvent.click(desktopNext!);
    expect(onNext).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    // Einmal unter dem Inhalt (Desktop), einmal über der mobilen Weiter-Leiste; CSS blendet je eines aus.
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) expect(alert).toHaveTextContent("Bitte wählen Sie eine Antwort aus.");
  });

  it("zeigt einen Absendefehler direkt über dem Button", () => {
    renderAt(shell({ onNext: undefined, submit: { form: "f", label: "Absenden", busy: false, busyLabel: "" }, error: "Das hat nicht geklappt." }));
    for (const button of screen.getAllByRole("button", { name: /Absenden/ })) expect(button).toHaveAttribute("type", "submit");
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Das hat nicht geklappt.");
  });

  it("geht mit Antwort weiter", () => {
    const onNext = vi.fn();
    renderAt(shell({ onNext }));
    fireEvent.click(screen.getAllByRole("button", { name: /Weiter/ })[0]!);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
