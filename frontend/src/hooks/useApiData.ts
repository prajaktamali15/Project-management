import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Custom hook for data fetching with loading and error states
 * Eliminates duplicate state management across components
 */
export function useApiData<T>(url: string, dependencies: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiFetch<T>(url);
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload, ...dependencies]);

  return { data, loading, error, reload };
}

/**
 * Custom hook for mutations (POST, PUT, DELETE)
 */
export function useApiMutation<TRequest = any, TResponse = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (
    url: string, 
    options: RequestInit
  ): Promise<TResponse | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<TResponse>(url, options);
      return result;
    } catch (err: any) {
      setError(err.message || "Operation failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error };
}
