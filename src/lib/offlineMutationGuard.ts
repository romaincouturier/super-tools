import { toast } from "@/hooks/use-toast";

/**
 * Wraps a mutation function to prevent execution when offline.
 * Shows a toast notification instead.
 */
export function offlineGuard<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return ((...args: unknown[]) => {
    if (!navigator.onLine) {
      toast({
        title: "Action impossible",
        description: "Vous êtes hors ligne. Reconnectez-vous pour effectuer cette action.",
        variant: "destructive",
      });
      return Promise.reject(new Error("Offline: action impossible"));
    }
    return fn(...args);
  }) as T;
}
