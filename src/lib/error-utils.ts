/**
 * Shared error utilities — single source of truth for error handling
 * across the entire application.
 */

/**
 * Safely extract an error message from an unknown caught value.
 * Use this in every catch block instead of `(error: any) => error.message`.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erreur inconnue";
}
