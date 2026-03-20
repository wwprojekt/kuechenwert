import { Badge } from "@/components/ui/badge";
import { Clock, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface KaufchanceBadgeProps {
  expiresAt: string;
  className?: string;
}

export function KaufchanceBadge({ expiresAt, className }: KaufchanceBadgeProps) {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const distance = expiry - now;

      if (distance < 0) {
        setIsExpired(true);
        setTimeRemaining("Abgelaufen");
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (isExpired) {
    return (
      <Badge variant="secondary" className={className}>
        <Clock className="w-3 h-3 mr-1" />
        Abgelaufen
      </Badge>
    );
  }

  return (
    <Badge 
      className={`bg-gradient-to-r from-amber-500 to-orange-500 text-white gap-1 animate-pulse ${className}`}
    >
      <Zap className="w-3 h-3" />
      Kaufchance - Noch {timeRemaining}
    </Badge>
  );
}
