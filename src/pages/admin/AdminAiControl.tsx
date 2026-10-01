import { AiHistoryCard } from "@/features/ai-admin/AiHistoryCard";
import { AiLabCard } from "@/features/ai-admin/AiLabCard";
import { AiModelSettingsCard } from "@/features/ai-admin/AiModelSettingsCard";
import { AiPerformanceCard } from "@/features/ai-admin/AiPerformanceCard";
import { OwnModelCard } from "@/features/ai-admin/OwnModelCard";
import { PlanReadingCard } from "@/features/ai-admin/PlanReadingCard";
import { PriceLearningCard } from "@/features/ai-admin/PriceLearningCard";

/** KI-Steuerung des Traumküchen-Planers, das Auslesen hochgeladener Planungen und die lernende Preis-Engine. */
export default function AdminAiControl() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">KI &amp; Preis-Engine</h1>
        <p className="text-sm text-muted-foreground">
          Bildmodelle, Ausweichmodell, A/B-Vergleich und Tageslimit der Visualisierung, das Auslesen hochgeladener Planungen – und wie sich
          die Preisschätzung an echten Studio-Angeboten ausrichtet.
        </p>
      </div>
      <AiPerformanceCard />
      <AiHistoryCard />
      <AiModelSettingsCard />
      <AiLabCard />
      <PlanReadingCard />
      <PriceLearningCard />
      <OwnModelCard />
    </div>
  );
}
