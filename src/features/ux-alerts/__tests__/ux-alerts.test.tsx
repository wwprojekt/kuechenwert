import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { UxAlert } from "../api";
import { funnelStepUrl, uxAlertLinks } from "../links";
import { UxAlertCard } from "../UxAlertCard";

const alert = (patch: Partial<UxAlert> = {}): UxAlert => ({
  id: "a1",
  kind: "dropoff",
  category: "abbruch",
  severity: "medium",
  funnel: "c",
  step: "visualisierung",
  step_index: 4,
  step_label: "Visualisierung",
  field: null,
  title: "Viele Abbrüche bei „Visualisierung“",
  detail: "6 von 8 Durchläufen enden hier (75 %).",
  hint: "Nach dem KI-Bild fehlt der Anstoß.",
  status: "open",
  window_hours: 168,
  first_seen_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  last_seen_at: new Date(Date.now() - 600_000).toISOString(),
  occurrences: 3,
  reopened_count: 0,
  resolved_at: null,
  resolved_note: null,
  auto_resolved: false,
  ...patch,
});

describe("funnelStepUrl", () => {
  it("führt zum Schritt, so wie Besucher ihn sehen", () => {
    expect(funnelStepUrl("a", "kuechenform", 0)).toBe("/formular");
    expect(funnelStepUrl("a", "zeitrahmen", 14)).toBe("/funnel/a/zeitrahmen");
    expect(funnelStepUrl("b", "angebot", 0)).toBe("/funnel/b");
    expect(funnelStepUrl("b", "kontakt", 8)).toBe("/funnel/b?schritt=9");
    expect(funnelStepUrl("c", "visualisierung", 4)).toBe("/funnel/c?schritt=visualisierung");
    expect(funnelStepUrl(null, null, null)).toBeNull();
  });
});

describe("uxAlertLinks", () => {
  it("verlinkt Schritt, passende Admin-Seite und Auswertung", () => {
    expect(uxAlertLinks({ kind: "planner_no_request", funnel: "c", step: "visualisierung", step_index: null })).toEqual([
      { label: "Schritt ansehen", to: "/funnel/c?schritt=visualisierung", external: true },
      { label: "Planungen ansehen", to: "/admin/planner-sessions" },
      { label: "Funnel-Auswertung", to: "/admin/analytics?tab=funnels&funnel=c" },
    ]);
    expect(uxAlertLinks({ kind: "error_log", funnel: null, step: null, step_index: null })).toEqual([
      { label: "Fehlerprotokoll", to: "/admin/error-logs" },
    ]);
  });
});

describe("UxAlertCard", () => {
  it("zeigt Schwere, Ort, Befund und was zu tun ist", () => {
    render(
      <MemoryRouter>
        <UxAlertCard alert={alert()} busy={false} onResolve={vi.fn()} onReopen={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Warnung")).toBeInTheDocument();
    expect(screen.getByText("Abbruch")).toBeInTheDocument();
    expect(screen.getByText("Funnel C · Traumküche · Visualisierung")).toBeInTheDocument();
    expect(screen.getByText("6 von 8 Durchläufen enden hier (75 %).")).toBeInTheDocument();
    expect(screen.getByText("Nach dem KI-Bild fehlt der Anstoß.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Schritt ansehen/ })).toHaveAttribute("target", "_blank");
  });

  it("markiert offene Alerts als erledigt und öffnet erledigte wieder", () => {
    const onResolve = vi.fn();
    const onReopen = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <UxAlertCard alert={alert()} busy={false} onResolve={onResolve} onReopen={onReopen} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Erledigt/ }));
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));

    rerender(
      <MemoryRouter>
        <UxAlertCard
          alert={alert({ status: "resolved", resolved_at: new Date().toISOString(), auto_resolved: true, resolved_note: "Seit 24 Stunden nicht mehr aufgetreten" })}
          busy={false}
          onResolve={onResolve}
          onReopen={onReopen}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Von selbst geschlossen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Wieder öffnen/ }));
    expect(onReopen).toHaveBeenCalledTimes(1);
  });
});
