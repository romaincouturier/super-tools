import { supabase } from "@/integrations/supabase/client";

/**
 * Appel d'edge function qui remonte l'erreur (throw) au lieu de l'avaler.
 *
 * À utiliser dans les mutationFn React Query qui doivent rejeter en cas
 * d'échec (le composant appelant gère l'erreur via try/catch + toastError).
 * Pour le pattern loading/toast intégré côté UI, préférer useEdgeFunction.
 */
export async function invokeEdge<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body: body ?? {} });
  if (error) throw error;
  return data as T;
}
