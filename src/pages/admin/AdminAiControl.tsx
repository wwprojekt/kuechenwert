import { AiHistoryCard } from "@/features/ai-admin/AiHistoryCard";
import { AiModelSettingsCard } from "@/features/ai-admin/AiModelSettingsCard";
import { AiPerformanceCard } from "@/features/ai-admin/AiPerformanceCard";
import { OwnModelCard } from "@/features/ai-admin/OwnModelCard";
import { PriceLearningCard } from "@/features/ai-admin/PriceLearningCard";

/** KI-Steuerung des Traumküchen-Planers und die lernende Preis-Engine. */
export default function AdminAiControl() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">KI &amp; Preis-Engine</h1>
        <p className="text-sm text-muted-foreground">
          Bildmodelle, Ausweichmodell, A/B-Vergleich und Tageslimit der Visualisierung – und wie sich die Preisschätzung an echten
          Studio-Angeboten ausrichtet.
        </p>
      </div>
      <AiPerformanceCard />
      <AiHistoryCard />
      <AiModelSettingsCard />
      <PriceLearningCard />
      <OwnModelCard />
    </div>
  );
}
