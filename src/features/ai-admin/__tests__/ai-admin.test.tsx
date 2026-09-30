import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiSettingsRow, AiStats } from "../api";

const api = vi.hoisted(() => ({
  fetchAiSettings: vi.fn(),
  saveAiSettings: vi.fn(),
  fetchAiStats: vi.fn(),
  fetchCalibration: vi.fn(),
  recomputeCalibration: vi.fn(),
}));
vi.mock("../api", () => api);

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
});
