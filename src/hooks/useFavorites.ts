import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseFavoritesResult {
  favorites: string[]; // Array of motorhome IDs
  isLoading: boolean;
  isFavorite: (motorhomeId: string) => boolean;
  toggleFavorite: (motorhomeId: string) => Promise<void>;
  addFavorite: (motorhomeId: string) => Promise<void>;
  removeFavorite: (motorhomeId: string) => Promise<void>;
}

export function useFavorites(): UseFavoritesResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites on mount
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }

    const loadFavorites = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_favorites")
          .select("motorhome_id")
          .eq("user_id", user.id);

        if (error) throw error;
        setFavorites(data?.map(f => f.motorhome_id).filter(Boolean) as string[] || []);
      } catch (error) {
        console.error("Error loading favorites:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, [user]);

  const isFavorite = useCallback((motorhomeId: string): boolean => {
    return favorites.includes(motorhomeId);
  }, [favorites]);

  const addFavorite = useCallback(async (motorhomeId: string): Promise<void> => {
    if (!user) {
      toast({
        title: "Anmeldung erforderlich",
        description: "Bitte melden Sie sich an, um Favoriten zu speichern",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("user_favorites").insert({
        user_id: user.id,
        motorhome_id: motorhomeId,
      });

      if (error) {
        if (error.code === "23505") {
          // Already exists, ignore
          return;
        }
        throw error;
      }

      setFavorites(prev => [...prev, motorhomeId]);
      toast({
        title: "Favorit hinzugefügt",
        description: "Das Fahrzeug wurde zu Ihren Favoriten hinzugefügt",
      });
    } catch (error) {
      console.error("Error adding favorite:", error);
      toast({
        title: "Fehler",
        description: "Favorit konnte nicht hinzugefügt werden",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  const removeFavorite = useCallback(async (motorhomeId: string): Promise<void> => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("motorhome_id", motorhomeId);

      if (error) throw error;

      setFavorites(prev => prev.filter(id => id !== motorhomeId));
      toast({
        title: "Favorit entfernt",
        description: "Das Fahrzeug wurde aus Ihren Favoriten entfernt",
      });
    } catch (error) {
      console.error("Error removing favorite:", error);
      toast({
        title: "Fehler",
        description: "Favorit konnte nicht entfernt werden",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  const toggleFavorite = useCallback(async (motorhomeId: string): Promise<void> => {
    if (isFavorite(motorhomeId)) {
      await removeFavorite(motorhomeId);
    } else {
      await addFavorite(motorhomeId);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  return {
    favorites,
    isLoading,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}
