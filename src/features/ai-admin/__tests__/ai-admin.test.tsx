import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiSettingsRow, AiStats } from "../api";

const api = vi.hoisted(() => ({
  fetchAiSettings: vi.fn(),
  saveAiSettings: vi.fn(),
  setPriceCalibrationEnabled: vi.fn(),
  fetchAiStats: vi.fn(),
  fetchCalibration: vi.fn(),
  fetchCalibrationRuns: vi.fn(),
  recomputeCalibration: vi.fn(),
  fetchDailyStats: vi.fn(),
  fetchSettingsHistory: vi.fn(),
  labList: vi.fn(),
  labRun: vi.fn(),
  labStatus: vi.fn(),
  labUploadPhoto: vi.fn(),
  rateLabRender: vi.fn(),
}));
vi.mock("../api", () => api);

import { AiHistoryCard } from "../AiHistoryCard";
import { AiLabCard } from "../AiLabCard";
import { AiModelSettingsCard } from "../AiModelSettingsCard";
import { AiPerformanceCard } from "../AiPerformanceCard";
import { PriceLearningCard } from "../PriceLearningCard";

const wrap = (node: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);

const settings: AiSettingsRow = {
  id: true,
  edit_model: "fal-ai/nano-banana-pro/edit",
  text_model: "fal-ai/flux-2-pro",
  variant_model: null,
  fallback_edit_model: "fal-ai/nano-banana-2/edit",
  fallback_edit_model_2: "fal-ai/flux-2-pro/edit",
  fallback_text_model: "fal-ai/nano-banana-2",
  challenger_edit_model: "fal-ai/qwen-image-edit-plus-lora",
  challenger_share: 20,
  lora_url: null,
  lora_scale: 1,
  daily_render_cap: 300,
  price_calibration_enabled: true,
  plan_reading_enabled: true,
  plan_reading_model: "mistral-medium-latest",
  updated_at: "2026-09-28T22:00:00Z",
  updated_by: null,
};

const stats: AiStats = {
  days: 30,
  since: "2026-08-29T00:00:00Z",
  today: { renders: 42, cap: 300, open: 30, open_cap: 210 },
  funnel: { sessions: 120, with_render: 90, with_photo_render: 70, leads: 30, ai_training_consents: 12, cost_cents: 1500 },
  groups: [
    {
      group: "control",
      sessions: 80,
      leads: 20,
      renders: 100,
      first_renders: 80,
      success: 78,
      fell_back: 4,
      variants: 20,
      thumbs_up: 40,
      thumbs_down: 10,
      cost_cents: 1200,
    },
    {
      group: "challenger",
      sessions: 20,
      leads: 4,
      renders: 25,
      first_renders: 20,
      success: 19,
      fell_back: 2,
      variants: 5,
      thumbs_up: 6,
      thumbs_down: 6,
      cost_cents: 250,
    },
  ],
  reasons: { raum: 3, unecht: 1 },
  models: [
    {
      model: "fal-ai/nano-banana-pro/edit",
      mode: "edit",
      started: 100,
      first_try_success: 97,
      fell_back: 3,
      failed: 0,
      images: 97,
      as_fallback: 0,
      variants: 30,
      avg_ms: 29000,
      p50_ms: 28000,
      p90_ms: 35000,
      cost_cents: 1455,
      thumbs_up: 40,
      thumbs_down: 10,
      reasons: { raum: 3 },
    },
  ],
  training: { samples: 12, sessions: 9 },
};

describe("Admin KI & Preis-Engine", () => {
  beforeEach(() => vi.clearAllMocks());

  it("zeigt Modelle, Ausweichkette, Vergleichsmodell und LoRA-Feld", async () => {
    api.fetchAiSettings.mockResolvedValue(settings);
    wrap(<AiModelSettingsCard />);
    expect(await screen.findByText("Hauptmodell mit Raumfoto")).toBeInTheDocument();
    expect(screen.getByText("1. Ausweichmodell mit Raumfoto")).toBeInTheDocument();
    expect(screen.getByText("2. Ausweichmodell mit Raumfoto")).toBeInTheDocument();
    expect(screen.getByText("Anteil: 20 %")).toBeInTheDocument();
    expect(screen.getByLabelText(/Eigenes LoRA/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("300")).toBeInTheDocument();
  });

  it("zeigt Kennzahlen je Modell und den A/B-Vergleich", async () => {
    api.fetchAiStats.mockResolvedValue(stats);
    wrap(<AiPerformanceCard />);
    expect(await screen.findByText("Nano Banana Pro (Gemini 3 Pro Image)")).toBeInTheDocument();
    expect(screen.getByText("97 %")).toBeInTheDocument();
    expect(screen.getByText("42 / 300")).toBeInTheDocument();
    expect(screen.getByText("Vergleichsmodell")).toBeInTheDocument();
    expect(screen.getByText("80 % positiv")).toBeInTheDocument();
    expect(screen.getByText(/30 von höchstens 210/)).toBeInTheDocument();
    expect(screen.getByText("Raum verändert (3) · Wirkt künstlich (1)")).toBeInTheDocument();
    expect(screen.getByText(/Noch kein gesicherter Unterschied/)).toBeInTheDocument();
  });

  it("erklärt die neutrale Preis-Engine ohne Angebote und zeigt gelernte Faktoren", async () => {
    api.fetchAiSettings.mockResolvedValue(settings);
    api.fetchCalibrationRuns.mockResolvedValue([]);
    api.fetchCalibration.mockResolvedValueOnce([
      { segment: "global", factor: 1, sample_count: 0, observed_ratio: null, updated_at: "2026-09-28T22:49:46Z" },
    ]);
    const first = wrap(<PriceLearningCard />);
    expect(await screen.findByText(/Noch keine Studio-Angebote ausgewertet/)).toBeInTheDocument();
    first.unmount();

    api.fetchCalibration.mockResolvedValueOnce([
      { segment: "global", factor: 1.06, sample_count: 24, observed_ratio: 1.12, updated_at: "2026-09-28T22:49:46Z" },
      { segment: "quality:premium", factor: 0.97, sample_count: 9, observed_ratio: 0.93, updated_at: "2026-09-28T22:49:46Z" },
      { segment: "region:8", factor: 1, sample_count: 0, observed_ratio: null, updated_at: "2026-09-28T22:49:46Z" },
    ]);
    wrap(<PriceLearningCard />);
    expect(await screen.findByText("Gesamt")).toBeInTheDocument();
    expect(screen.getByText("+6 %")).toBeInTheDocument();
    expect(screen.getByText("Qualität Premium")).toBeInTheDocument();
    expect(screen.queryByText("PLZ-Region 8")).not.toBeInTheDocument();
  });

  it("zeigt die Treffsicherheit und lässt den Marktabgleich abschalten", async () => {
    api.fetchAiSettings.mockResolvedValue(settings);
    api.fetchCalibration.mockResolvedValue([
      { segment: "global", factor: 1.06, sample_count: 24, observed_ratio: 1.12, updated_at: "2026-09-28T22:49:46Z" },
    ]);
    api.fetchCalibrationRuns.mockResolvedValue([
      {
        run_at: "2026-09-29T03:40:00Z",
        applied: true,
        observations: 24,
        global_factor: 1.06,
        accuracy: {
          shown: { n: 20, mdape: 0.14, coverage: 0.7, bias: 0.09 },
          raw: { n: 24, mdape: 0.16, coverage: 0.6, bias: 0.1 },
          calibrated: { n: 24, mdape: 0.1, coverage: 0.75, bias: 0.01 },
        },
      },
    ]);
    api.setPriceCalibrationEnabled.mockResolvedValue(undefined);
    api.recomputeCalibration.mockResolvedValue({ observations: 24, globalFactor: 1.06, applied: false });
    wrap(<PriceLearningCard />);
    expect(await screen.findByText("± 14 %")).toBeInTheDocument();
    expect(screen.getByText("70 % der Angebote in der Spanne · 20 Ausschreibungen")).toBeInTheDocument();
    expect(screen.getByText(/im Mittel 9 % unter dem Angebotsmedian/)).toBeInTheDocument();

    const toggle = await screen.findByRole("switch", { name: "Marktabgleich anwenden" });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);
    await waitFor(() => expect(api.setPriceCalibrationEnabled).toHaveBeenCalledWith(false));
    await waitFor(() => expect(api.recomputeCalibration).toHaveBeenCalled());
  });

  it("schlägt im Testlauf Haupt-, Vergleichs- und Ausweichmodell vor und zeigt die Ergebnisse", async () => {
    api.fetchAiSettings.mockResolvedValue(settings);
    const run = {
      run_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-09-30T12:00:00Z",
      photo_path: "ai-lab/photos/a.jpg",
      photo_url: "/foto.jpg",
      config: null,
      renders: [
        { id: "r1", model: "fal-ai/nano-banana-pro/edit", status: "success", error: null, cost_cents: 15, generation_ms: 28_000, rating: null, image_url: "/nbp.jpg" },
        { id: "r2", model: "openai/gpt-image-2.5/sunburst/edit", status: "failed", error: "content policy", cost_cents: 6, generation_ms: null, rating: null, image_url: null },
      ],
    };
    api.labList.mockResolvedValue([run]);
    api.labStatus.mockResolvedValue(run);
    wrap(<AiLabCard />);
    expect(await screen.findByText("content policy")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "KI" })).toHaveAttribute("src", "/nbp.jpg");
    const checked = await screen.findAllByRole("checkbox", { checked: true });
    expect(checked).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Testlauf starten/ })).toBeEnabled();
  });

  it("zeigt den Verlauf je Woche und die Änderungen an den Einstellungen", async () => {
    api.fetchDailyStats.mockResolvedValue([
      { day: "2026-09-30", stats: { models: stats.models, groups: [], reasons: {}, funnel: stats.funnel } },
    ]);
    api.fetchSettingsHistory.mockResolvedValue([
      { changed_at: "2026-09-30T12:00:00Z", changes: { daily_render_cap: { from: 300, to: 400 } } },
    ]);
    wrap(<AiHistoryCard />);
    expect(await screen.findByText("KW 40/2026")).toBeInTheDocument();
    expect(screen.getByText("Nano Banana Pro (Gemini 3 Pro Image)")).toBeInTheDocument();
    expect(await screen.findByText("Tageslimit: 300 → 400")).toBeInTheDocument();
  });
});
