import { ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RenderFeedback as Feedback } from "../api";

const MESSAGE: Record<"none" | "like" | "dislike", string> = {
  none: "Gefällt Ihnen diese Visualisierung?",
  like: "Danke! Ihre Bewertung hilft uns, die Visualisierung zu verbessern.",
  dislike: "Danke für die Rückmeldung – probieren Sie unten eine Variante oder beschreiben Sie Ihren Wunsch.",
};

export function RenderFeedback({
  value,
  onChange,
  disabled,
}: {
  value: Feedback;
  onChange: (value: Feedback) => void;
  disabled?: boolean;
}) {
  const option = (target: 1 | -1, label: string, Icon: LucideIcon) => {
    const active = value === target;
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => onChange(active ? null : target)}
        className={cn(
          "grid h-10 w-10 place-items-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-50",
          active
            ? target === 1
              ? "border-primary bg-primary text-primary-foreground"
              : "border-destructive bg-destructive text-destructive-foreground"
            : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
      <p className="text-sm font-medium text-foreground" aria-live="polite">
        {MESSAGE[value === 1 ? "like" : value === -1 ? "dislike" : "none"]}
      </p>
      <div className="flex flex-none gap-2">
        {option(1, "Gefällt mir", ThumbsUp)}
        {option(-1, "Gefällt mir nicht", ThumbsDown)}
      </div>
    </div>
  );
}
