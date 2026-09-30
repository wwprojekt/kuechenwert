import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDetailsCard } from "../components/ProjectDetailsCard";

const save = vi.fn();
vi.mock("../project-api", () => ({ saveProjectDetails: (...args: unknown[]) => save(...args) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderCard(props: Partial<ComponentProps<typeof ProjectDetailsCard>> = {}) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ProjectDetailsCard token="kw_t" kitchenForm="l" details={null} updatedAt={null} {...props} />
    </QueryClientProvider>,
  );
}

describe("ProjectDetailsCard", () => {
  beforeEach(() => save.mockReset());

  it("fragt die Wände der Küchenform und die Raumhöhe ab", () => {
    renderCard();
    expect(screen.getByLabelText("Wand A (cm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Wand B (cm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Raumhöhe (cm)")).toBeInTheDocument();
  });

  it("fragt bei Planer-Projekten nur, was die Planung noch nicht enthält", () => {
    renderCard({ planned: { ceiling: true, ventilation: false } });
    expect(screen.queryByLabelText("Wand A (cm)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Raumhöhe (cm)")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Dunstabzug" })).toBeInTheDocument();
  });

  it("prüft die Maße, bevor gespeichert wird", () => {
    renderCard();
    fireEvent.change(screen.getByLabelText("Raumhöhe (cm)"), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Angaben speichern" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Raumhöhe 200 bis 400 cm");
    expect(save).not.toHaveBeenCalled();
  });

  it("speichert nur ausgefüllte Angaben und zeigt den bereinigten Hinweis", async () => {
    save.mockResolvedValue({ details: { customer: { notes: "Einzug im März, Tel. [entfernt]" }, updated_at: "2026-09-30T10:00:00Z" } });
    renderCard();
    fireEvent.change(screen.getByLabelText("Wand A (cm)"), { target: { value: "320" } });
    fireEvent.click(screen.getByRole("button", { name: "Nur Umluft" }));
    fireEvent.change(screen.getByLabelText("Hinweis für die Studios"), { target: { value: " Einzug im März, Tel. 0170 1234567 " } });
    fireEvent.click(screen.getByRole("button", { name: "Angaben speichern" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith("kw_t", {
      walls: { a: 320 },
      room_features: [],
      ventilation: "umluft",
      consultation: [],
      notes: "Einzug im März, Tel. 0170 1234567",
    });
    await waitFor(() => expect(screen.getByLabelText("Hinweis für die Studios")).toHaveValue("Einzug im März, Tel. [entfernt]"));
  });
});
