import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition, Coordinates } from "@/lib/geolocation";

interface UseUserLocationResult {
  location: Coordinates | null;
  isLoading: boolean;
  error: string | null;
  requestLocation: () => Promise<Coordinates | null>;
}

const LOCATION_STORAGE_KEY = "user_location";
const LOCATION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface StoredLocation {
  coords: Coordinates;
  timestamp: number;
}

export function useUserLocation(): UseUserLocationResult {
  const { user } = useAuth();
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached location on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredLocation = JSON.parse(stored);
        const age = Date.now() - parsed.timestamp;
        if (age < LOCATION_EXPIRY_MS) {
          setLocation(parsed.coords);
        } else {
          localStorage.removeItem(LOCATION_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(LOCATION_STORAGE_KEY);
      }
    }
  }, []);

  // Try to load from profile if user is logged in
  useEffect(() => {
    if (user && !location) {
      const loadFromProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("latitude, longitude")
          .eq("id", user.id)
          .single();
        
        if (data?.latitude && data?.longitude) {
          const coords: Coordinates = {
            latitude: data.latitude,
            longitude: data.longitude,
          };
          setLocation(coords);
          cacheLocation(coords);
        }
      };
      loadFromProfile();
    }
  }, [user, location]);

  const cacheLocation = (coords: Coordinates) => {
    const stored: StoredLocation = {
      coords,
      timestamp: Date.now(),
    };
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(stored));
  };

  const saveToProfile = async (coords: Coordinates) => {
    if (!user) return;
    
    await supabase
      .from("profiles")
      .update({
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      .eq("id", user.id);
  };

  const requestLocation = useCallback(async (): Promise<Coordinates | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const coords = await getCurrentPosition();
      
      if (coords) {
        setLocation(coords);
        cacheLocation(coords);
        
        // Save to profile if user is logged in
        if (user) {
          await saveToProfile(coords);
        }
        
        return coords;
      } else {
        setError("Standort konnte nicht ermittelt werden");
        return null;
      }
    } catch (err) {
      setError("Standortabfrage fehlgeschlagen");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    location,
    isLoading,
    error,
    requestLocation,
  };
}
