import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  kitchenId: string;
  variant?: "icon" | "button";
  className?: string;
}

export function FavoriteButton({ kitchenId, variant = "icon", className }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isLoading } = useFavorites();
  const isFav = isFavorite(kitchenId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleFavorite(kitchenId);
  };

  if (variant === "button") {
    return (
      <Button
        variant={isFav ? "default" : "outline"}
        size="sm"
        onClick={handleClick}
        disabled={isLoading}
        className={cn("gap-2", className)}
      >
        <Heart className={cn("w-4 h-4", isFav && "fill-current")} />
        {isFav ? "Gespeichert" : "Merken"}
      </Button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "p-2.5 rounded-full transition-all duration-200",
        isFav 
          ? "bg-red-500 text-white hover:bg-red-600" 
          : "bg-card/80 dark:bg-card/80 text-gray-600 dark:text-gray-400 hover:bg-card dark:hover:bg-card hover:text-red-500",
        "shadow-md hover:shadow-lg",
        className
      )}
      title={isFav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      aria-label={isFav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
    >
      <Heart className={cn("w-5 h-5", isFav && "fill-current")} />
    </button>
  );
}
