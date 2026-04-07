/**
 * useUrlFilters – Speichert Filter-Zustand in URL-Suchparametern.
 * Filter bleiben bei Navigation erhalten und können als Link geteilt werden.
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

type FilterValue = string | number | null | undefined;

interface FilterConfig {
  [key: string]: FilterValue;
}

export function useUrlFilters<T extends FilterConfig>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const urlValue = searchParams.get(key);
      if (urlValue !== null) {
        const defaultVal = defaults[key];
        if (typeof defaultVal === "number") {
          result[key as keyof T] = (Number(urlValue) || defaultVal) as T[keyof T];
        } else {
          result[key as keyof T] = urlValue as T[keyof T];
        }
      }
    }
    return result;
  }, [searchParams, defaults]);

  const setFilter = useCallback(
    (key: keyof T, value: FilterValue) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const defaultVal = defaults[key];
        if (value === null || value === undefined || value === "" || value === defaultVal) {
          next.delete(key as string);
        } else {
          next.set(key as string, String(value));
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams, defaults]
  );

  const setFilters = useCallback(
    (updates: Partial<T>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          const defaultVal = defaults[key as keyof T];
          if (value === null || value === undefined || value === "" || value === defaultVal) {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams, defaults]
  );

  const resetFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return { filters, setFilter, setFilters, resetFilters };
}
