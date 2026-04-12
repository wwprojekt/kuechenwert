import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { withSessionRetry, ensureValidRLSSession } from "@/lib/sessionGuard";
import { trackEvent } from "@/lib/analyticsService";

interface UseFavoritesResult {
  favorites: string[];
  isLoading: boolean;
  isFavorite: (vehicleId: string) => boolean;
  toggleFavorite: (vehicleId: string) => Promise<void>;
  addFavorite: (vehicleId: string) => Promise<void>;
  removeFavorite: (vehicleId: string) => Promise<void>;
}

/**
 * Canonical query key for user favorites.
 * All components share ONE cache entry → ONE API call instead of N.
 */
export const favoritesQueryKey = (userId: string | undefined) => ['favorites', userId] as const;

export function useFavorites(): UseFavoritesResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: favoritesQueryKey(user?.id),
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];
      const { data, error } = await supabase
        .from("user_favorites")
        .select("vehicle_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map(f => f.vehicle_id).filter(Boolean) as string[] || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 min – favorites don't change often
    gcTime: 10 * 60 * 1000,
  });

  const isFavorite = useCallback((vehicleId: string): boolean => {
    return favorites.includes(vehicleId);
  }, [favorites]);

  const addFavorite = useCallback(async (vehicleId: string): Promise<void> => {
    if (!user) {
      toast({
        title: "Anmeldung erforderlich",
        description: "Bitte melden Sie sich an, um Favoriten zu speichern",
        variant: "destructive",
      });
      return;
    }

    // Optimistic update: immediately reflect in UI for all components
    const prevFavorites = queryClient.getQueryData<string[]>(favoritesQueryKey(user.id));
    queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), old => [...(old || []), vehicleId]);

    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) {
        queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), prevFavorites || []);
        return;
      }

      await withSessionRetry(async () => {
        const { error } = await supabase.from("user_favorites").insert({
          user_id: user.id,
          vehicle_id: vehicleId,
        });
        if (error) {
          if (error.code === "23505") return;
          throw error;
        }
      }, 'Favorites.add');

      trackEvent('favorite_added', { category: 'auction', properties: { vehicleId } });
      toast({ title: "Favorit hinzugefügt", description: "Das Fahrzeug wurde zu Ihren Favoriten hinzugefügt" });
    } catch (error) {
      // Rollback on failure
      queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), prevFavorites || []);
      console.error("Error adding favorite:", error);
      toast({ title: "Fehler", description: "Favorit konnte nicht hinzugefügt werden", variant: "destructive" });
    }
  }, [user, toast, queryClient]);

  const removeFavorite = useCallback(async (vehicleId: string): Promise<void> => {
    if (!user) return;

    // Optimistic update
    const prevFavorites = queryClient.getQueryData<string[]>(favoritesQueryKey(user.id));
    queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), old => (old || []).filter(id => id !== vehicleId));

    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) {
        queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), prevFavorites || []);
        return;
      }

      await withSessionRetry(async () => {
        const { error } = await supabase
          .from("user_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("vehicle_id", vehicleId);
        if (error) throw error;
      }, 'Favorites.remove');

      trackEvent('favorite_removed', { category: 'auction', properties: { vehicleId } });
      toast({ title: "Favorit entfernt", description: "Das Fahrzeug wurde aus Ihren Favoriten entfernt" });
    } catch (error) {
      // Rollback on failure
      queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), prevFavorites || []);
      console.error("Error removing favorite:", error);
      toast({ title: "Fehler", description: "Favorit konnte nicht entfernt werden", variant: "destructive" });
    }
  }, [user, toast, queryClient]);

  const toggleFavorite = useCallback(async (vehicleId: string): Promise<void> => {
    if (isFavorite(vehicleId)) {
      await removeFavorite(vehicleId);
    } else {
      await addFavorite(vehicleId);
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
