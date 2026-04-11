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
  isFavorite: (motorhomeId: string) => boolean;
  toggleFavorite: (motorhomeId: string) => Promise<void>;
  addFavorite: (motorhomeId: string) => Promise<void>;
  removeFavorite: (motorhomeId: string) => Promise<void>;
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
        .select("motorhome_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map(f => f.motorhome_id).filter(Boolean) as string[] || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 min – favorites don't change often
    gcTime: 10 * 60 * 1000,
  });

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

    // Optimistic update: immediately reflect in UI for all components
    const prevFavorites = queryClient.getQueryData<string[]>(favoritesQueryKey(user.id));
    queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), old => [...(old || []), motorhomeId]);

    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      await withSessionRetry(async () => {
        const { error } = await supabase.from("user_favorites").insert({
          user_id: user.id,
          motorhome_id: motorhomeId,
        });
        if (error) {
          if (error.code === "23505") return;
          throw error;
        }
      }, 'Favorites.add');

      trackEvent('favorite_added', { category: 'auction', properties: { motorhomeId } });
      toast({ title: "Favorit hinzugefügt", description: "Das Fahrzeug wurde zu Ihren Favoriten hinzugefügt" });
    } catch (error) {
      // Rollback on failure
      queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), prevFavorites || []);
      console.error("Error adding favorite:", error);
      toast({ title: "Fehler", description: "Favorit konnte nicht hinzugefügt werden", variant: "destructive" });
    }
  }, [user, toast, queryClient]);

  const removeFavorite = useCallback(async (motorhomeId: string): Promise<void> => {
    if (!user) return;

    // Optimistic update
    const prevFavorites = queryClient.getQueryData<string[]>(favoritesQueryKey(user.id));
    queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), old => (old || []).filter(id => id !== motorhomeId));

    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      await withSessionRetry(async () => {
        const { error } = await supabase
          .from("user_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("motorhome_id", motorhomeId);
        if (error) throw error;
      }, 'Favorites.remove');

      trackEvent('favorite_removed', { category: 'auction', properties: { motorhomeId } });
      toast({ title: "Favorit entfernt", description: "Das Fahrzeug wurde aus Ihren Favoriten entfernt" });
    } catch (error) {
      // Rollback on failure
      queryClient.setQueryData<string[]>(favoritesQueryKey(user.id), prevFavorites || []);
      console.error("Error removing favorite:", error);
      toast({ title: "Fehler", description: "Favorit konnte nicht entfernt werden", variant: "destructive" });
    }
  }, [user, toast, queryClient]);

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
