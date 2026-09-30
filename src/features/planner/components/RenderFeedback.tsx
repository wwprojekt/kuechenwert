import { ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RENDER_FEEDBACK_REASONS, type RenderFeedbackReason } from "../../../../supabase/functions/_shared/render-feedback.ts";
import type { RenderFeedback as Feedback } from "../api";

const MESSAGE: Record<"none" | "like" | "dislike", string> = {
  none: "Gefällt Ihnen diese Visualisierung?",
  like: "Danke! Ihre Bewertung hilft uns, die Visualisierung zu verbessern.",
  dislike: "Danke! Was passt nicht? Unten können Sie auch eine Variante mit Ihrem Wunsch erstellen.",
};

export function RenderFeedback({
  value,
  reasons = [],
  onChange,
  disabled,
}: {
  value: Feedback;
  reasons?: readonly RenderFeedbackReason[];
  onChange: (value: Feedback, reasons: RenderFeedbackReason[]) => void;
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
        onClick={() => onChange(active ? null : target, [])}
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

  const toggleReason = (id: RenderFeedbackReason) =>
    onChange(-1, reasons.includes(id) ? reasons.filter((r) => r !== id) : [...reasons, id]);

  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground" aria-live="polite">
          {MESSAGE[value === 1 ? "like" : value === -1 ? "dislike" : "none"]}
        </p>
        <div className="flex flex-none gap-2">
          {option(1, "Gefällt mir", ThumbsUp)}
          {option(-1, "Gefällt mir nicht", ThumbsDown)}
        </div>
      </div>
      {value === -1 && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Was passt nicht?">
          {RENDER_FEEDBACK_REASONS.map((r) => {
            const on = reasons.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => toggleReason(r.id)}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                  on
                    ? "border-destructive bg-destructive/10 text-foreground"
                    : "border-input bg-background text-muted-foreground hover:border-primary hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
