import { Star } from "lucide-react";
import trustpilotLogo from "@/assets/trustpilot-logo.svg";

interface TrustpilotWidgetProps {
  variant?: "compact" | "full";
}

const TrustpilotWidget = ({ variant = "compact" }: TrustpilotWidgetProps) => {
  const rating = 4.8;
  const totalReviews = 2847;

  const renderStars = () => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= Math.floor(rating)
                ? "fill-[#00b67a] text-[#00b67a]"
                : star - 0.5 <= rating
                ? "fill-[#00b67a] text-[#00b67a]"
                : "fill-muted text-muted"
            }`}
          />
        ))}
      </div>
    );
  };

  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-3 bg-background/50 backdrop-blur-sm border border-border/50 rounded-lg px-4 py-2.5 shadow-sm">
        <div className="flex flex-col gap-1">
          {renderStars()}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{rating}</span>
            <span className="text-xs text-muted-foreground">
              aus {totalReviews.toLocaleString("de-DE")} Bewertungen
            </span>
          </div>
        </div>
        <div className="h-10 w-px bg-border/50" />
        <div className="flex items-center">
          <img 
            src={trustpilotLogo} 
            alt="Trustpilot" 
            className="h-6 w-auto"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground mb-1">Ausgezeichnet</h3>
          {renderStars()}
        </div>
        <img 
          src={trustpilotLogo} 
          alt="Trustpilot" 
          className="h-8 w-auto"
        />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-3xl font-bold text-foreground">{rating}</span>
        <span className="text-sm text-muted-foreground">von 5</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Basierend auf {totalReviews.toLocaleString("de-DE")} Bewertungen
      </p>
    </div>
  );
};

export default TrustpilotWidget;
