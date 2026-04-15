import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

export interface UseEdgeFunctionOptions {
  /** Custom error message shown in toast on failure. */
  errorMessage?: string;
  /** Toast shown on success. If undefined, no success toast is shown. */
  successToast?: { title: string; description?: string };
  /** Skip toast on error (caller handles it). */
  silentOnError?: boolean;
}

export interface UseEdgeFunctionReturn<TResult> {
  loading: boolean;
  result: TResult | null;
  error: Error | null;
  /** Invoke the edge function. Returns the result on success, or `null` on failure. */
  invoke: (body?: Record<string, unknown>) => Promise<TResult | null>;
  /** Reset `result`/`error` without re-invoking. */
  reset: () => void;
}

/**
 * Shared wrapper around `supabase.functions.invoke()`.
 *
 * Centralizes the loading/result/error state + toast on error pattern that
 * is repeated 100+ times across the codebase.
 *
 * By default, returns `data.result` if present, otherwise the raw `data`.
 * If you need a different extraction (e.g. the whole response), pass a
 * `transform` function or call `supabase.functions.invoke` directly.
 *
 * @example
 *   const { loading, invoke } = useEdgeFunction<string>("generate-mission-summary", {
 *     errorMessage: "Impossible de générer le résumé",
 *   });
 *   // ...
 *   const summary = await invoke({ mission_id: id });
 */
export function useEdgeFunction<TResult = unknown>(
  functionName: string,
  options: UseEdgeFunctionOptions = {},
): UseEdgeFunctionReturn<TResult> {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(
    async (body?: Record<string, unknown>): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await supabase.functions.invoke(functionName, {
          body: body ?? {},
        });
        if (response.error) {
          throw response.error instanceof Error
            ? response.error
            : new Error(String(response.error));
        }
        const extracted: TResult =
          response.data && typeof response.data === "object" && "result" in response.data
            ? (response.data as { result: TResult }).result
            : (response.data as TResult);
        setResult(extracted);
        if (options.successToast) {
          toast(options.successToast);
        }
        return extracted;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        if (!options.silentOnError) {
          toastError(toast, options.errorMessage ?? err.message);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [functionName, toast, options.errorMessage, options.silentOnError, options.successToast],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, result, error, invoke, reset };
}
